import type { Response } from "express";

import { createUsageCaptureCallback } from "@/modules/token-usage/callbacks/token-usage-callback";
import type { TokenUsageService } from "@/modules/token-usage/service/token-usage-service";
import type { LlmUsage } from "@/modules/token-usage/types/llm-usage";
import type { IInterviewGraph } from "@/modules/interview/protocols/interview-graph";
import type { ICoverageExtractionQueue } from "@/modules/interview/protocols/coverage-extraction-queue";
import type { IReviewGenerationQueue } from "@/modules/interview/protocols/review-generation-queue";
import type { IWeakAnswerQueue } from "@/modules/interview/protocols/weak-answer-queue";
import type { MessageRepository } from "@/modules/interview/repository/message-repository";
import type { ReviewRepository } from "@/modules/interview/repository/review-repository";
import type { SessionRepository } from "@/modules/interview/repository/session-repository";
import type { SoftCoveragePromptLoader } from "@/modules/interview/service/soft-coverage-prompt-loader";
import type { ResumeRepository } from "@/modules/resumes/repository/resume-repository";
import type { StructuredSummary } from "@/modules/resumes/validations/resume-schemas";
import {
  ConflictError,
  NotFoundError,
  logStreamError,
  type InterviewLocale,
} from "@/shared";
import { writeDone, writeEvent } from "@/shared/utils/sse";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

export class InterviewStreamService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly messageRepository: MessageRepository,
    private readonly resumeRepository: ResumeRepository,
    private readonly graph: IInterviewGraph,
    private readonly reviewGenerationQueue: IReviewGenerationQueue,
    private readonly weakAnswerQueue: IWeakAnswerQueue,
    private readonly coverageExtractionQueue: ICoverageExtractionQueue,
    private readonly softCoveragePromptLoader: SoftCoveragePromptLoader,
    private readonly tokenUsageService: TokenUsageService,
    private readonly reviewRepository: ReviewRepository,
  ) {}

  async streamTurn(
    userId: number,
    sessionId: string,
    body: { content: string; interviewLocale: InterviewLocale },
    res: Response,
  ): Promise<void> {
    const { content, interviewLocale } = body;
    const session = await this.sessionRepository.findByIdAndUserId(
      sessionId,
      userId,
    );

    if (!session) {
      throw new NotFoundError();
    }

    if (session.isFinished || session.turnCount >= session.maxTurns) {
      throw new ConflictError("Interview session is finished");
    }

    if (!session.resumeId) {
      throw new NotFoundError();
    }

    const resume = await this.resumeRepository.findByIdAndUserId(
      session.resumeId,
      userId,
    );

    if (!resume?.structuredSummary) {
      throw new NotFoundError();
    }

    const resumeSummary = resume.structuredSummary as StructuredSummary;
    const isFinalTurn = session.turnCount + 1 >= session.maxTurns;

    await this.tokenUsageService.assertWithinLimit(userId);

    const reviewItems = await this.reviewRepository.listByUserId(userId);
    const coveredAngles = reviewItems.map((item) => ({
      topic: item.topic,
      angle: item.angle,
    }));

    const interviewerUsageCapture = createUsageCaptureCallback();

    res.writeHead(200, SSE_HEADERS);
    res.flushHeaders();
    await this.messageRepository.createHuman({
      sessionId,
      userId,
      content,
    });

    let aborted = false;

    const onClose = (): void => {
      aborted = true;
    };

    res.on("close", onClose);

    let recentCoverage: { topic: string; angle: string }[] = [];
    let activeReviewTopics: {
      topic: string;
      priority: string;
      description?: string;
    }[] = [];

    try {
      const hints =
        await this.softCoveragePromptLoader.loadSoftCoverageHints(userId);
      recentCoverage = hints.coverage.map(({ topic, angle }) => ({
        topic,
        angle,
      }));
      activeReviewTopics = hints.activeReviews;
    } catch (loadErr) {
      logStreamError({
        flow: "interview",
        userId,
        sessionId,
        err: loadErr,
      });
    }

    const stream = this.graph.streamMessages(
      {
        messages: [{ role: "human", content }],
        turnCount: session.turnCount,
        maxTurns: session.maxTurns,
        level: session.level,
        userId,
        resumeSummary,
        jobDescription: session.jobDescription,
        interviewLocale,
        isFinished: session.isFinished,
        runReview: isFinalTurn,
        recentCoverage,
        activeReviewTopics,
        coveredAngles,
      },
      {
        threadId: sessionId,
        callbacks: [interviewerUsageCapture.callback],
      },
    );
    const iterator = stream[Symbol.asyncIterator]();

    const logAborted = (): void => {
      logStreamError({
        flow: "interview",
        userId,
        sessionId,
        err: "Client disconnected during stream",
        aborted: true,
      });
    };

    const closeWithError = (err: unknown): void => {
      logStreamError({ flow: "interview", userId, sessionId, err });

      if (res.writableEnded) {
        return;
      }

      const message =
        err instanceof Error ? err.message : "Interview stream failed";
      writeEvent(res, "error", { message });
      writeDone(res);
      res.end();
    };

    try {
      let completedAiMessage:
        | { content: string; usage?: LlmUsage }
        | undefined;

      while (true) {
        if (aborted) {
          logAborted();
          return;
        }

        const result = await iterator.next();
        if (aborted) {
          logAborted();
          return;
        }
        if (result.done) {
          if (aborted) {
            logAborted();
            return;
          }

          completedAiMessage = result.value;
          if (!completedAiMessage?.content) {
            closeWithError(new Error("Interview response was not saved"));
            return;
          }

          await this.messageRepository.createAi({
            sessionId,
            userId,
            content: completedAiMessage.content,
          });

          break;
        }

        writeEvent(res, "token", { content: result.value.content });
      }

      if (aborted) {
        logAborted();
        return;
      }

      await this.tokenUsageService.recordUsage(
        userId,
        interviewerUsageCapture.getUsage() ?? completedAiMessage?.usage,
      );

      const updatedSession =
        await this.sessionRepository.incrementTurnCount(sessionId);

      let isFinished = updatedSession.isFinished;
      let reviewGenerationStatus: "pending" | "failed" | undefined;

      if (isFinalTurn) {
        await this.sessionRepository.markFinished(sessionId, interviewLocale);
        isFinished = true;
        reviewGenerationStatus = "pending";

        try {
          await this.reviewGenerationQueue.add({ sessionId });
        } catch (enqueueErr) {
          const message =
            enqueueErr instanceof Error
              ? enqueueErr.message
              : "Failed to enqueue review generation";
          await this.sessionRepository.markReviewGenerationFailed(
            sessionId,
            message,
          );
          reviewGenerationStatus = "failed";
        }

        try {
          await this.weakAnswerQueue.add({ sessionId });
        } catch (enqueueErr) {
          logStreamError({
            flow: "interview",
            userId,
            sessionId,
            err: enqueueErr,
          });
        }

        try {
          await this.coverageExtractionQueue.add({ sessionId });
        } catch (enqueueErr) {
          logStreamError({
            flow: "interview",
            userId,
            sessionId,
            err: enqueueErr,
          });
        }
      }

      writeEvent(res, "meta", {
        turnCount: updatedSession.turnCount,
        maxTurns: session.maxTurns,
        isFinished,
        ...(reviewGenerationStatus !== undefined
          ? { reviewGenerationStatus }
          : {}),
      });
      writeDone(res);
      res.end();
    } catch (err) {
      if (aborted) {
        logAborted();
      } else {
        closeWithError(err);
      }
    } finally {
      res.off("close", onClose);
      await iterator.return?.(undefined);
    }
  }
}
