import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const interviewGraphMock = vi.hoisted(() => {
  function createMockStream() {
    return (async function* () {
      yield { content: "Hello " };
      yield { content: "candidate" };
      return { content: "Hello candidate" };
    })();
  }

  return {
    streamMessages: vi.fn(() => createMockStream()),
  };
});

const reviewItemsGeneratorMock = vi.hoisted(() => ({
  generate: vi.fn(
    async (): Promise<{
      items: Array<{
        topic: string;
        angle: string;
        description: string;
        priority: "high" | "medium" | "low";
      }>;
    }> => ({ items: [] }),
  ),
}));

vi.mock("@/factories/interview/interview-graph-factory", () => ({
  makeInterviewGraph: () => interviewGraphMock,
}));

vi.mock(
  "@/infrastructure/ai/langgraph/nodes/review-items-generator-node",
  () => ({
    createReviewItemsGeneratorNode: () => reviewItemsGeneratorMock.generate,
  }),
);

import request from "supertest";
import type { Express } from "express";

import prisma from "@/infrastructure/database";
import {
  authHeader,
  seedAuthenticatedUser,
} from "@/test/helpers/auth-helpers";
import {
  buildCreateSessionPayload,
  buildStreamMessagePayload,
  seedReadyResume,
} from "@/test/helpers/interview-seed-helpers";
import { truncateTables } from "@/test/containers/truncate-tables";

const PRACTICE_LIMIT_MESSAGE =
  "Practice session limit reached. You can start another after the waiting period.";
const STUDY_LIMIT_MESSAGE =
  "Study session limit reached. You can start another after the waiting period.";

async function seedReviewItem(userId: number) {
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
      topic: "System Design",
      angle: "general",
      description: "Practice scalability trade-offs.",
      priority: "high",
      status: "active",
    },
  });
}

describe("Session quota API E2E", () => {
  let app: Express;
  let previousPractice: string | undefined;
  let previousStudy: string | undefined;

  beforeAll(async () => {
    previousPractice = process.env.SESSION_QUOTA_PRACTICE_MAX;
    previousStudy = process.env.SESSION_QUOTA_STUDY_MAX;
    process.env.SESSION_QUOTA_PRACTICE_MAX = "3";
    process.env.SESSION_QUOTA_STUDY_MAX = "3";
    vi.resetModules();

    const { createApp } = await import("@/config/app");
    app = await createApp();
  });

  beforeEach(async () => {
    await truncateTables();
    interviewGraphMock.streamMessages.mockClear();
  });

  afterAll(() => {
    process.env.SESSION_QUOTA_PRACTICE_MAX = previousPractice;
    process.env.SESSION_QUOTA_STUDY_MAX = previousStudy;
    vi.resetModules();
  });

  it("returns 401 without authentication", async () => {
    const response = await request(app).get("/api/session-quota");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  it("returns empty buckets when the user has no quota events", async () => {
    const auth = await seedAuthenticatedUser();

    const response = await request(app)
      .get("/api/session-quota")
      .set(authHeader(auth.accessToken));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      practice: {
        used: 0,
        limit: 3,
        remaining: 3,
        retryAfterSeconds: null,
      },
      study: {
        used: 0,
        limit: 3,
        remaining: 3,
        retryAfterSeconds: null,
      },
    });
  });

  it("returns exhausted practice without writing events or affecting study", async () => {
    const auth = await seedAuthenticatedUser();

    await prisma.sessionQuotaEvent.create({
      data: { userId: auth.userId, kind: "practice" },
    });
    await prisma.sessionQuotaEvent.create({
      data: { userId: auth.userId, kind: "practice" },
    });
    await prisma.sessionQuotaEvent.create({
      data: { userId: auth.userId, kind: "practice" },
    });

    const response = await request(app)
      .get("/api/session-quota")
      .set(authHeader(auth.accessToken));

    expect(response.status).toBe(200);
    expect(response.body.practice.used).toBe(3);
    expect(response.body.practice.limit).toBe(3);
    expect(response.body.practice.remaining).toBe(0);
    expect(response.body.practice.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(response.body.study).toEqual({
      used: 0,
      limit: 3,
      remaining: 3,
      retryAfterSeconds: null,
    });

    const count = await prisma.sessionQuotaEvent.count({
      where: { userId: auth.userId },
    });
    expect(count).toBe(3);
  });

  describe("practice create quota", () => {
    async function createPracticeSession(
      token: string,
      resumeId: string,
    ) {
      return request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(buildCreateSessionPayload({ resumeId, level: "entry" }));
    }

    it("allows three practice creates then returns 429 on the fourth", async () => {
      const auth = await seedAuthenticatedUser();
      const resume = await seedReadyResume(auth.userId);

      const first = await createPracticeSession(auth.accessToken, resume.id);
      const second = await createPracticeSession(auth.accessToken, resume.id);
      const third = await createPracticeSession(auth.accessToken, resume.id);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(third.status).toBe(201);

      const fourth = await createPracticeSession(auth.accessToken, resume.id);

      expect(fourth.status).toBe(429);
      expect(fourth.body.message).toBe(PRACTICE_LIMIT_MESSAGE);
      expect(fourth.body.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(fourth.headers["retry-after"]).toBe(
        String(fourth.body.retryAfterSeconds),
      );

      const sessionCount = await prisma.interviewSession.count({
        where: { userId: auth.userId },
      });
      expect(sessionCount).toBe(3);
    });

    it("does not block another user after the practice quota is exhausted", async () => {
      const userA = await seedAuthenticatedUser();
      const userB = await seedAuthenticatedUser({
        email: `user-b-${crypto.randomUUID()}@example.com`,
      });
      const resumeA = await seedReadyResume(userA.userId);
      const resumeB = await seedReadyResume(userB.userId);

      await createPracticeSession(userA.accessToken, resumeA.id);
      await createPracticeSession(userA.accessToken, resumeA.id);
      await createPracticeSession(userA.accessToken, resumeA.id);

      const exhausted = await createPracticeSession(
        userA.accessToken,
        resumeA.id,
      );
      expect(exhausted.status).toBe(429);

      const otherUser = await createPracticeSession(
        userB.accessToken,
        resumeB.id,
      );
      expect(otherUser.status).toBe(201);
    });

    it("does not apply quota to stream on an existing session", async () => {
      const auth = await seedAuthenticatedUser();
      const resume = await seedReadyResume(auth.userId);

      const created = await createPracticeSession(auth.accessToken, resume.id);
      expect(created.status).toBe(201);

      const sessionId = created.body.id as string;
      const response = await request(app)
        .post(`/api/interview/sessions/${sessionId}/stream`)
        .set(authHeader(auth.accessToken))
        .send(buildStreamMessagePayload());

      expect(response.status).toBe(200);
    });

    it("does not refund quota when an interview is deleted", async () => {
      const auth = await seedAuthenticatedUser();
      const resume = await seedReadyResume(auth.userId);

      const first = await createPracticeSession(auth.accessToken, resume.id);
      await createPracticeSession(auth.accessToken, resume.id);
      await createPracticeSession(auth.accessToken, resume.id);
      expect(first.status).toBe(201);

      const deleted = await request(app)
        .delete(`/api/interview/sessions/${first.body.id as string}`)
        .set(authHeader(auth.accessToken));
      expect(deleted.status).toBe(204);

      const fourth = await createPracticeSession(auth.accessToken, resume.id);

      expect(fourth.status).toBe(429);
      expect(fourth.body.message).toBe(PRACTICE_LIMIT_MESSAGE);
    });

    it("allows only one of two concurrent creates when remaining is 1", async () => {
      const auth = await seedAuthenticatedUser();
      const resume = await seedReadyResume(auth.userId);

      await prisma.sessionQuotaEvent.create({
        data: { userId: auth.userId, kind: "practice" },
      });
      await prisma.sessionQuotaEvent.create({
        data: { userId: auth.userId, kind: "practice" },
      });

      const [first, second] = await Promise.all([
        createPracticeSession(auth.accessToken, resume.id),
        createPracticeSession(auth.accessToken, resume.id),
      ]);

      const statuses = [first.status, second.status];
      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      expect(statuses.filter((status) => status === 429)).toHaveLength(1);

      const sessionCount = await prisma.interviewSession.count({
        where: { userId: auth.userId },
      });
      expect(sessionCount).toBe(1);
    });
  });

  describe("study create quota", () => {
    async function createStudySession(token: string, reviewItemId: string) {
      return request(app)
        .post("/api/review-sessions/")
        .set(authHeader(token))
        .send({
          reviewItemIds: [reviewItemId],
          interviewLocale: "en",
        });
    }

    async function createPracticeSession(token: string, resumeId: string) {
      return request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(buildCreateSessionPayload({ resumeId, level: "entry" }));
    }

    it("allows three study creates then returns 429 on the fourth", async () => {
      const auth = await seedAuthenticatedUser();
      const item = await seedReviewItem(auth.userId);

      const first = await createStudySession(auth.accessToken, item.id);
      const second = await createStudySession(auth.accessToken, item.id);
      const third = await createStudySession(auth.accessToken, item.id);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(third.status).toBe(201);

      const fourth = await createStudySession(auth.accessToken, item.id);

      expect(fourth.status).toBe(429);
      expect(fourth.body.message).toBe(STUDY_LIMIT_MESSAGE);
      expect(fourth.body.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(fourth.headers["retry-after"]).toBe(
        String(fourth.body.retryAfterSeconds),
      );

      const quota = await request(app)
        .get("/api/session-quota")
        .set(authHeader(auth.accessToken));

      expect(quota.status).toBe(200);
      expect(quota.body.study.remaining).toBe(0);
      expect(quota.body.practice).toEqual({
        used: 0,
        limit: 3,
        remaining: 3,
        retryAfterSeconds: null,
      });

      const sessionCount = await prisma.reviewSession.count({
        where: { userId: auth.userId },
      });
      expect(sessionCount).toBe(3);
    });

    it("keeps practice and study quotas independent", async () => {
      const practiceUser = await seedAuthenticatedUser();
      const studyUser = await seedAuthenticatedUser({
        email: `study-indep-${crypto.randomUUID()}@example.com`,
      });

      const practiceResume = await seedReadyResume(practiceUser.userId);
      const firstPractice = await createPracticeSession(
        practiceUser.accessToken,
        practiceResume.id,
      );
      const secondPractice = await createPracticeSession(
        practiceUser.accessToken,
        practiceResume.id,
      );
      const thirdPractice = await createPracticeSession(
        practiceUser.accessToken,
        practiceResume.id,
      );
      expect(firstPractice.status).toBe(201);
      expect(secondPractice.status).toBe(201);
      expect(thirdPractice.status).toBe(201);

      const practiceItem = await seedReviewItem(practiceUser.userId);
      const studyAfterPractice = await createStudySession(
        practiceUser.accessToken,
        practiceItem.id,
      );
      expect(studyAfterPractice.status).toBe(201);

      const studyItem = await seedReviewItem(studyUser.userId);
      const firstStudy = await createStudySession(
        studyUser.accessToken,
        studyItem.id,
      );
      const secondStudy = await createStudySession(
        studyUser.accessToken,
        studyItem.id,
      );
      const thirdStudy = await createStudySession(
        studyUser.accessToken,
        studyItem.id,
      );
      expect(firstStudy.status).toBe(201);
      expect(secondStudy.status).toBe(201);
      expect(thirdStudy.status).toBe(201);

      const studyResume = await seedReadyResume(studyUser.userId);
      const practiceAfterStudy = await createPracticeSession(
        studyUser.accessToken,
        studyResume.id,
      );
      expect(practiceAfterStudy.status).toBe(201);
    });
  });
});
