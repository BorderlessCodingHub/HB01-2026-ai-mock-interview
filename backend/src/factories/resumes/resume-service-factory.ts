import { createExtractionModel } from "@/infrastructure/ai/openai-models";
import { extractPdfText } from "@/infrastructure/document-parsing/pdf-text-extractor";
import { texToMarkdown } from "@/infrastructure/document-parsing/tex-to-markdown";
import { add } from "@/infrastructure/queue/resume-queue";
import { createR2ObjectStorage } from "@/infrastructure/storage/r2-client";
import { makeTokenUsageService } from "@/factories/token-usage/token-usage-service-factory";
import { ResumeService } from "@/modules/resumes/service/resume-service";
import { ResumeRepository } from "@/modules/resumes/repository/resume-repository";

export function makeResumeService(): ResumeService {
  return new ResumeService(
    new ResumeRepository(),
    createR2ObjectStorage(),
    { add },
    createExtractionModel(),
    extractPdfText,
    texToMarkdown,
    makeTokenUsageService(),
  );
}
