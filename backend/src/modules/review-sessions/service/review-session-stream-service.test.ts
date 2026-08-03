import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";

import type { IReviewSessionEvaluator } from "@/modules/review-sessions/protocols/review-session-evaluator";
import type { IReviewSessionQuestionGenerator } from "@/modules/review-sessions/protocols/review-session-question-generator";
import type { ReviewSessionRepository } from "@/modules/review-sessions/repository/review-session-repository";
import type {
  ReviewSessionItemRecord,
  ReviewSessionRecord,
} from "@/modules/review-sessions/types/review-session-record";
import type { TokenUsageService } from "@/modules/token-usage/service/token-usage-service";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/shared";

import { ReviewSessionStreamService } from "./review-session-stream-service";

vi.mock("@/config/env", () => ({
  env: {
    REVIEW_SESSION_QUESTION_COUNT: 3,
  },
}));

const baseDate = new Date("2026-01-01T00:00:00.000Z");
const QUESTION_COUNT = 3;

function createSessionItem(
  overrides: Partial<ReviewSessionItemRecord> & { id: string },
): ReviewSessionItemRecord {
  return {
    reviewSessionId: "review-session-id",
    reviewItemId: `review-item-${overrides.order ?? 0}`,
    order: overrides.order ?? 0,
    topic: overrides.topic ?? "system design",
    angle: overrides.angle ?? "sharding strategies",
    description: overrides.description ?? "Need to study sharding",
    currentPriority: overrides.currentPriority ?? "high",
    turns: overrides.turns ?? [],
    pendingQuestion: overrides.pendingQuestion ?? null,
    suggestedStatus: overrides.suggestedStatus ?? null,
    suggestedPriority: overrides.suggestedPriority ?? null,
    confirmedStatus: overrides.confirmedStatus ?? null,
    confirmedPriority: overrides.confirmedPriority ?? null,
    confirmedAt: overrides.confirmedAt ?? null,
    createdAt: overrides.createdAt ?? baseDate,
    ...overrides,
  };
}

function createSession(
  overrides: Partial<ReviewSessionRecord> = {},
): ReviewSessionRecord {
  return {
    id: overrides.id ?? "review-session-id",
    userId: overrides.userId ?? 1,
    status: overrides.status ?? "in_progress",
    interviewLocale: overrides.interviewLocale ?? "en",
    createdAt: overrides.createdAt ?? baseDate,
    evaluatedAt: overrides.evaluatedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    items: overrides.items ?? [
      createSessionItem({ id: "session-item-1", order: 0 }),
    ],
  };
}

function createMockResponse() {
  const listeners = new Map<string, Set<() => void>>();
  const chunks: string[] = [];

  const res = {
    writableEnded: false,
    writeHead: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => {
      chunks.push(chunk);
    }),
    end: vi.fn(() => {
      res.writableEnded = true;
    }),
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
    writableEnded: boolean;
  };
}

function createQuestionStream(tokens: string[], content = tokens.join("")) {
  return async function* () {
    for (const token of tokens) {
      yield { content: token };
    }
    return { content };
  };
}

function createCompletedTurns(count: number, itemId: string) {
  return Array.from({ length: count }, (_, index) => ({
    question: `Q${index + 1} for ${itemId}`,
    answer: `A${index + 1} for ${itemId}`,
  }));
}

describe("ReviewSessionStreamService", () => {
  let reviewSessionRepository: ReviewSessionRepository;
  let questionGenerator: IReviewSessionQuestionGenerator;
  let evaluator: IReviewSessionEvaluator;
  let tokenUsageService: TokenUsageService;
  let service: ReviewSessionStreamService;

  beforeEach(() => {
    reviewSessionRepository = {
      findByIdAndUserId: vi.fn(),
      appendTurn: vi.fn(),
      setPendingQuestion: vi.fn(),
      saveSuggestions: vi.fn(),
      markPendingReview: vi.fn(),
    } as unknown as ReviewSessionRepository;

    questionGenerator = {
      streamQuestion: vi.fn(),
    };

    evaluator = {
      evaluate: vi.fn(),
    };

    tokenUsageService = {
      assertWithinLimit: vi.fn().mockResolvedValue(undefined),
      recordUsage: vi.fn().mockResolvedValue(undefined),
    } as unknown as TokenUsageService;

    service = new ReviewSessionStreamService(
      reviewSessionRepository,
      questionGenerator,
      evaluator,
      tokenUsageService,
    );
  });

  it("throws NotFoundError before SSE when session is missing", async () => {
    vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(null);

    const res = createMockResponse();

    await expect(
      service.streamTurn(1, "missing-session", { interviewLocale: "en" }, res),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it("throws ConflictError before SSE when session is pending_review", async () => {
    vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
      createSession({ status: "pending_review" }),
    );

    const res = createMockResponse();

    await expect(
      service.streamTurn(1, "review-session-id", { answer: "answer", interviewLocale: "en" }, res),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it("throws ConflictError before SSE when session is completed", async () => {
    vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
      createSession({ status: "completed" }),
    );

    const res = createMockResponse();

    await expect(
      service.streamTurn(1, "review-session-id", { answer: "answer", interviewLocale: "en" }, res),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it("throws BadRequestError before SSE when answer is required", async () => {
    vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
      createSession({
        items: [
          createSessionItem({
            id: "session-item-1",
            pendingQuestion: "What is sharding?",
          }),
        ],
      }),
    );

    const res = createMockResponse();

    await expect(
      service.streamTurn(1, "review-session-id", { interviewLocale: "en" }, res),
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it("streams first question, persists pendingQuestion, and emits progress meta", async () => {
    vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
      createSession(),
    );
    vi.mocked(questionGenerator.streamQuestion).mockReturnValue(
      createQuestionStream(["Can you ", "explain sharding?"])(),
    );

    const res = createMockResponse();

    await service.streamTurn(1, "review-session-id", { interviewLocale: "en" }, res);

    expect(questionGenerator.streamQuestion).toHaveBeenCalledWith(
      {
        topic: "system design",
        angle: "sharding strategies",
        description: "Need to study sharding",
        turns: [],
        interviewLocale: "en",
      },
      expect.objectContaining({ callbacks: expect.any(Array) }),
    );
    expect(reviewSessionRepository.setPendingQuestion).toHaveBeenCalledWith(
      "session-item-1",
      "Can you explain sharding?",
    );

    const output = res.chunks.join("");
    expect(output).toContain("event: token");
    expect(output).toContain('"content":"Can you "');
    expect(output).toContain("event: meta");
    expect(output).toContain('"reviewSessionItemId":"session-item-1"');
    expect(output).toContain('"itemIndex":0');
    expect(output).toContain('"turnsCompleted":0');
    expect(output).toContain(`"questionsPerItem":${QUESTION_COUNT}`);
    expect(output).toContain('"status":"in_progress"');
    expect(output).toContain("data: [DONE]");
    expect(tokenUsageService.recordUsage).toHaveBeenCalled();
    expect(reviewSessionRepository.appendTurn).not.toHaveBeenCalled();
  });

  it("appends a turn and streams the next question for the same item", async () => {
    vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
      createSession({
        items: [
          createSessionItem({
            id: "session-item-1",
            pendingQuestion: "What is sharding?",
            turns: [],
          }),
        ],
      }),
    );
    vi.mocked(questionGenerator.streamQuestion).mockReturnValue(
      createQuestionStream(["Follow-up question"])(),
    );

    const res = createMockResponse();

    await service.streamTurn(1, "review-session-id", { answer: "It splits data", interviewLocale: "en" }, res);

    expect(reviewSessionRepository.appendTurn).toHaveBeenCalledWith(
      "session-item-1",
      { question: "What is sharding?", answer: "It splits data" },
    );
    expect(questionGenerator.streamQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        turns: [{ question: "What is sharding?", answer: "It splits data" }],
        interviewLocale: "en",
      }),
      expect.any(Object),
    );

    const output = res.chunks.join("");
    expect(output).toContain('"turnsCompleted":1');
    expect(output).toContain("event: meta");
  });

  it("passes only the current item turns into question generation", async () => {
    const itemOneTurns = createCompletedTurns(QUESTION_COUNT, "session-item-1");
    const itemTwoTurns = createCompletedTurns(1, "session-item-2");

    vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
      createSession({
        items: [
          createSessionItem({
            id: "session-item-1",
            order: 0,
            topic: "topic-a",
            description: "desc-a",
            turns: itemOneTurns,
          }),
          createSessionItem({
            id: "session-item-2",
            order: 1,
            topic: "topic-b",
            description: "desc-b",
            turns: itemTwoTurns,
            pendingQuestion: "Pending on item 2",
          }),
        ],
      }),
    );
    vi.mocked(questionGenerator.streamQuestion).mockReturnValue(
      createQuestionStream(["Next question"])(),
    );

    const res = createMockResponse();

    await service.streamTurn(1, "review-session-id", { answer: "answer for item 2", interviewLocale: "en" }, res);

    expect(questionGenerator.streamQuestion).toHaveBeenCalledWith(
      {
        topic: "topic-b",
        angle: "sharding strategies",
        description: "desc-b",
        turns: [
          ...itemTwoTurns,
          { question: "Pending on item 2", answer: "answer for item 2" },
        ],
        interviewLocale: "en",
      },
      expect.any(Object),
    );
    expect(questionGenerator.streamQuestion).not.toHaveBeenCalledWith(
      expect.objectContaining({ topic: "topic-a" }),
      expect.any(Object),
    );
  });

  it("moves to the next item after the current item reaches N turns", async () => {
    const completedTurns = createCompletedTurns(QUESTION_COUNT - 1, "session-item-1");

    vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
      createSession({
        items: [
          createSessionItem({
            id: "session-item-1",
            order: 0,
            turns: completedTurns,
            pendingQuestion: "Final question for item 1",
          }),
          createSessionItem({
            id: "session-item-2",
            order: 1,
            topic: "rest apis",
            description: "Need REST practice",
            turns: [],
          }),
        ],
      }),
    );
    vi.mocked(questionGenerator.streamQuestion).mockReturnValue(
      createQuestionStream(["First question for item 2"])(),
    );

    const res = createMockResponse();

    await service.streamTurn(1, "review-session-id", { answer: "final answer", interviewLocale: "en" }, res);

    expect(questionGenerator.streamQuestion).toHaveBeenCalledWith(
      {
        topic: "rest apis",
        angle: "sharding strategies",
        description: "Need REST practice",
        turns: [],
        interviewLocale: "en",
      },
      expect.any(Object),
    );

    const output = res.chunks.join("");
    expect(output).toContain('"reviewSessionItemId":"session-item-2"');
    expect(output).toContain('"itemIndex":1');
    expect(output).toContain('"turnsCompleted":0');
  });

  it("runs evaluation only after all items reach N turns", async () => {
    const itemOneTurns = createCompletedTurns(QUESTION_COUNT, "session-item-1");
    const itemTwoTurns = createCompletedTurns(
      QUESTION_COUNT - 1,
      "session-item-2",
    );

    vi.mocked(reviewSessionRepository.findByIdAndUserId)
      .mockResolvedValueOnce(
        createSession({
          items: [
            createSessionItem({
              id: "session-item-1",
              order: 0,
              turns: itemOneTurns,
            }),
            createSessionItem({
              id: "session-item-2",
              order: 1,
              topic: "rest apis",
              turns: itemTwoTurns,
              pendingQuestion: "Last question for item 2",
            }),
          ],
        }),
      )
      .mockResolvedValueOnce(
        createSession({
          status: "pending_review",
          items: [
            createSessionItem({
              id: "session-item-1",
              order: 0,
              turns: itemOneTurns,
              suggestedStatus: "active",
              suggestedPriority: "medium",
            }),
            createSessionItem({
              id: "session-item-2",
              order: 1,
              topic: "rest apis",
              turns: [
                ...itemTwoTurns,
                {
                  question: "Last question for item 2",
                  answer: "final answer",
                },
              ],
              suggestedStatus: "learned",
              suggestedPriority: null,
            }),
          ],
        }),
      );

    vi.mocked(evaluator.evaluate)
      .mockResolvedValueOnce({ status: "active", priority: "medium" })
      .mockResolvedValueOnce({ status: "learned", priority: null });

    const res = createMockResponse();

    await service.streamTurn(1, "review-session-id", { answer: "final answer", interviewLocale: "pt" }, res);

    expect(questionGenerator.streamQuestion).not.toHaveBeenCalled();
    expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
    expect(evaluator.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "system design",
        turns: itemOneTurns,
        interviewLocale: "pt",
      }),
      expect.any(Object),
    );
    expect(evaluator.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "rest apis",
        turns: expect.arrayContaining([
          { question: "Last question for item 2", answer: "final answer" },
        ]),
        interviewLocale: "pt",
      }),
      expect.any(Object),
    );
    expect(reviewSessionRepository.markPendingReview).toHaveBeenCalledWith(
      "review-session-id",
      "pt",
    );

    const output = res.chunks.join("");
    expect(output).toContain('"status":"pending_review"');
    expect(output).toContain('"suggestedStatus":"active"');
    expect(output).toContain('"suggestedStatus":"learned"');
    expect(output).toContain("data: [DONE]");
  });

  it("keeps failed evaluation items without suggestions and emits per-item errors", async () => {
    const completedTurns = createCompletedTurns(
      QUESTION_COUNT - 1,
      "session-item-1",
    );

    vi.mocked(reviewSessionRepository.findByIdAndUserId)
      .mockResolvedValueOnce(
        createSession({
          items: [
            createSessionItem({
              id: "session-item-1",
              turns: completedTurns,
              pendingQuestion: "Last question",
            }),
          ],
        }),
      )
      .mockResolvedValueOnce(
        createSession({
          status: "pending_review",
          items: [
            createSessionItem({
              id: "session-item-1",
              turns: [
                ...completedTurns,
                { question: "Last question", answer: "final answer" },
              ],
              suggestedStatus: null,
              suggestedPriority: null,
            }),
          ],
        }),
      );

    vi.mocked(evaluator.evaluate).mockRejectedValue(
      new Error("OpenAI rate limit"),
    );

    const res = createMockResponse();

    await service.streamTurn(1, "review-session-id", { answer: "final answer", interviewLocale: "en" }, res);

    expect(reviewSessionRepository.saveSuggestions).toHaveBeenCalledWith(
      "session-item-1",
      null,
    );
    expect(reviewSessionRepository.markPendingReview).toHaveBeenCalledWith(
      "review-session-id",
      "en",
    );

    const output = res.chunks.join("");
    expect(output).toContain("event: error");
    expect(output).toContain('"reviewSessionItemId":"session-item-1"');
    expect(output).toContain("OpenAI rate limit");
    expect(output).toContain('"status":"pending_review"');
  });

  it("passes stream-body interviewLocale into question generation", async () => {
    vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
      createSession({ interviewLocale: "en" }),
    );
    vi.mocked(questionGenerator.streamQuestion).mockReturnValue(
      createQuestionStream(["Pergunta em português"])(),
    );

    const res = createMockResponse();

    await service.streamTurn(
      1,
      "review-session-id",
      { interviewLocale: "pt" },
      res,
    );

    expect(questionGenerator.streamQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ interviewLocale: "pt" }),
      expect.any(Object),
    );
  });

  it("does not persist pendingQuestion when the client disconnects mid-stream", async () => {
    let resumeSecondChunk: () => void = () => undefined;

    vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
      createSession(),
    );
    vi.mocked(questionGenerator.streamQuestion).mockReturnValue(
      (async function* () {
        yield { content: "Partial" };
        await new Promise<void>((resolve) => {
          resumeSecondChunk = resolve;
        });
        yield { content: " question" };
        return { content: "Partial question" };
      })(),
    );

    const res = createMockResponse();
    const streamPromise = service.streamTurn(
      1,
      "review-session-id",
      { interviewLocale: "en" },
      res,
    );

    await vi.waitFor(() => {
      expect(res.chunks.join("")).toContain("Partial");
    });

    res.emitClose();
    resumeSecondChunk();
    await streamPromise;

    expect(reviewSessionRepository.setPendingQuestion).not.toHaveBeenCalled();
    expect(res.chunks.join("")).not.toContain("event: meta");
  });
});
