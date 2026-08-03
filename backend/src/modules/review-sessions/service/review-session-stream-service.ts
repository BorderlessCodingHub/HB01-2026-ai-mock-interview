import type { Response } from "express";

import { env } from "@/config/env";
import { createUsageCaptureCallback } from "@/modules/token-usage/callbacks/token-usage-callback";
import type { TokenUsageService } from "@/modules/token-usage/service/token-usage-service";
import type { LlmUsage } from "@/modules/token-usage/types/llm-usage";
import type { IReviewSessionEvaluator } from "@/modules/review-sessions/protocols/review-session-evaluator";
import type { IReviewSessionQuestionGenerator } from "@/modules/review-sessions/protocols/review-session-question-generator";
import type { ReviewSessionRepository } from "@/modules/review-sessions/repository/review-session-repository";
import type {
  ReviewSessionItemRecord,
  ReviewSessionRecord,
} from "@/modules/review-sessions/types/review-session-record";
import type { ReviewSessionEvaluationOutput } from "@/modules/review-sessions/validations/review-session-schemas";
import {
  BadRequestError,
  ConflictError,
  logStreamError,
  logger,
  NotFoundError,
  type InterviewLocale,
} from "@/shared";
import { writeDone, writeEvent } from "@/shared/utils/sse";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

type ReviewSessionStreamReportItem = {
  reviewSessionItemId: string;
  reviewItemId: string;
  topic: string;
  angle: string;
  currentPriority: string;
  suggestedStatus: string | null;
  suggestedPriority: string | null;
};

function findCurrentItem(
  items: ReviewSessionItemRecord[],
  questionCount: number,
): ReviewSessionItemRecord | undefined {
  return items.find((item) => item.turns.length < questionCount);
}

function isSessionStart(session: ReviewSessionRecord): boolean {
  return session.items.every(
    (item) => item.turns.length === 0 && !item.pendingQuestion,
  );
}

function toReportItem(item: ReviewSessionItemRecord): ReviewSessionStreamReportItem {
  return {
    reviewSessionItemId: item.id,
    reviewItemId: item.reviewItemId,
    topic: item.topic,
    angle: item.angle,
    currentPriority: item.currentPriority,
    suggestedStatus: item.suggestedStatus,
    suggestedPriority: item.suggestedPriority,
  };
}

export class ReviewSessionStreamService {
  constructor(
    private readonly reviewSessionRepository: ReviewSessionRepository,
    private readonly questionGenerator: IReviewSessionQuestionGenerator,
    private readonly evaluator: IReviewSessionEvaluator,
    private readonly tokenUsageService: TokenUsageService,
  ) {}

  async streamTurn(
    userId: number,
    sessionId: string,
    body: { answer?: string; interviewLocale: InterviewLocale },
    res: Response,
  ): Promise<void> {
    const { answer, interviewLocale } = body;
    const questionCount = env.REVIEW_SESSION_QUESTION_COUNT;

    let session = await this.reviewSessionRepository.findByIdAndUserId(
      sessionId,
      userId,
    );

    if (!session) {
      throw new NotFoundError("Review session not found");
    }

    if (
      session.status === "pending_review" ||
      session.status === "completed"
    ) {
      throw new ConflictError("Review session is not accepting answers");
    }

    const sessionStart = isSessionStart(session);

    if (!answer) {
      if (!sessionStart) {
        throw new BadRequestError("Answer is required");
      }
    } else {
      const currentItem = findCurrentItem(session.items, questionCount);
      if (!currentItem?.pendingQuestion) {
        throw new BadRequestError("No pending question to answer");
      }

      await this.reviewSessionRepository.appendTurn(currentItem.id, {
        question: currentItem.pendingQuestion,
        answer,
      });

      session = {
        ...session,
        items: session.items.map((item) =>
          item.id === currentItem.id
            ? {
                ...item,
                turns: [
                  ...item.turns,
                  { question: currentItem.pendingQuestion!, answer },
                ],
                pendingQuestion: null,
              }
            : item,
        ),
      };
    }

    const allItemsComplete = session.items.every(
      (item) => item.turns.length >= questionCount,
    );

    await this.tokenUsageService.assertWithinLimit(userId);

    res.writeHead(200, SSE_HEADERS);
    res.flushHeaders();

    let aborted = false;

    const onClose = (): void => {
      aborted = true;
    };

    res.on("close", onClose);

    const logAborted = (): void => {
      logStreamError({
        flow: "review-session",
        userId,
        sessionId,
        err: "Client disconnected during stream",
        aborted: true,
      });
    };

    const closeWithError = (err: unknown): void => {
      logStreamError({ flow: "review-session", userId, sessionId, err });

      if (res.writableEnded) {
        return;
      }

      const message =
        err instanceof Error ? err.message : "Review session stream failed";
      writeEvent(res, "error", { message });
      writeDone(res);
      res.end();
    };

    try {
      if (allItemsComplete) {
        await this.runEvaluation(
          userId,
          sessionId,
          session,
          interviewLocale,
          res,
          () => aborted,
        );
        if (aborted) {
          logAborted();
          return;
        }
        return;
      }

      const currentItem = findCurrentItem(session.items, questionCount);
      if (!currentItem) {
        closeWithError(new Error("No review session item is ready for a question"));
        return;
      }

      const streamed = await this.streamQuestion(
        userId,
        currentItem,
        interviewLocale,
        res,
        () => aborted,
      );

      if (aborted) {
        logAborted();
        return;
      }

      if (!streamed) {
        return;
      }

      await this.reviewSessionRepository.setPendingQuestion(
        currentItem.id,
        streamed.content,
      );

      const itemIndex = session.items.findIndex(
        (item) => item.id === currentItem.id,
      );

      writeEvent(res, "meta", {
        reviewSessionItemId: currentItem.id,
        itemIndex,
        totalItems: session.items.length,
        turnsCompleted: currentItem.turns.length,
        questionsPerItem: questionCount,
        status: session.status,
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
    }
  }

  private async streamQuestion(
    userId: number,
    item: ReviewSessionItemRecord,
    interviewLocale: InterviewLocale,
    res: Response,
    isAborted: () => boolean,
  ): Promise<{ content: string; usage?: LlmUsage } | undefined> {
    const usageCapture = createUsageCaptureCallback();
    const stream = this.questionGenerator.streamQuestion(
      {
        topic: item.topic,
        angle: item.angle,
        description: item.description,
        turns: item.turns,
        interviewLocale,
      },
      { callbacks: [usageCapture.callback] },
    );
    const iterator = stream[Symbol.asyncIterator]();

    try {
      let completed:
        | { content: string; usage?: LlmUsage }
        | undefined;

      while (true) {
        if (isAborted()) {
          return undefined;
        }

        const result = await iterator.next();
        if (isAborted()) {
          return undefined;
        }

        if (result.done) {
          completed = result.value;
          if (!completed?.content) {
            throw new Error("Question was not generated");
          }
          break;
        }

        writeEvent(res, "token", { content: result.value.content });
      }

      if (isAborted()) {
        return undefined;
      }

      await this.tokenUsageService.recordUsage(
        userId,
        usageCapture.getUsage() ?? completed?.usage,
      );

      return completed;
    } finally {
      await iterator.return?.({ content: "" });
    }
  }

  private async runEvaluation(
    userId: number,
    sessionId: string,
    session: ReviewSessionRecord,
    interviewLocale: InterviewLocale,
    res: Response,
    isAborted: () => boolean,
  ): Promise<void> {
    if (isAborted()) {
      return;
    }

    const results = await Promise.allSettled(
      session.items.map(async (item) => {
        const usageCapture = createUsageCaptureCallback();
        const evaluation = await this.evaluator.evaluate(
          {
            topic: item.topic,
            angle: item.angle,
            description: item.description,
            currentPriority: item.currentPriority,
            turns: item.turns,
            interviewLocale,
          },
          { callbacks: [usageCapture.callback] },
        );

        await this.tokenUsageService.recordUsage(
          userId,
          usageCapture.getUsage(),
        );

        return { item, evaluation };
      }),
    );

    if (isAborted()) {
      return;
    }

    let failureCount = 0;

    for (let index = 0; index < results.length; index++) {
      if (isAborted()) {
        return;
      }

      const result = results[index]!;
      const item = session.items[index]!;

      if (result.status === "fulfilled") {
        const { evaluation } = result.value;
        await this.reviewSessionRepository.saveSuggestions(
          item.id,
          toSuggestion(evaluation),
        );
        continue;
      }

      failureCount += 1;

      logStreamError({
        flow: "review-session",
        userId,
        sessionId,
        err: result.reason,
        reviewSessionItemId: item.id,
      });

      await this.reviewSessionRepository.saveSuggestions(item.id, null);

      const message =
        result.reason instanceof Error
          ? result.reason.message
          : "Evaluation failed";

      writeEvent(res, "error", {
        message,
        reviewSessionItemId: item.id,
      });
    }

    if (failureCount > 0) {
      logger.info("Evaluation completed with failures", {
        flow: "review-session",
        userId,
        sessionId,
        failureCount,
        totalItems: session.items.length,
      });
    }

    if (isAborted()) {
      return;
    }

    await this.reviewSessionRepository.markPendingReview(
      sessionId,
      interviewLocale,
    );

    const updatedSession =
      await this.reviewSessionRepository.findByIdAndUserId(sessionId, userId);

    if (!updatedSession) {
      logStreamError({
        flow: "review-session",
        userId,
        sessionId,
        err: new Error("Review session not found after evaluation"),
      });
      closeWithErrorOnResponse(res, "Review session not found after evaluation");
      return;
    }

    writeEvent(res, "meta", {
      status: "pending_review",
      report: updatedSession.items.map(toReportItem),
    });
    writeDone(res);
    res.end();
  }
}

function toSuggestion(evaluation: ReviewSessionEvaluationOutput) {
  if (evaluation.status === "learned") {
    return { status: evaluation.status, priority: null };
  }

  return {
    status: evaluation.status,
    priority: evaluation.priority,
  };
}

function closeWithErrorOnResponse(res: Response, message: string): void {
  if (res.writableEnded) {
    return;
  }
  writeEvent(res, "error", { message });
  writeDone(res);
  res.end();
}
