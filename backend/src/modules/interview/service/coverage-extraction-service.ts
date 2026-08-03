import { createUsageCaptureCallback } from "@/modules/token-usage/callbacks/token-usage-callback";
import type { TokenUsageService } from "@/modules/token-usage/service/token-usage-service";
import { TOPIC_COVERAGE_RETENTION_PER_USER } from "@/modules/interview/constants/topic-coverage";
import type { ITopicCoverageGenerator } from "@/modules/interview/protocols/topic-coverage-generator";
import type { MessageRepository } from "@/modules/interview/repository/message-repository";
import type { SessionRepository } from "@/modules/interview/repository/session-repository";
import type { TopicCoverageRepository } from "@/modules/interview/repository/topic-coverage-repository";
import { TokenLimitExceededError, logger } from "@/shared";

export type CoverageExtractionResult =
  | { status: "ready"; sessionId: string }
  | { status: "skipped"; sessionId: string; reason: string };

export class CoverageExtractionService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly messageRepository: MessageRepository,
    private readonly topicCoverageGenerator: ITopicCoverageGenerator,
    private readonly topicCoverageRepository: TopicCoverageRepository,
    private readonly tokenUsageService: TokenUsageService,
  ) {}

  async process(sessionId: string): Promise<CoverageExtractionResult> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      return { status: "skipped", sessionId, reason: "not_found" };
    }

    if (!session.isFinished) {
      return { status: "skipped", sessionId, reason: "not_finished" };
    }

    const existingCount =
      await this.topicCoverageRepository.countBySessionId(sessionId);
    if (existingCount > 0) {
      return { status: "skipped", sessionId, reason: "already_processed" };
    }

    try {
      await this.tokenUsageService.assertWithinLimit(session.userId);
    } catch (error) {
      if (error instanceof TokenLimitExceededError) {
        logger.warn("Coverage extraction skipped: monthly token limit exceeded", {
          sessionId,
          userId: session.userId,
        });
        return {
          status: "skipped",
          sessionId,
          reason: "token_limit_exceeded",
        };
      }
      throw error;
    }

    const messages = await this.messageRepository.listBySessionId(sessionId);
    const transcript = messages
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");

    const usageCapture = createUsageCaptureCallback();
    const coverage = await this.topicCoverageGenerator.generate(
      {
        transcript,
        interviewLocale: session.interviewLocale,
        jobDescription: session.jobDescription,
      },
      { callbacks: [usageCapture.callback] },
    );

    await this.tokenUsageService.recordUsage(
      session.userId,
      usageCapture.getUsage(),
    );

    const rows = coverage.items
      .map((item) => ({
        userId: session.userId,
        sessionId,
        topic: item.topic.trim(),
        angle: item.angle.trim(),
      }))
      .filter((item) => item.topic.length > 0 && item.angle.length > 0);

    if (rows.length > 0) {
      await this.topicCoverageRepository.createMany(rows);
    }

    await this.topicCoverageRepository.pruneOldestBeyondLimit(
      session.userId,
      TOPIC_COVERAGE_RETENTION_PER_USER,
    );

    return { status: "ready", sessionId };
  }
}
