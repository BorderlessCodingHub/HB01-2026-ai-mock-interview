import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";

import type {
  IInterviewGraph,
  InterviewGraphStreamCompletion,
  InterviewGraphStreamToken,
} from "@/modules/interview/protocols/interview-graph";
import type { ICoverageExtractionQueue } from "@/modules/interview/protocols/coverage-extraction-queue";
import type { IReviewGenerationQueue } from "@/modules/interview/protocols/review-generation-queue";
import type { IWeakAnswerQueue } from "@/modules/interview/protocols/weak-answer-queue";
import type { MessageRepository } from "@/modules/interview/repository/message-repository";
import type { ReviewRepository } from "@/modules/interview/repository/review-repository";
import type { SessionRepository } from "@/modules/interview/repository/session-repository";
import type { ResumeRepository } from "@/modules/resumes/repository/resume-repository";
import type { TokenUsageService } from "@/modules/token-usage/service/token-usage-service";
import { ConflictError, NotFoundError, TokenLimitExceededError } from "@/shared";

import type { SoftCoveragePromptLoader } from "./soft-coverage-prompt-loader";
import { InterviewStreamService } from "./stream-service";

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
  turnCount: 0,
  maxTurns: 5,
  isFinished: false,
  reviewGenerationStatus: "idle" as const,
  reviewGenerationError: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function createMockResponse() {
  const listeners = new Map<string, Set<() => void>>();
  const chunks: string[] = [];

  const res = {
    writeHead: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => {
      chunks.push(chunk);
    }),
    end: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => {
      const set = listeners.get(event) ?? new Set();
      set.add(handler);
      listeners.set(event, set);
    }),
    off: vi.fn((event: string, handler: () => void) => {
      listeners.get(event)?.delete(handler);
    }),
    emitClose: () => {
      for (const handler of listeners.get("close") ?? []) {
        handler();
      }
    },
    chunks,
  };

  return res as unknown as Response & {
    writeHead: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    emitClose: () => void;
    chunks: string[];
  };
}

describe("InterviewStreamService", () => {
  let sessionRepository: SessionRepository;
  let messageRepository: MessageRepository;
  let resumeRepository: ResumeRepository;
  let graph: IInterviewGraph;
  let reviewGenerationQueue: IReviewGenerationQueue;
  let weakAnswerQueue: IWeakAnswerQueue;
  let coverageExtractionQueue: ICoverageExtractionQueue;
  let softCoveragePromptLoader: SoftCoveragePromptLoader;
  let tokenUsageService: TokenUsageService;
  let reviewRepository: ReviewRepository;
  let service: InterviewStreamService;

  beforeEach(() => {
    sessionRepository = {
      findByIdAndUserId: vi.fn(),
      incrementTurnCount: vi.fn(),
      markFinished: vi.fn(),
      markReviewGenerationFailed: vi.fn(),
    } as unknown as SessionRepository;

    messageRepository = {
      createHuman: vi.fn(),
      createAi: vi.fn(),
      listBySessionId: vi.fn(),
    } as unknown as MessageRepository;

    resumeRepository = {
      findByIdAndUserId: vi.fn(),
    } as unknown as ResumeRepository;

    graph = {
      streamMessages: vi.fn(),
    };

    reviewGenerationQueue = {
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    weakAnswerQueue = {
      add: vi.fn().mockResolvedValue(undefined),
    };

    coverageExtractionQueue = {
      add: vi.fn().mockResolvedValue(undefined),
    };

    softCoveragePromptLoader = {
      loadSoftCoverageHints: vi.fn().mockResolvedValue({
        coverage: [],
        activeReviews: [],
      }),
    } as unknown as SoftCoveragePromptLoader;

    tokenUsageService = {
      assertWithinLimit: vi.fn().mockResolvedValue(undefined),
      recordUsage: vi.fn().mockResolvedValue(undefined),
      getUsage: vi.fn(),
    } as unknown as TokenUsageService;

    reviewRepository = {
      listByUserId: vi.fn().mockResolvedValue([]),
    } as unknown as ReviewRepository;

    service = new InterviewStreamService(
      sessionRepository,
      messageRepository,
      resumeRepository,
      graph,
      reviewGenerationQueue,
      weakAnswerQueue,
      coverageExtractionQueue,
      softCoveragePromptLoader,
      tokenUsageService,
      reviewRepository,
    );
  });

  it("throws TokenLimitExceededError before SSE when monthly token limit is reached", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue(
      baseSession,
    );
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(tokenUsageService.assertWithinLimit).mockRejectedValue(
      new TokenLimitExceededError(),
    );

    const res = createMockResponse();

    await expect(
      service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res),
    ).rejects.toBeInstanceOf(TokenLimitExceededError);

    expect(res.writeHead).not.toHaveBeenCalled();
    expect(graph.streamMessages).not.toHaveBeenCalled();
  });

  it("throws ConflictError before SSE when session is finished", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue({
      ...baseSession,
      isFinished: true,
    });

    const res = createMockResponse();

    await expect(
      service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it("throws ConflictError before SSE when turnCount >= maxTurns", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
      maxTurns: 5,
    });

    const res = createMockResponse();

    await expect(
      service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(res.writeHead).not.toHaveBeenCalled();
  });

    it("throws NotFoundError when session does not belong to user", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue(null);

    const res = createMockResponse();

    await expect(
      service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when the session resume was deleted", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue({
      ...baseSession,
      resumeId: null,
    });

    const res = createMockResponse();

    await expect(
      service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(resumeRepository.findByIdAndUserId).not.toHaveBeenCalled();
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it("streams tokens, meta, and DONE on success", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue(
      baseSession,
    );
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* () {
        yield { content: "Hi " };
        yield { content: "there" };
        return { content: "Hi there" };
      })(),
    );
    vi.mocked(sessionRepository.incrementTurnCount).mockResolvedValue({
      ...baseSession,
      turnCount: 1,
    });
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);
    vi.mocked(messageRepository.createAi).mockResolvedValue({} as never);

    const res = createMockResponse();

    await service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res);

    expect(graph.streamMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        runReview: false,
        jobDescription: "Backend Engineer role",
        interviewLocale: "en",
        coveredAngles: [],
      }),
      expect.objectContaining({
        threadId: baseSession.id,
        callbacks: expect.any(Array),
      }),
    );

    const output = res.chunks.join("");
    expect(output).toContain("event: token");
    expect(output).toContain('"content":"Hi "');
    expect(output).toContain("event: meta");
    expect(output).toContain('"turnCount":1');
    expect(output).not.toContain("reviewGenerationStatus");
    expect(output).toContain("data: [DONE]");
    expect(messageRepository.createAi).toHaveBeenCalledWith({
      sessionId: baseSession.id,
      userId: 1,
      content: "Hi there",
    });
    expect(tokenUsageService.recordUsage).toHaveBeenCalled();
    expect(reviewGenerationQueue.add).not.toHaveBeenCalled();
    expect(sessionRepository.markFinished).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });

  it("passes covered angles from review items into the interview graph", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue(
      baseSession,
    );
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(reviewRepository.listByUserId).mockResolvedValue([
      {
        id: "item-1",
        userId: 1,
        sessionId: "old",
        topic: "caching",
        angle: "write-path invalidation",
        description: "Practice invalidation",
        priority: "high",
        status: "active",
        learnedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* () {
        yield { content: "Q?" };
        return { content: "Q?" };
      })(),
    );
    vi.mocked(sessionRepository.incrementTurnCount).mockResolvedValue({
      ...baseSession,
      turnCount: 1,
    });
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);
    vi.mocked(messageRepository.createAi).mockResolvedValue({} as never);

    const res = createMockResponse();

    await service.streamTurn(
      1,
      baseSession.id,
      { content: "Hello", interviewLocale: "en" },
      res,
    );

    expect(reviewRepository.listByUserId).toHaveBeenCalledWith(1);
    expect(graph.streamMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        coveredAngles: [
          { topic: "caching", angle: "write-path invalidation" },
        ],
      }),
      expect.any(Object),
    );
  });

  it("does not include reviewGenerationStatus or enqueue on mid-turn", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue(
      baseSession,
    );
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* () {
        yield { content: "Ok" };
        return { content: "Ok" };
      })(),
    );
    vi.mocked(sessionRepository.incrementTurnCount).mockResolvedValue({
      ...baseSession,
      turnCount: 1,
    });
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);
    vi.mocked(messageRepository.createAi).mockResolvedValue({} as never);

    const res = createMockResponse();

    await service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res);

    const output = res.chunks.join("");
    expect(output).toContain("event: meta");
    expect(output).toContain('"isFinished":false');
    expect(output).not.toContain("reviewGenerationStatus");
    expect(reviewGenerationQueue.add).not.toHaveBeenCalled();
    expect(sessionRepository.markFinished).not.toHaveBeenCalled();
    expect(tokenUsageService.assertWithinLimit).toHaveBeenCalledTimes(1);
  });

  it("marks finished, enqueues review generation, and includes pending status on final turn", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue({
      ...baseSession,
      turnCount: 4,
      maxTurns: 5,
    });
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* () {
        yield { content: "Final answer" };
        return { content: "Final answer" };
      })(),
    );
    vi.mocked(sessionRepository.incrementTurnCount).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
    });
    vi.mocked(sessionRepository.markFinished).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
      isFinished: true,
      reviewGenerationStatus: "pending",
    });
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);
    vi.mocked(messageRepository.createAi).mockResolvedValue({} as never);

    const res = createMockResponse();

    await service.streamTurn(
      1,
      baseSession.id,
      { content: "Hello", interviewLocale: "pt" },
      res,
    );

    expect(graph.streamMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        runReview: true,
        interviewLocale: "pt",
        coveredAngles: [],
      }),
      expect.objectContaining({
        threadId: baseSession.id,
        callbacks: expect.any(Array),
      }),
    );
    expect(sessionRepository.markFinished).toHaveBeenCalledWith(
      baseSession.id,
      "pt",
    );
    expect(reviewGenerationQueue.add).toHaveBeenCalledWith({
      sessionId: baseSession.id,
    });
    expect(weakAnswerQueue.add).toHaveBeenCalledWith({
      sessionId: baseSession.id,
    });
    expect(messageRepository.listBySessionId).not.toHaveBeenCalled();
    expect(sessionRepository.markReviewGenerationFailed).not.toHaveBeenCalled();
    expect(tokenUsageService.assertWithinLimit).toHaveBeenCalledTimes(1);

    const output = res.chunks.join("");
    expect(output).toContain("event: meta");
    expect(output).toContain('"isFinished":true');
    expect(output).toContain('"reviewGenerationStatus":"pending"');
    expect(output).toContain("data: [DONE]");
    expect(output).not.toContain("event: error");
  });

  it("marks review generation failed and still finishes chat when enqueue fails", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue({
      ...baseSession,
      turnCount: 4,
      maxTurns: 5,
    });
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* () {
        yield { content: "Final answer" };
        return { content: "Final answer" };
      })(),
    );
    vi.mocked(sessionRepository.incrementTurnCount).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
    });
    vi.mocked(sessionRepository.markFinished).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
      isFinished: true,
      reviewGenerationStatus: "pending",
    });
    vi.mocked(sessionRepository.markReviewGenerationFailed).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
      isFinished: true,
      reviewGenerationStatus: "failed",
      reviewGenerationError: "Redis unavailable",
    });
    vi.mocked(reviewGenerationQueue.add).mockRejectedValue(
      new Error("Redis unavailable"),
    );
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);
    vi.mocked(messageRepository.createAi).mockResolvedValue({} as never);

    const res = createMockResponse();

    await service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res);

    expect(sessionRepository.markFinished).toHaveBeenCalledWith(
      baseSession.id,
      "en",
    );
    expect(reviewGenerationQueue.add).toHaveBeenCalledWith({
      sessionId: baseSession.id,
    });
    expect(sessionRepository.markReviewGenerationFailed).toHaveBeenCalledWith(
      baseSession.id,
      "Redis unavailable",
    );
    expect(weakAnswerQueue.add).toHaveBeenCalledWith({
      sessionId: baseSession.id,
    });

    const output = res.chunks.join("");
    expect(output).toContain("event: meta");
    expect(output).toContain('"isFinished":true');
    expect(output).toContain('"reviewGenerationStatus":"failed"');
    expect(output).toContain("data: [DONE]");
    expect(output).not.toContain("event: error");
  });

  it("still finishes the turn when the weak-answer queue enqueue fails", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue({
      ...baseSession,
      turnCount: 4,
      maxTurns: 5,
    });
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* () {
        yield { content: "Final answer" };
        return { content: "Final answer" };
      })(),
    );
    vi.mocked(sessionRepository.incrementTurnCount).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
    });
    vi.mocked(sessionRepository.markFinished).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
      isFinished: true,
      reviewGenerationStatus: "pending",
    });
    vi.mocked(weakAnswerQueue.add).mockRejectedValue(
      new Error("Redis unavailable"),
    );
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);
    vi.mocked(messageRepository.createAi).mockResolvedValue({} as never);

    const res = createMockResponse();

    await service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res);

    expect(reviewGenerationQueue.add).toHaveBeenCalledWith({
      sessionId: baseSession.id,
    });
    expect(sessionRepository.markReviewGenerationFailed).not.toHaveBeenCalled();

    const output = res.chunks.join("");
    expect(output).toContain("event: meta");
    expect(output).toContain('"isFinished":true');
    expect(output).toContain('"reviewGenerationStatus":"pending"');
    expect(output).toContain("data: [DONE]");
    expect(output).not.toContain("event: error");
  });

  it("does not await review generation work on final turn beyond enqueue", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue({
      ...baseSession,
      turnCount: 4,
      maxTurns: 5,
    });
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* () {
        yield { content: "Final answer" };
        return { content: "Final answer" };
      })(),
    );
    vi.mocked(sessionRepository.incrementTurnCount).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
    });
    vi.mocked(sessionRepository.markFinished).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
      isFinished: true,
      reviewGenerationStatus: "pending",
    });
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);
    vi.mocked(messageRepository.createAi).mockResolvedValue({} as never);

    const res = createMockResponse();

    await service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res);

    expect(messageRepository.listBySessionId).not.toHaveBeenCalled();
    expect(tokenUsageService.assertWithinLimit).toHaveBeenCalledTimes(1);
    expect(tokenUsageService.recordUsage).toHaveBeenCalledTimes(1);
    expect(reviewGenerationQueue.add).toHaveBeenCalledTimes(1);
    expect(sessionRepository.markFinished).toHaveBeenCalledTimes(1);

    const output = res.chunks.join("");
    expect(output).toContain('"reviewGenerationStatus":"pending"');
    expect(output).toContain('"isFinished":true');
  });

  it("does not persist partial AI message when client disconnects", async () => {
    let resumeSecondChunk: () => void = () => undefined;

    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue(
      baseSession,
    );
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* (): AsyncGenerator<
        InterviewGraphStreamToken,
        InterviewGraphStreamCompletion | undefined
      > {
        yield { content: "Partial" };
        await new Promise<void>((resolve) => {
          resumeSecondChunk = resolve;
        });
        yield { content: "More" };
        return undefined;
      })(),
    );
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);

    const res = createMockResponse();

    const streamPromise = service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res);

    await vi.waitFor(() => {
      expect(res.chunks.join("")).toContain("Partial");
    });
    res.emitClose();
    resumeSecondChunk();
    await streamPromise;

    expect(messageRepository.createAi).not.toHaveBeenCalled();
    expect(sessionRepository.incrementTurnCount).not.toHaveBeenCalled();
    expect(reviewGenerationQueue.add).not.toHaveBeenCalled();
  });

  it("loads soft coverage hints and passes them to streamMessages each turn", async () => {
    const hints = {
      coverage: [{ topic: "PostgreSQL", angle: "indexing", createdAt: new Date() }],
      activeReviews: [
        { topic: "Caching", priority: "high" as const, description: "Redis" },
      ],
    };

    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue(
      baseSession,
    );
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(softCoveragePromptLoader.loadSoftCoverageHints).mockResolvedValue(
      hints,
    );
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* () {
        yield { content: "Ok" };
        return { content: "Ok" };
      })(),
    );
    vi.mocked(sessionRepository.incrementTurnCount).mockResolvedValue({
      ...baseSession,
      turnCount: 1,
    });
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);
    vi.mocked(messageRepository.createAi).mockResolvedValue({} as never);

    const res = createMockResponse();

    await service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res);

    expect(softCoveragePromptLoader.loadSoftCoverageHints).toHaveBeenCalledWith(1);
    expect(graph.streamMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        recentCoverage: [{ topic: "PostgreSQL", angle: "indexing" }],
        activeReviewTopics: [
          { topic: "Caching", priority: "high", description: "Redis" },
        ],
      }),
      expect.any(Object),
    );
    expect(coverageExtractionQueue.add).not.toHaveBeenCalled();
  });

  it("does not enqueue coverage extraction on mid-turn", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue(
      baseSession,
    );
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* () {
        yield { content: "Ok" };
        return { content: "Ok" };
      })(),
    );
    vi.mocked(sessionRepository.incrementTurnCount).mockResolvedValue({
      ...baseSession,
      turnCount: 1,
    });
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);
    vi.mocked(messageRepository.createAi).mockResolvedValue({} as never);

    const res = createMockResponse();

    await service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res);

    expect(coverageExtractionQueue.add).not.toHaveBeenCalled();
  });

  it("enqueues coverage extraction on final turn after weak-answer enqueue", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue({
      ...baseSession,
      turnCount: 4,
      maxTurns: 5,
    });
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* () {
        yield { content: "Final answer" };
        return { content: "Final answer" };
      })(),
    );
    vi.mocked(sessionRepository.incrementTurnCount).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
    });
    vi.mocked(sessionRepository.markFinished).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
      isFinished: true,
      reviewGenerationStatus: "pending",
    });
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);
    vi.mocked(messageRepository.createAi).mockResolvedValue({} as never);

    const res = createMockResponse();

    await service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res);

    expect(weakAnswerQueue.add).toHaveBeenCalledWith({
      sessionId: baseSession.id,
    });
    expect(coverageExtractionQueue.add).toHaveBeenCalledWith({
      sessionId: baseSession.id,
    });
  });

  it("continues with empty hints when soft coverage load fails", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue(
      baseSession,
    );
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(softCoveragePromptLoader.loadSoftCoverageHints).mockRejectedValue(
      new Error("DB unavailable"),
    );
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* () {
        yield { content: "Ok" };
        return { content: "Ok" };
      })(),
    );
    vi.mocked(sessionRepository.incrementTurnCount).mockResolvedValue({
      ...baseSession,
      turnCount: 1,
    });
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);
    vi.mocked(messageRepository.createAi).mockResolvedValue({} as never);

    const res = createMockResponse();

    await service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res);

    expect(graph.streamMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        recentCoverage: [],
        activeReviewTopics: [],
      }),
      expect.any(Object),
    );

    const output = res.chunks.join("");
    expect(output).toContain("data: [DONE]");
    expect(output).not.toContain("event: error");
  });

  it("still finishes the turn when coverage extraction enqueue fails", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue({
      ...baseSession,
      turnCount: 4,
      maxTurns: 5,
    });
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* () {
        yield { content: "Final answer" };
        return { content: "Final answer" };
      })(),
    );
    vi.mocked(sessionRepository.incrementTurnCount).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
    });
    vi.mocked(sessionRepository.markFinished).mockResolvedValue({
      ...baseSession,
      turnCount: 5,
      isFinished: true,
      reviewGenerationStatus: "pending",
    });
    vi.mocked(coverageExtractionQueue.add).mockRejectedValue(
      new Error("Redis unavailable"),
    );
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);
    vi.mocked(messageRepository.createAi).mockResolvedValue({} as never);

    const res = createMockResponse();

    await service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res);

    expect(coverageExtractionQueue.add).toHaveBeenCalledWith({
      sessionId: baseSession.id,
    });

    const output = res.chunks.join("");
    expect(output).toContain("event: meta");
    expect(output).toContain('"isFinished":true');
    expect(output).toContain("data: [DONE]");
    expect(output).not.toContain("event: error");
  });

  it("emits error SSE event and DONE when graph stream fails", async () => {
    vi.mocked(sessionRepository.findByIdAndUserId).mockResolvedValue(
      baseSession,
    );
    vi.mocked(resumeRepository.findByIdAndUserId).mockResolvedValue({
      id: "resume-1",
      structuredSummary,
    } as unknown as Awaited<ReturnType<ResumeRepository["findByIdAndUserId"]>>);
    vi.mocked(graph.streamMessages).mockReturnValue(
      (async function* () {
        yield { content: "Partial" };
        throw new Error("OpenAI rate limit");
      })(),
    );
    vi.mocked(messageRepository.createHuman).mockResolvedValue({} as never);

    const res = createMockResponse();

    await service.streamTurn(1, baseSession.id, { content: "Hello", interviewLocale: "en" }, res);

    const output = res.chunks.join("");
    expect(output).toContain("event: token");
    expect(output).toContain("event: error");
    expect(output).toContain('"message":"OpenAI rate limit"');
    expect(output).toContain("data: [DONE]");
    expect(messageRepository.createAi).not.toHaveBeenCalled();
    expect(reviewGenerationQueue.add).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });
});
