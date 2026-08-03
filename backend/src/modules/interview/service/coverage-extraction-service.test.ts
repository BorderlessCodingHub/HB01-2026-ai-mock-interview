import { beforeEach, describe, expect, it, vi } from "vitest";

import { TOPIC_COVERAGE_RETENTION_PER_USER } from "@/modules/interview/constants/topic-coverage";
import type { ITopicCoverageGenerator } from "@/modules/interview/protocols/topic-coverage-generator";
import type { MessageRepository } from "@/modules/interview/repository/message-repository";
import type { SessionRepository } from "@/modules/interview/repository/session-repository";
import type { TopicCoverageRepository } from "@/modules/interview/repository/topic-coverage-repository";
import type { TokenUsageService } from "@/modules/token-usage/service/token-usage-service";
import { TokenLimitExceededError, logger } from "@/shared";

import { CoverageExtractionService } from "./coverage-extraction-service";

vi.mock("@/modules/token-usage/callbacks/token-usage-callback", () => ({
  createUsageCaptureCallback: vi.fn(() => ({
    callback: {},
    getUsage: () => undefined,
  })),
}));

vi.mock("@/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared")>();
  return {
    ...actual,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

const baseSession = {
  id: "session-1",
  userId: 1,
  resumeId: "resume-1",
  level: "entry" as const,
  interviewLocale: "en" as const,
  jobDescription: "Backend Engineer role",
  turnCount: 5,
  maxTurns: 5,
  isFinished: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("CoverageExtractionService", () => {
  let sessionRepository: SessionRepository;
  let messageRepository: MessageRepository;
  let topicCoverageRepository: TopicCoverageRepository;
  let topicCoverageGenerator: ITopicCoverageGenerator;
  let tokenUsageService: TokenUsageService;
  let service: CoverageExtractionService;

  beforeEach(() => {
    vi.clearAllMocks();

    sessionRepository = {
      findById: vi.fn(),
    } as unknown as SessionRepository;

    messageRepository = {
      listBySessionId: vi.fn(),
    } as unknown as MessageRepository;

    topicCoverageRepository = {
      countBySessionId: vi.fn().mockResolvedValue(0),
      createMany: vi.fn().mockResolvedValue(undefined),
      pruneOldestBeyondLimit: vi.fn().mockResolvedValue(0),
    } as unknown as TopicCoverageRepository;

    topicCoverageGenerator = {
      generate: vi.fn(),
    };

    tokenUsageService = {
      assertWithinLimit: vi.fn().mockResolvedValue(undefined),
      recordUsage: vi.fn().mockResolvedValue(undefined),
      getUsage: vi.fn(),
    } as unknown as TokenUsageService;

    service = new CoverageExtractionService(
      sessionRepository,
      messageRepository,
      topicCoverageGenerator,
      topicCoverageRepository,
      tokenUsageService,
    );
  });

  describe("process", () => {
    it("returns skipped when session does not exist", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue(null);

      const result = await service.process("missing-session");

      expect(result).toEqual({
        status: "skipped",
        sessionId: "missing-session",
        reason: "not_found",
      });
      expect(topicCoverageGenerator.generate).not.toHaveBeenCalled();
    });

    it("returns skipped when session is not finished", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue({
        ...baseSession,
        isFinished: false,
      } as never);

      const result = await service.process(baseSession.id);

      expect(result).toEqual({
        status: "skipped",
        sessionId: baseSession.id,
        reason: "not_finished",
      });
      expect(topicCoverageGenerator.generate).not.toHaveBeenCalled();
    });

    it("returns skipped when coverage was already processed for the session", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue(
        baseSession as never,
      );
      vi.mocked(topicCoverageRepository.countBySessionId).mockResolvedValue(2);

      const result = await service.process(baseSession.id);

      expect(result).toEqual({
        status: "skipped",
        sessionId: baseSession.id,
        reason: "already_processed",
      });
      expect(tokenUsageService.assertWithinLimit).not.toHaveBeenCalled();
      expect(topicCoverageGenerator.generate).not.toHaveBeenCalled();
    });

    it("returns skipped when the monthly token limit was reached", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue(
        baseSession as never,
      );
      vi.mocked(tokenUsageService.assertWithinLimit).mockRejectedValue(
        new TokenLimitExceededError(),
      );

      const result = await service.process(baseSession.id);

      expect(result).toEqual({
        status: "skipped",
        sessionId: baseSession.id,
        reason: "token_limit_exceeded",
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("token limit"),
        expect.objectContaining({
          sessionId: baseSession.id,
          userId: baseSession.userId,
        }),
      );
      expect(topicCoverageGenerator.generate).not.toHaveBeenCalled();
    });

    it("generates coverage, persists rows, prunes retention, and records token usage", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue(
        baseSession as never,
      );
      vi.mocked(messageRepository.listBySessionId).mockResolvedValue([
        { id: "m1", role: "ai", content: "Tell me about caching." },
        { id: "m2", role: "human", content: "I use Redis." },
      ] as never);
      vi.mocked(topicCoverageGenerator.generate).mockResolvedValue({
        items: [
          { topic: "Caching", angle: "Redis trade-offs" },
          { topic: "  ", angle: "empty topic" },
          { topic: "APIs", angle: "  " },
        ],
      });

      const result = await service.process(baseSession.id);

      expect(topicCoverageGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          transcript: "ai: Tell me about caching.\nhuman: I use Redis.",
          interviewLocale: baseSession.interviewLocale,
          jobDescription: baseSession.jobDescription,
        }),
        expect.objectContaining({ callbacks: expect.any(Array) }),
      );
      expect(tokenUsageService.recordUsage).toHaveBeenCalledWith(
        baseSession.userId,
        undefined,
      );
      expect(topicCoverageRepository.createMany).toHaveBeenCalledWith([
        {
          userId: baseSession.userId,
          sessionId: baseSession.id,
          topic: "Caching",
          angle: "Redis trade-offs",
        },
      ]);
      expect(topicCoverageRepository.pruneOldestBeyondLimit).toHaveBeenCalledWith(
        baseSession.userId,
        TOPIC_COVERAGE_RETENTION_PER_USER,
      );
      expect(result).toEqual({ status: "ready", sessionId: baseSession.id });
    });

    it("returns ready without persisting rows when the generator returns no items", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue(
        baseSession as never,
      );
      vi.mocked(messageRepository.listBySessionId).mockResolvedValue([] as never);
      vi.mocked(topicCoverageGenerator.generate).mockResolvedValue({ items: [] });

      const result = await service.process(baseSession.id);

      expect(topicCoverageRepository.createMany).not.toHaveBeenCalled();
      expect(topicCoverageRepository.pruneOldestBeyondLimit).toHaveBeenCalledWith(
        baseSession.userId,
        TOPIC_COVERAGE_RETENTION_PER_USER,
      );
      expect(result).toEqual({ status: "ready", sessionId: baseSession.id });
    });

    it("rethrows transient generator errors for BullMQ retry", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue(
        baseSession as never,
      );
      vi.mocked(messageRepository.listBySessionId).mockResolvedValue([] as never);
      const transientError = new Error("LLM timeout");
      vi.mocked(topicCoverageGenerator.generate).mockRejectedValue(transientError);

      await expect(service.process(baseSession.id)).rejects.toThrow(
        "LLM timeout",
      );
      expect(topicCoverageRepository.createMany).not.toHaveBeenCalled();
    });
  });
});
