import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const reviewSessionAiMock = vi.hoisted(() => ({
  streamQuestion: vi.fn(),
  evaluate: vi.fn(),
}));

vi.mock("@/config/env", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/config/env")>();
  return {
    ...mod,
    env: {
      ...mod.env,
      REVIEW_SESSION_QUESTION_COUNT: 1,
    },
  };
});

vi.mock(
  "@/infrastructure/ai/langgraph/nodes/review-session-question-node",
  () => ({
    createReviewSessionQuestionNode: () => ({
      streamQuestion: (
        ...args: Parameters<typeof reviewSessionAiMock.streamQuestion>
      ) => reviewSessionAiMock.streamQuestion(...args),
    }),
  }),
);

vi.mock(
  "@/infrastructure/ai/langgraph/nodes/review-session-evaluation-node",
  () => ({
    createReviewSessionEvaluationNode: () =>
      (
        input: Parameters<typeof reviewSessionAiMock.evaluate>[0],
        config?: Parameters<typeof reviewSessionAiMock.evaluate>[1],
      ) => reviewSessionAiMock.evaluate(input, config),
  }),
);

import { randomUUID } from "node:crypto";
import request from "supertest";
import type { Express } from "express";

import { createApp } from "@/config/app";
import prisma from "@/infrastructure/database";
import { ReviewPriority } from "../../../prisma/generated/client";
import {
  authHeader,
  seedAuthenticatedUser,
} from "@/test/helpers/auth-helpers";
import { seedReadyResume } from "@/test/helpers/interview-seed-helpers";
import { truncateTables } from "@/test/containers/truncate-tables";

type ReviewSessionQuestionInput = {
  topic: string;
  description: string;
  turns: Array<{ question: string; answer: string }>;
};

async function authenticate(): Promise<{
  token: string;
  userId: number;
}> {
  const auth = await seedAuthenticatedUser();
  return {
    token: auth.accessToken,
    userId: auth.userId,
  };
}

async function createOtherUserToken(): Promise<string> {
  const other = await seedAuthenticatedUser({
    email: "review-session-other@example.com",
    name: "Review Session Other User",
  });
  return other.accessToken;
}

async function seedReviewItem(
  userId: number,
  overrides: {
    topic: string;
    angle?: string;
    description: string;
    priority: (typeof ReviewPriority)[keyof typeof ReviewPriority];
    status?: "active" | "learned";
    learnedAt?: Date | null;
  },
) {
  const resume = await seedReadyResume(userId);
  const session = await prisma.interviewSession.create({
    data: {
      userId,
      resumeId: resume.id,
      level: "entry",
      interviewLocale: "en",
      maxTurns: 5,
    },
  });

  return prisma.reviewItem.create({
    data: {
      userId,
      sessionId: session.id,
      topic: overrides.topic,
      angle: overrides.angle ?? "general",
      description: overrides.description,
      priority: overrides.priority,
      status: overrides.status ?? "active",
      learnedAt: overrides.learnedAt ?? null,
    },
  });
}

async function seedCompletedReviewSession(
  userId: number,
  overrides: {
    topic: string;
    completedAt: Date;
    createdAt?: Date;
  },
) {
  const reviewItem = await seedReviewItem(userId, {
    topic: overrides.topic,
    description: `Practice ${overrides.topic}.`,
    priority: ReviewPriority.medium,
  });

  return prisma.reviewSession.create({
    data: {
      userId,
      status: "completed",
      interviewLocale: "en",
      createdAt: overrides.createdAt ?? overrides.completedAt,
      completedAt: overrides.completedAt,
      items: {
        create: [
          {
            reviewItemId: reviewItem.id,
            order: 0,
            topic: overrides.topic,
            angle: reviewItem.angle,
            description: `Practice ${overrides.topic}.`,
            currentPriority: ReviewPriority.medium,
            turns: [],
          },
        ],
      },
    },
  });
}

const MOCK_EVALUATION_RECAP = {
  wentWell: ["Named a concrete trade-off"],
  workOn: ["Tie the answer to this angle"],
};

function configureReviewSessionAiMocks(): void {
  reviewSessionAiMock.streamQuestion.mockImplementation(
    (input: ReviewSessionQuestionInput) => {
      const content = `Question about ${input.topic}?`;
      return (async function* () {
        yield { content: "Question about " };
        yield { content: `${input.topic}?` };
        return { content };
      })();
    },
  );

  reviewSessionAiMock.evaluate.mockImplementation(
    async (input: ReviewSessionQuestionInput) => {
      if (input.topic === "System Design") {
        return {
          status: "active",
          priority: "medium",
          ...MOCK_EVALUATION_RECAP,
        };
      }
      if (input.topic === "TypeScript") {
        return {
          status: "learned",
          priority: null,
          ...MOCK_EVALUATION_RECAP,
        };
      }
      return {
        status: "active",
        priority: "high",
        ...MOCK_EVALUATION_RECAP,
      };
    },
  );
}

async function streamReviewSessionTurn(
  app: Express,
  token: string,
  sessionId: string,
  body: { answer?: string; interviewLocale?: "en" | "pt" } = {},
) {
  return request(app)
    .post(`/api/review-sessions/${sessionId}/stream`)
    .set(authHeader(token))
    .send({ interviewLocale: "en", ...body });
}

async function runStreamThroughEvaluation(
  app: Express,
  token: string,
  sessionId: string,
  itemCount: number,
  interviewLocale: "en" | "pt" = "en",
) {
  const firstQuestion = await streamReviewSessionTurn(app, token, sessionId, {
    interviewLocale,
  });
  expect(firstQuestion.status).toBe(200);
  expect(firstQuestion.headers["content-type"]).toContain("text/event-stream");
  expect(firstQuestion.text).toContain("event: token");
  expect(firstQuestion.text).toContain("event: meta");
  expect(firstQuestion.text).toContain("data: [DONE]");

  for (let index = 0; index < itemCount; index += 1) {
    const response = await streamReviewSessionTurn(app, token, sessionId, {
      answer: `Answer ${index + 1} for review session item.`,
      interviewLocale,
    });
    expect(response.status).toBe(200);

    if (index === itemCount - 1) {
      expect(response.text).toContain("event: meta");
      expect(response.text).toContain("evaluating");
      expect(response.text).toContain("pending_review");
      expect(response.text.indexOf("evaluating")).toBeGreaterThanOrEqual(0);
      expect(response.text.indexOf("evaluating")).toBeLessThan(
        response.text.indexOf("pending_review"),
      );
      expect(response.text).toContain("data: [DONE]");
    } else {
      expect(response.text).toContain("event: token");
    }
  }
}

describe("Review Sessions API E2E", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    reviewSessionAiMock.streamQuestion.mockReset();
    reviewSessionAiMock.evaluate.mockReset();
    configureReviewSessionAiMocks();
    await truncateTables();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("POST /api/review-sessions/", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .post("/api/review-sessions/")
        .send({ reviewItemIds: [randomUUID()] });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("returns 422 when interviewLocale is omitted", async () => {
      const { token, userId } = await authenticate();
      const item = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });

      const response = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({ reviewItemIds: [item.id] });

      expect(response.status).toBe(422);
      expect(response.body.message).toBe("Validation failed");
      expect(response.body.errors).toBeDefined();
    });

    it("returns 201 when creating a session with active owned review items", async () => {
      const { token, userId } = await authenticate();
      const itemOne = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });
      const itemTwo = await seedReviewItem(userId, {
        topic: "TypeScript",
        description: "Review generics and utility types.",
        priority: ReviewPriority.medium,
      });

      const response = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({
          reviewItemIds: [itemOne.id, itemTwo.id],
          interviewLocale: "en",
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        status: "in_progress",
        items: expect.arrayContaining([
          expect.objectContaining({
            reviewItemId: itemOne.id,
            topic: "System Design",
            currentPriority: "high",
          }),
          expect.objectContaining({
            reviewItemId: itemTwo.id,
            topic: "TypeScript",
            currentPriority: "medium",
          }),
        ]),
      });
      expect(response.body.items).toHaveLength(2);

      const session = await prisma.reviewSession.findUnique({
        where: { id: response.body.id as string },
      });
      expect(session?.interviewLocale).toBe("en");
    });

    it("returns 404 when any review item is missing, not owned, or not active", async () => {
      const { token, userId } = await authenticate();
      const activeItem = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });
      const learnedItem = await seedReviewItem(userId, {
        topic: "TypeScript",
        description: "Already learned topic.",
        priority: ReviewPriority.low,
        status: "learned",
        learnedAt: new Date("2026-06-01T12:00:00.000Z"),
      });

      const missingResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({
          reviewItemIds: [activeItem.id, randomUUID()],
          interviewLocale: "en",
        });

      expect(missingResponse.status).toBe(404);
      expect(missingResponse.body).toEqual({ message: "Review item not found" });

      const learnedResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({
          reviewItemIds: [learnedItem.id],
          interviewLocale: "en",
        });

      expect(learnedResponse.status).toBe(404);
      expect(learnedResponse.body).toEqual({ message: "Review item not found" });

      const otherToken = await createOtherUserToken();
      const crossUserResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(otherToken))
        .send({
          reviewItemIds: [activeItem.id],
          interviewLocale: "en",
        });

      expect(crossUserResponse.status).toBe(404);
      expect(crossUserResponse.body).toEqual({ message: "Review item not found" });
    });
  });

  describe("GET /api/review-sessions/:id", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).get(
        `/api/review-sessions/${randomUUID()}`,
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("returns 404 when session does not exist or belongs to another user", async () => {
      const { token, userId } = await authenticate();
      const item = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });

      const createResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({ reviewItemIds: [item.id], interviewLocale: "en" });

      const sessionId = createResponse.body.id as string;
      const otherToken = await createOtherUserToken();

      const missingResponse = await request(app)
        .get(`/api/review-sessions/${randomUUID()}`)
        .set(authHeader(token));

      expect(missingResponse.status).toBe(404);
      expect(missingResponse.body).toEqual({
        message: "Review session not found",
      });

      const crossUserResponse = await request(app)
        .get(`/api/review-sessions/${sessionId}`)
        .set(authHeader(otherToken));

      expect(crossUserResponse.status).toBe(404);
      expect(crossUserResponse.body).toEqual({
        message: "Review session not found",
      });
    });

    it("includes turns on each item after stream answers", async () => {
      const { token, userId } = await authenticate();
      const item = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });

      const createResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({ reviewItemIds: [item.id], interviewLocale: "en" });

      const sessionId = createResponse.body.id as string;

      const beforeStream = await request(app)
        .get(`/api/review-sessions/${sessionId}`)
        .set(authHeader(token));

      expect(beforeStream.status).toBe(200);
      expect(beforeStream.body.items[0].turns).toEqual([]);

      await runStreamThroughEvaluation(app, token, sessionId, 1);

      const afterStream = await request(app)
        .get(`/api/review-sessions/${sessionId}`)
        .set(authHeader(token));

      expect(afterStream.status).toBe(200);
      expect(afterStream.body.items).toHaveLength(1);
      expect(afterStream.body.items[0].turns).toEqual([
        {
          question: "Question about System Design?",
          answer: "Answer 1 for review session item.",
        },
      ]);
    });
  });

  describe("GET /api/review-sessions/", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .get("/api/review-sessions/")
        .query({ status: "completed" });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("returns 422 when status query is missing or invalid", async () => {
      const { token } = await authenticate();

      const missingStatus = await request(app)
        .get("/api/review-sessions/")
        .set(authHeader(token));

      expect(missingStatus.status).toBe(422);
      expect(missingStatus.body.message).toBe("Validation failed");
      expect(missingStatus.body.errors).toBeDefined();

      const invalidStatus = await request(app)
        .get("/api/review-sessions/")
        .query({ status: "done" })
        .set(authHeader(token));

      expect(invalidStatus.status).toBe(422);
      expect(invalidStatus.body.message).toBe("Validation failed");
      expect(invalidStatus.body.errors).toBeDefined();
    });

    it("returns empty sessions list when user has none", async () => {
      const { token } = await authenticate();

      const response = await request(app)
        .get("/api/review-sessions/")
        .query({ status: "completed" })
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        sessions: [],
        page: 1,
        limit: 10,
        hasMore: false,
      });
    });

    it("lists completed sessions after apply and keeps open sessions out of completed", async () => {
      const { token, userId } = await authenticate();
      const completedItem = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });
      const openItem = await seedReviewItem(userId, {
        topic: "TypeScript",
        description: "Review generics and utility types.",
        priority: ReviewPriority.medium,
      });

      const completedCreate = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({ reviewItemIds: [completedItem.id], interviewLocale: "en" });

      const completedSessionId = completedCreate.body.id as string;
      await runStreamThroughEvaluation(app, token, completedSessionId, 1);

      const report = await request(app)
        .get(`/api/review-sessions/${completedSessionId}`)
        .set(authHeader(token));

      await request(app)
        .post(`/api/review-sessions/${completedSessionId}/apply`)
        .set(authHeader(token))
        .send({
          items: [
            {
              reviewSessionItemId: report.body.items[0].id as string,
              status: "active",
              priority: "medium",
            },
          ],
        })
        .expect(200);

      const openCreate = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({ reviewItemIds: [openItem.id], interviewLocale: "en" });

      const openSessionId = openCreate.body.id as string;

      const completedList = await request(app)
        .get("/api/review-sessions/")
        .query({ status: "completed" })
        .set(authHeader(token));

      expect(completedList.status).toBe(200);
      expect(completedList.body.hasMore).toBe(false);
      expect(completedList.body.sessions).toEqual([
        expect.objectContaining({
          id: completedSessionId,
          status: "completed",
          topics: expect.arrayContaining(["System Design — general"]),
          completedAt: expect.any(String),
        }),
      ]);
      expect(
        completedList.body.sessions.some(
          (session: { id: string }) => session.id === openSessionId,
        ),
      ).toBe(false);

      const openList = await request(app)
        .get("/api/review-sessions/")
        .query({ status: "in_progress,pending_review" })
        .set(authHeader(token));

      expect(openList.status).toBe(200);
      expect(openList.body.sessions).toEqual([
        expect.objectContaining({
          id: openSessionId,
          status: "in_progress",
          topics: expect.arrayContaining(["TypeScript — general"]),
          completedAt: null,
        }),
      ]);
      expect(
        openList.body.sessions.some(
          (session: { id: string }) => session.id === completedSessionId,
        ),
      ).toBe(false);
    });

    it("paginates completed sessions with hasMore and distinct page ids", async () => {
      const { token, userId } = await authenticate();
      const baseTime = Date.UTC(2026, 6, 1, 12, 0, 0);

      for (let index = 0; index < 11; index += 1) {
        await seedCompletedReviewSession(userId, {
          topic: `Topic ${index + 1}`,
          completedAt: new Date(baseTime + index * 60_000),
        });
      }

      const page1 = await request(app)
        .get("/api/review-sessions/")
        .query({ status: "completed", page: 1, limit: 10 })
        .set(authHeader(token));

      expect(page1.status).toBe(200);
      expect(page1.body.page).toBe(1);
      expect(page1.body.limit).toBe(10);
      expect(page1.body.hasMore).toBe(true);
      expect(page1.body.sessions).toHaveLength(10);

      const page2 = await request(app)
        .get("/api/review-sessions/")
        .query({ status: "completed", page: 2, limit: 10 })
        .set(authHeader(token));

      expect(page2.status).toBe(200);
      expect(page2.body.page).toBe(2);
      expect(page2.body.limit).toBe(10);
      expect(page2.body.hasMore).toBe(false);
      expect(page2.body.sessions).toHaveLength(1);

      const page1Ids = page1.body.sessions.map(
        (session: { id: string }) => session.id,
      );
      const page2Ids = page2.body.sessions.map(
        (session: { id: string }) => session.id,
      );

      expect(page1Ids).toHaveLength(10);
      expect(page2Ids).toHaveLength(1);
      expect(new Set([...page1Ids, ...page2Ids]).size).toBe(11);
      expect(page1Ids).not.toEqual(expect.arrayContaining(page2Ids));
    });
  });

  describe("POST /api/review-sessions/:id/stream", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .post(`/api/review-sessions/${randomUUID()}/stream`)
        .send({});

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("returns 422 when interviewLocale is omitted", async () => {
      const { token, userId } = await authenticate();
      const item = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });

      const createResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({ reviewItemIds: [item.id], interviewLocale: "en" });

      const sessionId = createResponse.body.id as string;

      const response = await request(app)
        .post(`/api/review-sessions/${sessionId}/stream`)
        .set(authHeader(token))
        .send({});

      expect(response.status).toBe(422);
      expect(response.body.message).toBe("Validation failed");
      expect(response.body.errors).toBeDefined();
      expect(reviewSessionAiMock.streamQuestion).not.toHaveBeenCalled();
    });

    it("returns 404 when session does not exist or belongs to another user", async () => {
      const { token, userId } = await authenticate();
      const item = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });

      const createResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({ reviewItemIds: [item.id], interviewLocale: "en" });

      const sessionId = createResponse.body.id as string;
      const otherToken = await createOtherUserToken();

      const missingResponse = await streamReviewSessionTurn(
        app,
        token,
        randomUUID(),
      );

      expect(missingResponse.status).toBe(404);
      expect(missingResponse.body).toEqual({
        message: "Review session not found",
      });

      const crossUserResponse = await streamReviewSessionTurn(
        app,
        otherToken,
        sessionId,
      );

      expect(crossUserResponse.status).toBe(404);
      expect(crossUserResponse.body).toEqual({
        message: "Review session not found",
      });
      expect(reviewSessionAiMock.streamQuestion).not.toHaveBeenCalled();
    });

    it("returns 400 when answer is required but omitted", async () => {
      const { token, userId } = await authenticate();
      const item = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });

      const createResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({ reviewItemIds: [item.id], interviewLocale: "en" });

      const sessionId = createResponse.body.id as string;

      const firstStream = await streamReviewSessionTurn(app, token, sessionId);
      expect(firstStream.status).toBe(200);

      const response = await streamReviewSessionTurn(app, token, sessionId);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Answer is required" });
    });

    it("returns 409 when session is pending review or completed", async () => {
      const { token, userId } = await authenticate();
      const itemOne = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });
      const itemTwo = await seedReviewItem(userId, {
        topic: "TypeScript",
        description: "Review generics and utility types.",
        priority: ReviewPriority.medium,
      });

      const createResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({
          reviewItemIds: [itemOne.id, itemTwo.id],
          interviewLocale: "en",
        });

      const sessionId = createResponse.body.id as string;
      await runStreamThroughEvaluation(app, token, sessionId, 2);

      const pendingReviewResponse = await streamReviewSessionTurn(
        app,
        token,
        sessionId,
        { answer: "Too late" },
      );

      expect(pendingReviewResponse.status).toBe(409);
      expect(pendingReviewResponse.body).toEqual({
        message: "Review session is not accepting answers",
      });

      const report = await request(app)
        .get(`/api/review-sessions/${sessionId}`)
        .set(authHeader(token));

      await request(app)
        .post(`/api/review-sessions/${sessionId}/apply`)
        .set(authHeader(token))
        .send({
          items: report.body.items.map(
            (item: {
              id: string;
              suggestedStatus: string | null;
              suggestedPriority: string | null;
            }) =>
              item.suggestedStatus === "learned"
                ? {
                    reviewSessionItemId: item.id,
                    status: "learned",
                  }
                : {
                    reviewSessionItemId: item.id,
                    status: "active",
                    priority: item.suggestedPriority ?? "medium",
                  },
          ),
        })
        .expect(200);

      const completedResponse = await streamReviewSessionTurn(
        app,
        token,
        sessionId,
        { answer: "After completion" },
      );

      expect(completedResponse.status).toBe(409);
      expect(completedResponse.body).toEqual({
        message: "Review session is not accepting answers",
      });
    });

    it("persists stream interviewLocale when session reaches pending_review", async () => {
      const { token, userId } = await authenticate();
      const item = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });

      const createResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({ reviewItemIds: [item.id], interviewLocale: "en" });

      const sessionId = createResponse.body.id as string;

      const created = await prisma.reviewSession.findUnique({
        where: { id: sessionId },
      });
      expect(created?.interviewLocale).toBe("en");

      await runStreamThroughEvaluation(app, token, sessionId, 1, "pt");

      const pending = await prisma.reviewSession.findUnique({
        where: { id: sessionId },
      });
      expect(pending?.status).toBe("pending_review");
      expect(pending?.interviewLocale).toBe("pt");
    });

    it("emits evaluating then pending_review with empty recap when evaluation fails", async () => {
      const { token, userId } = await authenticate();
      const item = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });

      const createResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({ reviewItemIds: [item.id], interviewLocale: "en" });

      const sessionId = createResponse.body.id as string;

      const firstQuestion = await streamReviewSessionTurn(app, token, sessionId);
      expect(firstQuestion.status).toBe(200);

      reviewSessionAiMock.evaluate.mockRejectedValueOnce(
        new Error("OpenAI rate limit"),
      );

      const lastResponse = await streamReviewSessionTurn(app, token, sessionId, {
        answer: "Answer 1 for review session item.",
      });

      expect(lastResponse.status).toBe(200);
      expect(lastResponse.text).toContain("evaluating");
      expect(lastResponse.text).toContain("pending_review");
      expect(lastResponse.text.indexOf("evaluating")).toBeGreaterThanOrEqual(0);
      expect(lastResponse.text.indexOf("evaluating")).toBeLessThan(
        lastResponse.text.indexOf("pending_review"),
      );
      expect(lastResponse.text).toContain("event: error");
      expect(lastResponse.text).toContain("OpenAI rate limit");
      expect(lastResponse.text).toContain("data: [DONE]");

      const report = await request(app)
        .get(`/api/review-sessions/${sessionId}`)
        .set(authHeader(token));

      expect(report.status).toBe(200);
      expect(report.body.status).toBe("pending_review");
      expect(report.body.interviewLocale).toBe("en");
      expect(report.body.items).toEqual([
        expect.objectContaining({
          reviewItemId: item.id,
          suggestedStatus: null,
          suggestedPriority: null,
          wentWell: [],
          workOn: [],
        }),
      ]);

      const applyResponse = await request(app)
        .post(`/api/review-sessions/${sessionId}/apply`)
        .set(authHeader(token))
        .send({
          items: [
            {
              reviewSessionItemId: report.body.items[0].id as string,
              status: "active",
              priority: "medium",
            },
          ],
        });

      expect(applyResponse.status).toBe(200);
      expect(applyResponse.body).toMatchObject({
        status: "completed",
        items: expect.arrayContaining([
          expect.objectContaining({
            confirmedStatus: "active",
            confirmedPriority: "medium",
          }),
        ]),
      });
    });
  });

  describe("POST /api/review-sessions/:id/apply", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .post(`/api/review-sessions/${randomUUID()}/apply`)
        .send({
          items: [
            {
              reviewSessionItemId: randomUUID(),
              status: "active",
              priority: "high",
            },
          ],
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("returns 404 when session does not belong to the user", async () => {
      const { token, userId } = await authenticate();
      const item = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });

      const createResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({ reviewItemIds: [item.id], interviewLocale: "en" });

      const sessionId = createResponse.body.id as string;
      await runStreamThroughEvaluation(app, token, sessionId, 1);

      const report = await request(app)
        .get(`/api/review-sessions/${sessionId}`)
        .set(authHeader(token));

      const sessionItemId = report.body.items[0].id as string;
      const otherToken = await createOtherUserToken();

      const missingSessionResponse = await request(app)
        .post(`/api/review-sessions/${randomUUID()}/apply`)
        .set(authHeader(token))
        .send({
          items: [
            {
              reviewSessionItemId: sessionItemId,
              status: "active",
              priority: "medium",
            },
          ],
        });

      expect(missingSessionResponse.status).toBe(404);
      expect(missingSessionResponse.body).toEqual({
        message: "Review session not found",
      });

      const crossUserResponse = await request(app)
        .post(`/api/review-sessions/${sessionId}/apply`)
        .set(authHeader(otherToken))
        .send({
          items: [
            {
              reviewSessionItemId: sessionItemId,
              status: "active",
              priority: "medium",
            },
          ],
        });

      expect(crossUserResponse.status).toBe(404);
      expect(crossUserResponse.body).toEqual({
        message: "Review session not found",
      });
    });

    it("returns 400 when session is not pending review and 409 when applying twice", async () => {
      const { token, userId } = await authenticate();
      const item = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });

      const createResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({ reviewItemIds: [item.id], interviewLocale: "en" });

      const sessionId = createResponse.body.id as string;
      const beforeEvaluation = await request(app)
        .get(`/api/review-sessions/${sessionId}`)
        .set(authHeader(token));

      const sessionItemId = beforeEvaluation.body.items[0].id as string;

      const applyBeforeEvaluation = await request(app)
        .post(`/api/review-sessions/${sessionId}/apply`)
        .set(authHeader(token))
        .send({
          items: [
            {
              reviewSessionItemId: sessionItemId,
              status: "active",
              priority: "medium",
            },
          ],
        });

      expect(applyBeforeEvaluation.status).toBe(400);
      expect(applyBeforeEvaluation.body).toEqual({
        message: "Review session is not pending review",
      });

      await runStreamThroughEvaluation(app, token, sessionId, 1);

      const applyPayload = {
        items: [
          {
            reviewSessionItemId: sessionItemId,
            status: "active",
            priority: "medium",
          },
        ],
      };

      await request(app)
        .post(`/api/review-sessions/${sessionId}/apply`)
        .set(authHeader(token))
        .send(applyPayload)
        .expect(200);

      const duplicateApply = await request(app)
        .post(`/api/review-sessions/${sessionId}/apply`)
        .set(authHeader(token))
        .send(applyPayload);

      expect(duplicateApply.status).toBe(409);
      expect(duplicateApply.body).toEqual({
        message: "Review session already completed",
      });
    });
  });

  describe("full review session lifecycle", () => {
    it("streams through all items, exposes suggestions in the report, and applies all changes in one bulk apply", async () => {
      const { token, userId } = await authenticate();
      const itemOne = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });
      const itemTwo = await seedReviewItem(userId, {
        topic: "TypeScript",
        description: "Review generics and utility types.",
        priority: ReviewPriority.medium,
      });
      const itemThree = await seedReviewItem(userId, {
        topic: "REST APIs",
        description: "Practice REST semantics.",
        priority: ReviewPriority.low,
      });

      const createResponse = await request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({
          reviewItemIds: [itemOne.id, itemTwo.id, itemThree.id],
          interviewLocale: "en",
        });

      const sessionId = createResponse.body.id as string;

      const beforeEvaluation = await request(app)
        .get(`/api/review-sessions/${sessionId}`)
        .set(authHeader(token));

      expect(beforeEvaluation.status).toBe(200);
      expect(beforeEvaluation.body).toMatchObject({
        status: "in_progress",
      });
      expect(beforeEvaluation.body.items).toHaveLength(3);
      expect(
        beforeEvaluation.body.items.every(
          (item: { suggestedStatus: string | null }) => item.suggestedStatus === null,
        ),
      ).toBe(true);

      await runStreamThroughEvaluation(app, token, sessionId, 3);

      const afterEvaluation = await request(app)
        .get(`/api/review-sessions/${sessionId}`)
        .set(authHeader(token));

      expect(afterEvaluation.status).toBe(200);
      expect(afterEvaluation.body.status).toBe("pending_review");
      expect(afterEvaluation.body.interviewLocale).toBe("en");
      expect(afterEvaluation.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reviewItemId: itemOne.id,
            suggestedStatus: "active",
            suggestedPriority: "medium",
            confirmedStatus: null,
            wentWell: MOCK_EVALUATION_RECAP.wentWell,
            workOn: MOCK_EVALUATION_RECAP.workOn,
          }),
          expect.objectContaining({
            reviewItemId: itemTwo.id,
            suggestedStatus: "learned",
            suggestedPriority: null,
            confirmedStatus: null,
            wentWell: MOCK_EVALUATION_RECAP.wentWell,
            workOn: MOCK_EVALUATION_RECAP.workOn,
          }),
          expect.objectContaining({
            reviewItemId: itemThree.id,
            suggestedStatus: "active",
            suggestedPriority: "high",
            confirmedStatus: null,
            wentWell: MOCK_EVALUATION_RECAP.wentWell,
            workOn: MOCK_EVALUATION_RECAP.workOn,
          }),
        ]),
      );

      const reviewItemsBeforeConfirm = await request(app)
        .get("/api/review-items/")
        .query({ status: "all" })
        .set(authHeader(token));

      expect(reviewItemsBeforeConfirm.body.reviewItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: itemOne.id,
            status: "active",
            priority: "high",
          }),
          expect.objectContaining({
            id: itemTwo.id,
            status: "active",
            priority: "medium",
          }),
          expect.objectContaining({
            id: itemThree.id,
            status: "active",
            priority: "low",
          }),
        ]),
      );

      const sessionItemOneId = afterEvaluation.body.items.find(
        (item: { reviewItemId: string }) => item.reviewItemId === itemOne.id,
      ).id as string;
      const sessionItemTwoId = afterEvaluation.body.items.find(
        (item: { reviewItemId: string }) => item.reviewItemId === itemTwo.id,
      ).id as string;
      const sessionItemThreeId = afterEvaluation.body.items.find(
        (item: { reviewItemId: string }) => item.reviewItemId === itemThree.id,
      ).id as string;

      const applyResponse = await request(app)
        .post(`/api/review-sessions/${sessionId}/apply`)
        .set(authHeader(token))
        .send({
          items: [
            {
              reviewSessionItemId: sessionItemOneId,
              status: "active",
              priority: "medium",
            },
            {
              reviewSessionItemId: sessionItemTwoId,
              status: "active",
              priority: "low",
            },
            {
              reviewSessionItemId: sessionItemThreeId,
              status: "learned",
            },
          ],
        });

      expect(applyResponse.status).toBe(200);
      expect(applyResponse.body).toMatchObject({
        status: "completed",
        items: expect.arrayContaining([
          expect.objectContaining({
            id: sessionItemOneId,
            confirmedStatus: "active",
            confirmedPriority: "medium",
          }),
          expect.objectContaining({
            id: sessionItemTwoId,
            confirmedStatus: "active",
            confirmedPriority: "low",
          }),
          expect.objectContaining({
            id: sessionItemThreeId,
            confirmedStatus: "learned",
            confirmedPriority: null,
          }),
        ]),
      });

      const completedSession = await request(app)
        .get(`/api/review-sessions/${sessionId}`)
        .set(authHeader(token));

      expect(completedSession.body.status).toBe("completed");

      const activeItems = await request(app)
        .get("/api/review-items/")
        .query({ status: "active" })
        .set(authHeader(token));

      expect(activeItems.body.reviewItems).toHaveLength(2);
      expect(activeItems.body.reviewItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: itemOne.id,
            priority: "medium",
            status: "active",
          }),
          expect.objectContaining({
            id: itemTwo.id,
            priority: "low",
            status: "active",
          }),
        ]),
      );

      const learnedItems = await request(app)
        .get("/api/review-items/")
        .query({ status: "learned" })
        .set(authHeader(token));

      expect(learnedItems.body.reviewItems).toHaveLength(1);
      expect(learnedItems.body.reviewItems[0]).toMatchObject({
        id: itemThree.id,
        status: "learned",
        learnedAt: expect.any(String),
      });
    });
  });
});
