import { createUsageCaptureCallback } from "@/modules/token-usage/callbacks/token-usage-callback";
import type { TokenUsageService } from "@/modules/token-usage/service/token-usage-service";
import type { IReviewGenerationQueue } from "@/modules/interview/protocols/review-generation-queue";
import type { IReviewItemsGenerator } from "@/modules/interview/protocols/review-items-generator";
import type { MessageRepository } from "@/modules/interview/repository/message-repository";
import type { SessionRepository } from "@/modules/interview/repository/session-repository";
import type { ReviewMergeService } from "@/modules/interview/service/review-merge-service";
import type { SessionSummary } from "@/modules/interview/service/session-service";
import type { ResumeRepository } from "@/modules/resumes/repository/resume-repository";
import type { StructuredSummary } from "@/modules/resumes/validations/resume-schemas";
import {
  ConflictError,
  NotFoundError,
  TokenLimitExceededError,
} from "@/shared";
import type { InterviewSession } from "../../../../prisma/generated/client";

export type ReviewGenerationProcessResult =
  | { status: "ready"; sessionId: string }
  | {
      status: "failed";
      sessionId: string;
      error: string;
      cause?: unknown;
      retryable: false;
    }
  | { status: "skipped"; sessionId: string; reason: string };

function isDuplicateJobError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("already exists") ||
    message.includes("job with this id already exists")
  );
}

function toSessionSummary(session: InterviewSession): SessionSummary {
  return {
    id: session.id,
    resumeId: session.resumeId,
    resumeName: session.resumeName,
    level: session.level,
    turnCount: session.turnCount,
    maxTurns: session.maxTurns,
    isFinished: session.isFinished,
    hasJobDescription: session.jobDescription != null,
    createdAt: session.createdAt,
    reviewGenerationStatus: session.reviewGenerationStatus,
    reviewGenerationError: session.reviewGenerationError,
  };
}

export class ReviewGenerationService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly messageRepository: MessageRepository,
    private readonly resumeRepository: ResumeRepository,
    private readonly reviewItemsGenerator: IReviewItemsGenerator,
    private readonly reviewMergeService: ReviewMergeService,
    private readonly tokenUsageService: TokenUsageService,
    private readonly reviewGenerationQueue: IReviewGenerationQueue,
  ) {}

  async process(sessionId: string): Promise<ReviewGenerationProcessResult> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      return { status: "skipped", sessionId, reason: "not_found" };
    }

    if (session.reviewGenerationStatus === "ready") {
      return { status: "skipped", sessionId, reason: "already_ready" };
    }

    if (!session.isFinished) {
      return { status: "skipped", sessionId, reason: "not_finished" };
    }

    try {
      await this.tokenUsageService.assertWithinLimit(session.userId);
    } catch (error) {
      if (error instanceof TokenLimitExceededError) {
        const message = error.message;
        await this.sessionRepository.markReviewGenerationFailed(
          sessionId,
          message,
        );
        return {
          status: "failed",
          sessionId,
          error: message,
          cause: error,
          retryable: false,
        };
      }
      throw error;
    }

    const messages = await this.messageRepository.listBySessionId(sessionId);
    const transcript = messages
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");

    if (!session.resumeId) {
      const message = "Resume not found";
      await this.sessionRepository.markReviewGenerationFailed(
        sessionId,
        message,
      );
      return {
        status: "failed",
        sessionId,
        error: message,
        retryable: false,
      };
    }

    const resume = await this.resumeRepository.findById(session.resumeId);
    if (!resume?.structuredSummary) {
      const message = "Resume structured summary not found";
      await this.sessionRepository.markReviewGenerationFailed(
        sessionId,
        message,
      );
      return {
        status: "failed",
        sessionId,
        error: message,
        retryable: false,
      };
    }

    const structuredSummary = resume.structuredSummary as StructuredSummary;
    const usageCapture = createUsageCaptureCallback();
    const review = await this.reviewItemsGenerator.generate(
      {
        userId: session.userId,
        sessionId,
        transcript,
        structuredSummary,
        interviewLocale: session.interviewLocale,
        jobDescription: session.jobDescription,
      },
      { callbacks: [usageCapture.callback] },
    );

    await this.tokenUsageService.recordUsage(
      session.userId,
      usageCapture.getUsage(),
    );

    await this.reviewMergeService.insertNewTopicsOnly(
      session.userId,
      sessionId,
      review.items,
    );

    await this.sessionRepository.markReviewGenerationReady(sessionId);

    return { status: "ready", sessionId };
  }

  async enqueueForSession(sessionId: string): Promise<"pending" | "failed"> {
    await this.sessionRepository.markReviewGenerationPending(sessionId);

    try {
      await this.reviewGenerationQueue.add({ sessionId });
      return "pending";
    } catch (error) {
      if (isDuplicateJobError(error)) {
        return "pending";
      }

      const message =
        error instanceof Error
          ? error.message
          : "Failed to enqueue review generation";
      await this.sessionRepository.markReviewGenerationFailed(
        sessionId,
        message,
      );
      return "failed";
    }
  }

  async retry(userId: number, sessionId: string): Promise<SessionSummary> {
    const session = await this.sessionRepository.findByIdAndUserId(
      sessionId,
      userId,
    );

    if (!session) {
      throw new NotFoundError();
    }

    if (
      !session.isFinished ||
      session.reviewGenerationStatus !== "failed"
    ) {
      throw new ConflictError(
        "Review generation can only be retried when the session is finished and generation failed",
      );
    }

    await this.reviewGenerationQueue.remove(sessionId);
    await this.enqueueForSession(sessionId);

    const updated = await this.sessionRepository.findByIdAndUserId(
      sessionId,
      userId,
    );

    if (!updated) {
      throw new NotFoundError();
    }

    return toSessionSummary(updated);
  }
}
