import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IReviewGenerationQueue } from "@/modules/interview/protocols/review-generation-queue";
import type { IReviewItemsGenerator } from "@/modules/interview/protocols/review-items-generator";
import type { MessageRepository } from "@/modules/interview/repository/message-repository";
import type { SessionRepository } from "@/modules/interview/repository/session-repository";
import type { ReviewMergeService } from "@/modules/interview/service/review-merge-service";
import type { ResumeRepository } from "@/modules/resumes/repository/resume-repository";
import type { TokenUsageService } from "@/modules/token-usage/service/token-usage-service";
import { ConflictError, NotFoundError, TokenLimitExceededError } from "@/shared";

import { ReviewGenerationService } from "./review-generation-service";

vi.mock("@/modules/token-usage/callbacks/token-usage-callback", () => ({
  createUsageCaptureCallback: vi.fn(() => ({
    callback: {},
    getUsage: () => undefined,
  })),
}));

const structuredSummary = {
  personal_info: {
    name: "Jane Doe",
    title: "Engineer",
    about: "",
  },
  skills: ["TypeScript"],
  experiences: [
    {
      company: "Acme",
      role: "Developer",
      highlights: ["Built APIs"],
    },
  ],
  projects: [
    {
      name: "Portfolio",
      description: "",
      technologies: [],
      highlights: [],
    },
  ],
  certifications: [],
};

const baseSession = {
  id: "session-1",
  userId: 1,
  resumeId: "resume-1",
  resumeName: "resume.pdf",
  level: "entry" as const,
  jobDescription: "Backend Engineer role",
  interviewLocale: "en" as const,
  turnCount: 5,
  maxTurns: 5,
  isFinished: true,
  reviewGenerationStatus: "pending" as const,
  reviewGenerationError: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("ReviewGenerationService", () => {
  let sessionRepository: SessionRepository;
  let messageRepository: MessageRepository;
  let resumeRepository: ResumeRepository;
  let reviewItemsGenerator: IReviewItemsGenerator;
  let reviewMergeService: ReviewMergeService;
  let tokenUsageService: TokenUsageService;
  let reviewGenerationQueue: IReviewGenerationQueue;
  let service: ReviewGenerationService;

  beforeEach(() => {
    vi.clearAllMocks();

    sessionRepository = {
      findById: vi.fn(),
      findByIdAndUserId: vi.fn(),
      markReviewGenerationFailed: vi.fn(),
      markReviewGenerationReady: vi.fn(),
      markReviewGenerationPending: vi.fn(),
    } as unknown as SessionRepository;

    messageRepository = {
      listBySessionId: vi.fn(),
    } as unknown as MessageRepository;

    resumeRepository = {
      findById: vi.fn(),
    } as unknown as ResumeRepository;

    reviewItemsGenerator = {
      generate: vi.fn(),
    };

    reviewMergeService = {
      insertNewTopicsOnly: vi.fn(),
    } as unknown as ReviewMergeService;

    tokenUsageService = {
      assertWithinLimit: vi.fn().mockResolvedValue(undefined),
      recordUsage: vi.fn().mockResolvedValue(undefined),
      getUsage: vi.fn(),
    } as unknown as TokenUsageService;

    reviewGenerationQueue = {
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    service = new ReviewGenerationService(
      sessionRepository,
      messageRepository,
      resumeRepository,
      reviewItemsGenerator,
      reviewMergeService,
      tokenUsageService,
      reviewGenerationQueue,
    );
  });

  describe("process", () => {
    function mockHappyPathDeps(
      items: Array<{
        topic: string;
        angle: string;
        description: string;
        priority: "low" | "medium" | "high";
      }> = [
        {
          topic: "Communication",
          angle: "conciseness under pressure",
          description: "Be concise",
          priority: "medium",
        },
      ],
    ) {
      vi.mocked(sessionRepository.findById).mockResolvedValue(baseSession);
      vi.mocked(messageRepository.listBySessionId).mockResolvedValue([
        {
          id: "m1",
          sessionId: baseSession.id,
          userId: 1,
          role: "human",
          content: "Hello",
          createdAt: new Date(),
        },
        {
          id: "m2",
          sessionId: baseSession.id,
          userId: 1,
          role: "ai",
          content: "Hi there",
          createdAt: new Date(),
        },
      ] as Awaited<ReturnType<MessageRepository["listBySessionId"]>>);
      vi.mocked(resumeRepository.findById).mockResolvedValue({
        id: "resume-1",
        structuredSummary,
      } as unknown as Awaited<ReturnType<ResumeRepository["findById"]>>);
      vi.mocked(reviewItemsGenerator.generate).mockResolvedValue({ items });
      vi.mocked(reviewMergeService.insertNewTopicsOnly).mockResolvedValue(
        undefined,
      );
      vi.mocked(sessionRepository.markReviewGenerationReady).mockResolvedValue({
        ...baseSession,
        reviewGenerationStatus: "ready",
      });
    }

    it("marks ready after generate and merge", async () => {
      mockHappyPathDeps();

      const result = await service.process(baseSession.id);

      expect(result).toEqual({ status: "ready", sessionId: baseSession.id });
      expect(tokenUsageService.assertWithinLimit).toHaveBeenCalledWith(1);
      expect(reviewItemsGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          sessionId: baseSession.id,
          transcript: "human: Hello\nai: Hi there",
          structuredSummary,
          interviewLocale: "en",
          jobDescription: baseSession.jobDescription,
        }),
        expect.objectContaining({ callbacks: expect.any(Array) }),
      );
      expect(reviewMergeService.insertNewTopicsOnly).toHaveBeenCalledWith(
        1,
        baseSession.id,
        [
          {
            topic: "Communication",
            angle: "conciseness under pressure",
            description: "Be concise",
            priority: "medium",
          },
        ],
      );
      expect(tokenUsageService.recordUsage).toHaveBeenCalledWith(1, undefined);
      expect(sessionRepository.markReviewGenerationReady).toHaveBeenCalledWith(
        baseSession.id,
      );
    });

    it("marks ready when generator returns empty items", async () => {
      mockHappyPathDeps([]);

      const result = await service.process(baseSession.id);

      expect(result).toEqual({ status: "ready", sessionId: baseSession.id });
      expect(reviewMergeService.insertNewTopicsOnly).toHaveBeenCalledWith(
        1,
        baseSession.id,
        [],
      );
      expect(sessionRepository.markReviewGenerationReady).toHaveBeenCalledWith(
        baseSession.id,
      );
    });

    it("marks failed with retryable false on quota exceeded without throwing", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue(baseSession);
      const quotaError = new TokenLimitExceededError();
      vi.mocked(tokenUsageService.assertWithinLimit).mockRejectedValue(
        quotaError,
      );
      vi.mocked(sessionRepository.markReviewGenerationFailed).mockResolvedValue(
        {
          ...baseSession,
          reviewGenerationStatus: "failed",
          reviewGenerationError: quotaError.message,
        },
      );

      const result = await service.process(baseSession.id);

      expect(result).toEqual({
        status: "failed",
        sessionId: baseSession.id,
        error: quotaError.message,
        cause: quotaError,
        retryable: false,
      });
      expect(sessionRepository.markReviewGenerationFailed).toHaveBeenCalledWith(
        baseSession.id,
        quotaError.message,
      );
      expect(reviewItemsGenerator.generate).not.toHaveBeenCalled();
      expect(sessionRepository.markReviewGenerationReady).not.toHaveBeenCalled();
    });

    it("rethrows transient errors and leaves status pending", async () => {
      mockHappyPathDeps();
      const transient = new Error("LLM timeout");
      vi.mocked(reviewItemsGenerator.generate).mockRejectedValue(transient);

      await expect(service.process(baseSession.id)).rejects.toThrow(transient);

      expect(sessionRepository.markReviewGenerationReady).not.toHaveBeenCalled();
      expect(sessionRepository.markReviewGenerationFailed).not.toHaveBeenCalled();
    });

    it("skips when session is missing", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue(null);

      const result = await service.process("missing-id");

      expect(result).toEqual({
        status: "skipped",
        sessionId: "missing-id",
        reason: "not_found",
      });
      expect(tokenUsageService.assertWithinLimit).not.toHaveBeenCalled();
    });

    it("skips when session is not finished", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue({
        ...baseSession,
        isFinished: false,
        turnCount: 2,
      });

      const result = await service.process(baseSession.id);

      expect(result).toEqual({
        status: "skipped",
        sessionId: baseSession.id,
        reason: "not_finished",
      });
      expect(tokenUsageService.assertWithinLimit).not.toHaveBeenCalled();
    });

    it("marks failed when the session resume was deleted", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue({
        ...baseSession,
        resumeId: null,
      });
      vi.mocked(messageRepository.listBySessionId).mockResolvedValue([]);
      vi.mocked(sessionRepository.markReviewGenerationFailed).mockResolvedValue({
        ...baseSession,
        resumeId: null,
        reviewGenerationStatus: "failed",
        reviewGenerationError: "Resume not found",
      });

      const result = await service.process(baseSession.id);

      expect(result).toEqual({
        status: "failed",
        sessionId: baseSession.id,
        error: "Resume not found",
        retryable: false,
      });
      expect(sessionRepository.markReviewGenerationFailed).toHaveBeenCalledWith(
        baseSession.id,
        "Resume not found",
      );
      expect(resumeRepository.findById).not.toHaveBeenCalled();
      expect(reviewItemsGenerator.generate).not.toHaveBeenCalled();
    });

    it("marks failed when the resume has no structured summary", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue(baseSession);
      vi.mocked(messageRepository.listBySessionId).mockResolvedValue([]);
      vi.mocked(resumeRepository.findById).mockResolvedValue({
        id: "resume-1",
        structuredSummary: null,
      } as unknown as Awaited<ReturnType<ResumeRepository["findById"]>>);
      vi.mocked(sessionRepository.markReviewGenerationFailed).mockResolvedValue({
        ...baseSession,
        reviewGenerationStatus: "failed",
        reviewGenerationError: "Resume structured summary not found",
      });

      const result = await service.process(baseSession.id);

      expect(result).toEqual({
        status: "failed",
        sessionId: baseSession.id,
        error: "Resume structured summary not found",
        retryable: false,
      });
      expect(reviewItemsGenerator.generate).not.toHaveBeenCalled();
    });

    it("skips when review generation is already ready", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue({
        ...baseSession,
        reviewGenerationStatus: "ready",
      });

      const result = await service.process(baseSession.id);

      expect(result).toEqual({
        status: "skipped",
        sessionId: baseSession.id,
        reason: "already_ready",
      });
      expect(tokenUsageService.assertWithinLimit).not.toHaveBeenCalled();
    });
  });

  describe("enqueueForSession", () => {
    it("returns pending when queue add succeeds", async () => {
      vi.mocked(sessionRepository.markReviewGenerationPending).mockResolvedValue(
        {
          ...baseSession,
          reviewGenerationStatus: "pending",
        },
      );

      const result = await service.enqueueForSession(baseSession.id);

      expect(result).toBe("pending");
      expect(sessionRepository.markReviewGenerationPending).toHaveBeenCalledWith(
        baseSession.id,
      );
      expect(reviewGenerationQueue.add).toHaveBeenCalledWith({
        sessionId: baseSession.id,
      });
      expect(
        sessionRepository.markReviewGenerationFailed,
      ).not.toHaveBeenCalled();
    });

    it("returns failed when queue add fails", async () => {
      vi.mocked(sessionRepository.markReviewGenerationPending).mockResolvedValue(
        {
          ...baseSession,
          reviewGenerationStatus: "pending",
        },
      );
      vi.mocked(reviewGenerationQueue.add).mockRejectedValue(
        new Error("Redis unavailable"),
      );
      vi.mocked(sessionRepository.markReviewGenerationFailed).mockResolvedValue(
        {
          ...baseSession,
          reviewGenerationStatus: "failed",
          reviewGenerationError: "Redis unavailable",
        },
      );

      const result = await service.enqueueForSession(baseSession.id);

      expect(result).toBe("failed");
      expect(sessionRepository.markReviewGenerationFailed).toHaveBeenCalledWith(
        baseSession.id,
        "Redis unavailable",
      );
    });
  });

  describe("retry", () => {
    it("re-enqueues when session is finished and failed", async () => {
      const failedSession = {
        ...baseSession,
        reviewGenerationStatus: "failed" as const,
        reviewGenerationError: "previous error",
      };
      const pendingSession = {
        ...failedSession,
        reviewGenerationStatus: "pending" as const,
        reviewGenerationError: null,
      };

      vi.mocked(sessionRepository.findByIdAndUserId)
        .mockResolvedValueOnce(failedSession)
        .mockResolvedValueOnce(pendingSession);
      vi.mocked(sessionRepository.markReviewGenerationPending).mockResolvedValue(
        pendingSession,
      );

      const result = await service.retry(1, baseSession.id);

      expect(reviewGenerationQueue.remove).toHaveBeenCalledWith(baseSession.id);
      expect(sessionRepository.markReviewGenerationPending).toHaveBeenCalledWith(
        baseSession.id,
      );
      expect(reviewGenerationQueue.add).toHaveBeenCalledWith({
        sessionId: baseSession.id,
      });
      expect(result).toEqual({
        id: baseSession.id,
        resumeId: baseSession.resumeId,
        resumeName: baseSession.resumeName,
        level: baseSession.level,
        turnCount: baseSession.turnCount,
        maxTurns: baseSession.maxTurns,
        isFinished: true,
        hasJobDescription: true,
        createdAt: baseSession.createdAt,
        reviewGenerationStatus: "pending",
        reviewGenerationError: null,
      });
    });

    it("throws ConflictError when status is ready", async () => {
      vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue({
        ...baseSession,
        reviewGenerationStatus: "ready",
      });

      await expect(service.retry(1, baseSession.id)).rejects.toBeInstanceOf(
        ConflictError,
      );
      expect(reviewGenerationQueue.remove).not.toHaveBeenCalled();
      expect(reviewGenerationQueue.add).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when session belongs to another user", async () => {
      vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue(null);

      await expect(service.retry(99, baseSession.id)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(reviewGenerationQueue.remove).not.toHaveBeenCalled();
    });
  });
});
