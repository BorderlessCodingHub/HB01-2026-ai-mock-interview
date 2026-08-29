import { randomUUID } from "node:crypto";

import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { ChatOpenAI } from "@langchain/openai";

import {
  RESUME_STATUS,
  type ResumeRecord,
  type ResumeStatus,
} from "@/modules/resumes/types/resume-record";
import { env } from "@/config/env";
import type { TexToMarkdown } from "@/infrastructure/document-parsing/tex-to-markdown";
import { createUsageCaptureCallback } from "@/modules/token-usage/callbacks/token-usage-callback";
import type { TokenUsageService } from "@/modules/token-usage/service/token-usage-service";
import type { IObjectStorage } from "@/modules/resumes/protocols/object-storage";
import type { IResumeQueue } from "@/modules/resumes/protocols/resume-queue";
import { buildResumeExtractionPrompt } from "@/modules/resumes/prompts/resume-extraction-prompt";
import type { ResumeRepository } from "@/modules/resumes/repository/resume-repository";
import {
  classifyResumeSourceFormat,
  resumeContentType,
  resumeStorageKey,
  type ResumeSourceFormat,
} from "@/modules/resumes/source-format";
import {
  structuredSummarySchema,
  type StructuredSummary,
} from "@/modules/resumes/validations/resume-schemas";
import {
  BadGatewayError,
  BadRequestError,
  logger,
  NotFoundError,
  ServiceUnavailableError,
  TokenLimitExceededError,
} from "@/shared";

export type PdfTextExtractor = (buffer: Buffer) => Promise<string>;

export type ResumeProcessResult =
  | { status: "ready"; resumeId: string }
  | { status: "failed"; resumeId: string; error: string; cause?: unknown }
  | { status: "skipped"; resumeId: string; reason: "not_found" };

export type ResumePreview = {
  id: string;
  name: string;
  status: ResumeStatus;
  createdAt: Date;
};

export type ResumeDetail = ResumePreview & {
  structuredSummary?: StructuredSummary;
};

export class ResumeService {
  constructor(
    private readonly resumeRepository: ResumeRepository,
    private readonly objectStorage: IObjectStorage,
    private readonly resumeQueue: IResumeQueue,
    private readonly extractionModel: ChatOpenAI,
    private readonly extractText: PdfTextExtractor,
    private readonly texToMarkdown: TexToMarkdown,
    private readonly tokenUsageService: TokenUsageService,
    private readonly maxBytes: number = env.RESUME_MAX_BYTES,
  ) {}

  async upload(
    userId: number,
    file: Express.Multer.File,
  ): Promise<ResumePreview> {
    const format = this.validateResumeFile(file);

    const resumeId = randomUUID();
    const storageKey = resumeStorageKey(userId, resumeId, format);

    const resume = await this.resumeRepository.createProcessing(
      userId,
      file.originalname,
      storageKey,
      format,
      resumeId,
    );

    try {
      await this.objectStorage.put(
        storageKey,
        file.buffer,
        resumeContentType(format),
      );
    } catch {
      await this.resumeRepository.updateFailed(
        resume.id,
        "Failed to upload resume to storage",
      );
      throw new BadGatewayError("Failed to upload resume");
    }

    try {
      await this.resumeQueue.add({ resumeId: resume.id });
    } catch {
      await this.resumeRepository.updateFailed(
        resume.id,
        "Failed to enqueue resume processing",
      );
      throw new ServiceUnavailableError("Resume processing is unavailable");
    }

    return toResumePreview(resume);
  }

  async getResume(userId: number, id: string): Promise<ResumeDetail> {
    const resume = await this.resumeRepository.findByIdAndUserId(id, userId);

    if (!resume) {
      throw new NotFoundError("Resume not found");
    }

    return toResumeDetail(resume);
  }

  async listResumes(userId: number): Promise<ResumePreview[]> {
    const resumes = await this.resumeRepository.findAllByUserId(userId);
    return resumes.map(toResumePreview);
  }

  async deleteResume(userId: number, id: string): Promise<void> {
    const resume = await this.resumeRepository.findByIdAndUserId(id, userId);

    if (!resume) {
      throw new NotFoundError("Resume not found");
    }

    await this.resumeRepository.deleteByIdAndUserId(id, userId);

    try {
      await this.objectStorage.delete(resume.storageKey);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown storage error";
      const stack = error instanceof Error ? error.stack : undefined;

      logger.warn(`Failed to delete resume file ${resume.storageKey} from storage`, {
        storageKey: resume.storageKey,
        message,
        stack,
      });
    }
  }

  async process(resumeId: string): Promise<ResumeProcessResult> {
    const resume = await this.resumeRepository.findById(resumeId);

    if (!resume) {
      return { status: "skipped", resumeId, reason: "not_found" };
    }

    try {
      await this.tokenUsageService.assertWithinLimit(resume.userId);

      const buffer = await this.objectStorage.get(resume.storageKey);
      const rawText =
        resume.sourceFormat === "tex"
          ? await this.texToMarkdown(buffer)
          : await this.extractText(buffer);

      if (!rawText.trim()) {
        throw new Error("Resume contains no extractable text");
      }

      const promptText = buildResumeExtractionPrompt(rawText);
      const usageCapture = createUsageCaptureCallback();
      const chain = ChatPromptTemplate.fromMessages([
        ["user", "{prompt}"],
      ]).pipe(
        this.extractionModel.withStructuredOutput(structuredSummarySchema),
      );
      const structuredSummary = await chain.invoke(
        { prompt: promptText },
        { callbacks: [usageCapture.callback] },
      );

      await this.tokenUsageService.recordUsage(
        resume.userId,
        usageCapture.getUsage(),
      );

      await this.resumeRepository.updateReady(
        resumeId,
        structuredSummary,
        rawText,
      );
      return { status: "ready", resumeId };
    } catch (error) {
      if (error instanceof TokenLimitExceededError) {
        const message = error.message;
        await this.resumeRepository.updateFailed(resumeId, message);
        return { status: "failed", resumeId, error: message, cause: error };
      }

      const message =
        error instanceof Error ? error.message : "Resume processing failed";

      await this.resumeRepository.updateFailed(resumeId, message);
      return { status: "failed", resumeId, error: message, cause: error };
    }
  }

  private validateResumeFile(file: Express.Multer.File): ResumeSourceFormat {
    if (!file) {
      throw new BadRequestError("Resume file is required");
    }

    const format = classifyResumeSourceFormat(file.originalname);

    if (format === null) {
      throw new BadRequestError("Only PDF and TeX files are allowed");
    }

    if (file.size > this.maxBytes) {
      throw new BadRequestError(
        `File must be at most ${this.maxBytes} bytes`,
      );
    }

    return format;
  }
}

function toResumePreview(resume: ResumeRecord): ResumePreview {
  return {
    id: resume.id,
    name: resume.name,
    status: resume.status,
    createdAt: resume.createdAt,
  };
}

function toResumeDetail(resume: ResumeRecord): ResumeDetail {
  const preview = toResumePreview(resume);

  if (
    resume.status !== RESUME_STATUS.ready ||
    resume.structuredSummary === null
  ) {
    return preview;
  }

  return {
    ...preview,
    structuredSummary: resume.structuredSummary as StructuredSummary,
  };
}
