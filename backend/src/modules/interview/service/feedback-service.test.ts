import { beforeEach, describe, expect, it } from "vitest";

import { NotFoundError } from "@/shared";
import type { FeedbackRepository } from "../repository/feedback-repository";
import type { SessionRepository } from "../repository/session-repository";
import { FeedbackService } from "./feedback-service";

const userId = 1;
const sessionId = "session-id";

function createStubSessionRepository() {
  const state = {
    sessionById: null as Awaited<
      ReturnType<SessionRepository["findByIdAndUserId"]>
    >,
  };

  return {
    get sessionById() {
      return state.sessionById;
    },
    set sessionById(value) {
      state.sessionById = value;
    },
    findByIdAndUserId: async () => state.sessionById,
  } as unknown as SessionRepository & typeof state;
}

function createStubFeedbackRepository() {
  const state = {
    upsertCalls: [] as Parameters<FeedbackRepository["upsert"]>[0][],
    upsertResult: {
      id: "feedback-id",
      sessionId,
      userId,
      rating: "up" as const,
      comment: "Great session",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  };

  return {
    get upsertCalls() {
      return state.upsertCalls;
    },
    get upsertResult() {
      return state.upsertResult;
    },
    set upsertResult(value) {
      state.upsertResult = value;
    },
    upsert: async (params: Parameters<FeedbackRepository["upsert"]>[0]) => {
      state.upsertCalls.push(params);
      return state.upsertResult;
    },
  } as unknown as FeedbackRepository & typeof state;
}

describe("FeedbackService", () => {
  let sessionRepository: ReturnType<typeof createStubSessionRepository>;
  let feedbackRepository: ReturnType<typeof createStubFeedbackRepository>;
  let service: FeedbackService;

  beforeEach(() => {
    sessionRepository = createStubSessionRepository();
    feedbackRepository = createStubFeedbackRepository();
    service = new FeedbackService(sessionRepository, feedbackRepository);
  });

  it("throws NotFoundError when the session does not belong to the user", async () => {
    sessionRepository.sessionById = null;

    await expect(
      service.submit(userId, sessionId, { rating: "up" }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(feedbackRepository.upsertCalls).toHaveLength(0);
  });

  it("delegates to FeedbackRepository.upsert when ownership is valid", async () => {
    sessionRepository.sessionById = {
      id: sessionId,
      userId,
      resumeId: "resume-id",
      resumeName: "resume.pdf",
      level: "entry",
      jobDescription: null,
      interviewLocale: "en",
      turnCount: 3,
      maxTurns: 5,
      isFinished: true,
      reviewGenerationStatus: "ready" as const,
      reviewGenerationError: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const result = await service.submit(userId, sessionId, {
      rating: "up",
      comment: "Great session",
    });

    expect(feedbackRepository.upsertCalls).toEqual([
      {
        sessionId,
        userId,
        rating: "up",
        comment: "Great session",
      },
    ]);
    expect(result).toEqual(feedbackRepository.upsertResult);
  });
});
