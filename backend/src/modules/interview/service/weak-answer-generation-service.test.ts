import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IWeakAnswersGenerator } from "@/modules/interview/protocols/weak-answers-generator";
import type { MessageRepository } from "@/modules/interview/repository/message-repository";
import type { SessionRepository } from "@/modules/interview/repository/session-repository";
import type { WeakAnswerService } from "@/modules/interview/service/weak-answer-service";
import type { ResumeRepository } from "@/modules/resumes/repository/resume-repository";
import type { TokenUsageService } from "@/modules/token-usage/service/token-usage-service";
import { TokenLimitExceededError } from "@/shared";

import { WeakAnswerGenerationService } from "./weak-answer-generation-service";

vi.mock("@/modules/token-usage/callbacks/token-usage-callback", () => ({
  createUsageCaptureCallback: vi.fn(() => ({
    callback: {},
    getUsage: () => undefined,
  })),
}));

const structuredSummary = {
  personal_info: { name: "Jane Doe", title: "Engineer", about: "" },
  skills: ["TypeScript"],
  experiences: [],
  projects: [],
  certifications: [],
};

const baseSession = {
  id: "session-1",
  userId: 1,
  resumeId: "resume-1",
  level: "entry" as const,
  jobDescription: "Backend Engineer role",
  turnCount: 5,
  maxTurns: 5,
  isFinished: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("WeakAnswerGenerationService", () => {
  let sessionRepository: SessionRepository;
  let messageRepository: MessageRepository;
  let resumeRepository: ResumeRepository;
  let weakAnswersGenerator: IWeakAnswersGenerator;
  let weakAnswerService: WeakAnswerService;
  let tokenUsageService: TokenUsageService;
  let service: WeakAnswerGenerationService;

  beforeEach(() => {
    vi.clearAllMocks();

    sessionRepository = {
      findById: vi.fn(),
    } as unknown as SessionRepository;

    messageRepository = {
      listBySessionId: vi.fn(),
    } as unknown as MessageRepository;

    resumeRepository = {
      findById: vi.fn(),
    } as unknown as ResumeRepository;

    weakAnswersGenerator = {
      generate: vi.fn(),
    };

    weakAnswerService = {
      saveWeakAnswers: vi.fn(),
    } as unknown as WeakAnswerService;

    tokenUsageService = {
      assertWithinLimit: vi.fn().mockResolvedValue(undefined),
      recordUsage: vi.fn().mockResolvedValue(undefined),
      getUsage: vi.fn(),
    } as unknown as TokenUsageService;

    service = new WeakAnswerGenerationService(
      sessionRepository,
      messageRepository,
      resumeRepository,
      weakAnswersGenerator,
      weakAnswerService,
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
      expect(weakAnswersGenerator.generate).not.toHaveBeenCalled();
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
      expect(weakAnswersGenerator.generate).not.toHaveBeenCalled();
    });

    it("throws when the monthly token limit was reached", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue(
        baseSession as never,
      );
      vi.mocked(tokenUsageService.assertWithinLimit).mockRejectedValue(
        new TokenLimitExceededError(),
      );

      await expect(service.process(baseSession.id)).rejects.toBeInstanceOf(
        TokenLimitExceededError,
      );
      expect(weakAnswersGenerator.generate).not.toHaveBeenCalled();
    });

    it("skips when the session resume was deleted", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue({
        ...baseSession,
        resumeId: null,
      } as never);
      vi.mocked(messageRepository.listBySessionId).mockResolvedValue([]);

      const result = await service.process(baseSession.id);

      expect(result).toEqual({
        status: "skipped",
        sessionId: baseSession.id,
        reason: "resume_not_found",
      });
      expect(resumeRepository.findById).not.toHaveBeenCalled();
      expect(weakAnswersGenerator.generate).not.toHaveBeenCalled();
    });

    it("skips when the resume has no structured summary", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue(
        baseSession as never,
      );
      vi.mocked(messageRepository.listBySessionId).mockResolvedValue([]);
      vi.mocked(resumeRepository.findById).mockResolvedValue({
        id: "resume-1",
        structuredSummary: null,
      } as never);

      const result = await service.process(baseSession.id);

      expect(result).toEqual({
        status: "skipped",
        sessionId: baseSession.id,
        reason: "resume_not_found",
      });
      expect(weakAnswersGenerator.generate).not.toHaveBeenCalled();
    });

    it("generates and persists weak answers, then records token usage", async () => {
      vi.mocked(sessionRepository.findById).mockResolvedValue(
        baseSession as never,
      );
      vi.mocked(messageRepository.listBySessionId).mockResolvedValue([
        { id: "m1", role: "ai", content: "Tell me about yourself." },
        { id: "m2", role: "human", content: "I build APIs." },
      ] as never);
      vi.mocked(resumeRepository.findById).mockResolvedValue({
        id: "resume-1",
        structuredSummary,
      } as never);
      vi.mocked(weakAnswersGenerator.generate).mockResolvedValue({
        items: [
          {
            question: "Tell me about yourself.",
            userAnswer: "I build APIs.",
            evaluation: "insufficient",
            feedback: "Give more concrete examples.",
            topic: "Communication",
            priority: "medium",
          },
        ],
      });

      const result = await service.process(baseSession.id);

      expect(weakAnswersGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: baseSession.userId,
          sessionId: baseSession.id,
          transcript: "ai: Tell me about yourself.\nhuman: I build APIs.",
          structuredSummary,
          jobDescription: baseSession.jobDescription,
        }),
        expect.objectContaining({ callbacks: expect.any(Array) }),
      );
      expect(tokenUsageService.recordUsage).toHaveBeenCalledWith(
        baseSession.userId,
        undefined,
      );
      expect(weakAnswerService.saveWeakAnswers).toHaveBeenCalledWith(
        baseSession.userId,
        baseSession.id,
        [
          {
            question: "Tell me about yourself.",
            userAnswer: "I build APIs.",
            evaluation: "insufficient",
            feedback: "Give more concrete examples.",
            topic: "Communication",
            priority: "medium",
          },
        ],
      );
      expect(result).toEqual({ status: "ready", sessionId: baseSession.id });
    });
  });
});
