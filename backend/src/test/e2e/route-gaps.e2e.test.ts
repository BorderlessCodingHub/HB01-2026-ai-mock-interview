/**
 * Covers routes / cases that had no e2e coverage before (users/me, tutorial,
 * resume list + delete, interview session delete, list pagination, message
 * cursor, review-session delete, internal borderless-session sync).
 *
 * Tests declared with `it.fails` document KNOWN BUGS: they assert the correct
 * behaviour and are expected to fail until the bug is fixed. When a fix lands,
 * vitest will flag the `it.fails` as unexpectedly passing — flip it to `it`.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const storageMock = vi.hoisted(() => ({
  put: vi.fn(async () => undefined),
  get: vi.fn(async () => Buffer.from("%PDF-1.4")),
  delete: vi.fn(async () => undefined),
}));

const resumeQueueMock = vi.hoisted(() => ({
  add: vi.fn(async () => undefined),
}));

const reviewQuestionMock = vi.hoisted(() => ({
  streamQuestion: vi.fn(),
}));

vi.mock("@/infrastructure/storage/r2-client", () => ({
  createR2ObjectStorage: () => storageMock,
}));

vi.mock("@/infrastructure/queue/resume-queue", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/infrastructure/queue/resume-queue")>();
  return {
    ...actual,
    add: resumeQueueMock.add,
  };
});

vi.mock(
  "@/infrastructure/ai/langgraph/nodes/review-session-question-node",
  () => ({
    createReviewSessionQuestionNode: () => ({
      streamQuestion: (
        ...args: Parameters<typeof reviewQuestionMock.streamQuestion>
      ) => reviewQuestionMock.streamQuestion(...args),
    }),
  }),
);

import { randomUUID } from "node:crypto";
import request from "supertest";
import type { Express } from "express";

import { createApp } from "@/config/app";
import prisma from "@/infrastructure/database";
import { MessageRole } from "../../../prisma/generated/client";
import {
  authHeader,
  seedAuthenticatedUser,
} from "@/test/helpers/auth-helpers";
import {
  seedFailedResume,
  seedReadyResume,
} from "@/test/helpers/interview-seed-helpers";
import { truncateTables } from "@/test/containers/truncate-tables";

const INTERNAL_SECRET = "test-internal-auth-sync-secret-min-32-chars";

async function authenticate(): Promise<{ token: string; userId: number }> {
  const auth = await seedAuthenticatedUser();
  return { token: auth.accessToken, userId: auth.userId };
}

async function seedInterviewSession(
  userId: number,
  overrides: { createdAt?: Date } = {},
) {
  const resume = await seedReadyResume(userId);
  return prisma.interviewSession.create({
    data: {
      userId,
      resumeId: resume.id,
      resumeName: resume.name,
      level: "entry",
      interviewLocale: "en",
      maxTurns: 6,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

async function seedMessages(
  sessionId: string,
  userId: number,
  count: number,
): Promise<string[]> {
  const ids: string[] = [];
  const base = Date.now() - count * 1000;
  for (let index = 0; index < count; index += 1) {
    const row = await prisma.interviewMessage.create({
      data: {
        sessionId,
        userId,
        role: index % 2 === 0 ? MessageRole.ai : MessageRole.human,
        content: `message ${index}`,
        createdAt: new Date(base + index * 1000),
      },
    });
    ids.push(row.id);
  }
  return ids;
}

async function seedInProgressReviewSession(
  userId: number,
  options: { pendingQuestion?: string | null } = {},
) {
  const reviewItem = await prisma.reviewItem.create({
    data: {
      userId,
      topic: "Caching",
      angle: "invalidation",
      description: "Explain cache invalidation strategies.",
      priority: "high",
      status: "active",
    },
  });
  return prisma.reviewSession.create({
    data: {
      userId,
      status: "in_progress",
      interviewLocale: "en",
      items: {
        create: [
          {
            reviewItemId: reviewItem.id,
            order: 0,
            topic: reviewItem.topic,
            angle: reviewItem.angle,
            description: reviewItem.description,
            currentPriority: "high",
            turns: [],
            pendingQuestion: options.pendingQuestion ?? null,
          },
        ],
      },
    },
    include: { items: true },
  });
}

describe("Route gap coverage E2E", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    storageMock.put.mockClear();
    storageMock.get.mockClear();
    storageMock.delete.mockReset();
    storageMock.delete.mockResolvedValue(undefined);
    resumeQueueMock.add.mockClear();
    reviewQuestionMock.streamQuestion.mockReset();
    await truncateTables();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("GET /api/users/me", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).get("/api/users/me");
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: "Authentication required" });
    });

    it("returns the frontend MeResponse shape without the password", async () => {
      const { token, userId } = await authenticate();

      const response = await request(app)
        .get("/api/users/me")
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: userId,
        interviewLocale: null,
        hasCompletedTutorial: false,
      });
      expect(response.body).not.toHaveProperty("password");
    });
  });

  describe("PATCH /api/users/me/tutorial", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).patch("/api/users/me/tutorial");
      expect(response.status).toBe(401);
    });

    it("marks the tutorial completed, persists it and is idempotent", async () => {
      const { token, userId } = await authenticate();

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await request(app)
          .patch("/api/users/me/tutorial")
          .set(authHeader(token));
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ hasCompletedTutorial: true });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.hasCompletedTutorial).toBe(true);

      const me = await request(app)
        .get("/api/users/me")
        .set(authHeader(token));
      expect(me.body.hasCompletedTutorial).toBe(true);
    });
  });

  describe("GET /api/resumes/", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).get("/api/resumes/");
      expect(response.status).toBe(401);
    });

    it("lists only the caller's resumes and hides raw error messages", async () => {
      const { token, userId } = await authenticate();
      const other = await authenticate();
      const ready = await seedReadyResume(userId);
      const failed = await seedFailedResume(
        userId,
        randomUUID(),
        "secret internal stack detail",
      );
      await seedReadyResume(other.userId);

      const response = await request(app)
        .get("/api/resumes/")
        .set(authHeader(token));

      expect(response.status).toBe(200);
      const ids = (response.body.resumes as Array<{ id: string }>).map(
        (resume) => resume.id,
      );
      expect(ids.sort()).toEqual([ready.id, failed.id].sort());

      const failedRow = (
        response.body.resumes as Array<Record<string, unknown>>
      ).find((resume) => resume.id === failed.id)!;
      expect(failedRow.status).toBe("failed");
      expect(typeof failedRow.failureReason).toBe("string");
      expect(JSON.stringify(response.body)).not.toContain(
        "secret internal stack detail",
      );
      expect(JSON.stringify(response.body)).not.toContain("storageKey");
    });
  });

  describe("DELETE /api/resumes/:id", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).delete(`/api/resumes/${randomUUID()}`);
      expect(response.status).toBe(401);
    });

    it("returns 404 for another user's resume and does not delete it", async () => {
      const { token } = await authenticate();
      const other = await authenticate();
      const resume = await seedReadyResume(other.userId);

      const response = await request(app)
        .delete(`/api/resumes/${resume.id}`)
        .set(authHeader(token));

      expect(response.status).toBe(404);
      expect(storageMock.delete).not.toHaveBeenCalled();
      expect(
        await prisma.resume.findUnique({ where: { id: resume.id } }),
      ).not.toBeNull();
    });

    it("returns 404 for a non-uuid id instead of 500", async () => {
      const { token } = await authenticate();
      const response = await request(app)
        .delete("/api/resumes/not-a-uuid")
        .set(authHeader(token));
      expect(response.status).toBe(404);
    });

    it("returns 204, removes the row and deletes the stored object", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const response = await request(app)
        .delete(`/api/resumes/${resume.id}`)
        .set(authHeader(token));

      expect(response.status).toBe(204);
      expect(storageMock.delete).toHaveBeenCalledWith(resume.storageKey);
      expect(
        await prisma.resume.findUnique({ where: { id: resume.id } }),
      ).toBeNull();

      const again = await request(app)
        .delete(`/api/resumes/${resume.id}`)
        .set(authHeader(token));
      expect(again.status).toBe(404);
    });

    it("still returns 204 when the storage delete fails (best effort)", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);
      storageMock.delete.mockRejectedValueOnce(new Error("r2 down"));

      const response = await request(app)
        .delete(`/api/resumes/${resume.id}`)
        .set(authHeader(token));

      expect(response.status).toBe(204);
    });
  });

  describe("DELETE /api/interview/sessions/:sessionId", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).delete(
        `/api/interview/sessions/${randomUUID()}`,
      );
      expect(response.status).toBe(401);
    });

    it("returns 404 for another user's session and keeps it", async () => {
      const { token } = await authenticate();
      const other = await authenticate();
      const session = await seedInterviewSession(other.userId);

      const response = await request(app)
        .delete(`/api/interview/sessions/${session.id}`)
        .set(authHeader(token));

      expect(response.status).toBe(404);
      expect(
        await prisma.interviewSession.findUnique({ where: { id: session.id } }),
      ).not.toBeNull();
    });

    it("returns 404 for an unknown session", async () => {
      const { token } = await authenticate();
      const response = await request(app)
        .delete(`/api/interview/sessions/${randomUUID()}`)
        .set(authHeader(token));
      expect(response.status).toBe(404);
    });

    it("returns 204 and cascades messages for the owner", async () => {
      const { token, userId } = await authenticate();
      const session = await seedInterviewSession(userId);
      await seedMessages(session.id, userId, 3);

      const response = await request(app)
        .delete(`/api/interview/sessions/${session.id}`)
        .set(authHeader(token));

      expect(response.status).toBe(204);
      expect(
        await prisma.interviewMessage.count({
          where: { sessionId: session.id },
        }),
      ).toBe(0);

      const detail = await request(app)
        .get(`/api/interview/sessions/${session.id}`)
        .set(authHeader(token));
      expect(detail.status).toBe(404);
    });
  });

  describe("GET /api/interview/sessions pagination", () => {
    it("paginates with page/limit/hasMore and distinct ids, newest first", async () => {
      const { token, userId } = await authenticate();
      const base = Date.now();
      for (let index = 0; index < 5; index += 1) {
        await seedInterviewSession(userId, {
          createdAt: new Date(base - index * 60_000),
        });
      }

      const page1 = await request(app)
        .get("/api/interview/sessions?page=1&limit=2")
        .set(authHeader(token));
      const page3 = await request(app)
        .get("/api/interview/sessions?page=3&limit=2")
        .set(authHeader(token));
      const page4 = await request(app)
        .get("/api/interview/sessions?page=4&limit=2")
        .set(authHeader(token));

      expect(page1.status).toBe(200);
      expect(page1.body).toMatchObject({ page: 1, limit: 2, hasMore: true });
      expect(page1.body.sessions).toHaveLength(2);
      expect(page3.body).toMatchObject({ page: 3, limit: 2, hasMore: false });
      expect(page3.body.sessions).toHaveLength(1);
      expect(page4.body.sessions).toEqual([]);
      expect(page4.body.hasMore).toBe(false);

      const first = page1.body.sessions[0];
      expect(first).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          resumeName: expect.any(String),
          turnCount: 0,
          maxTurns: 6,
          isFinished: false,
          hasJobDescription: false,
          reviewGenerationStatus: "idle",
          feedback: null,
        }),
      );
      expect(
        new Date(page1.body.sessions[0].createdAt).getTime(),
      ).toBeGreaterThan(new Date(page1.body.sessions[1].createdAt).getTime());
    });

    it.each([
      ["page=0", "page"],
      ["limit=0", "limit"],
      ["limit=51", "limit"],
      ["limit=abc", "limit"],
      ["page=1.5", "page"],
    ])("returns 422 for invalid query %s", async (query) => {
      const { token } = await authenticate();
      const response = await request(app)
        .get(`/api/interview/sessions?${query}`)
        .set(authHeader(token));
      expect(response.status).toBe(422);
      expect(response.body.message).toBe("Validation failed");
    });
  });

  describe("GET /api/interview/sessions/:id/messages cursor", () => {
    it("pages backwards with `before` and returns chronological order", async () => {
      const { token, userId } = await authenticate();
      const session = await seedInterviewSession(userId);
      const ids = await seedMessages(session.id, userId, 5);

      const latest = await request(app)
        .get(`/api/interview/sessions/${session.id}/messages?limit=2`)
        .set(authHeader(token));
      expect(latest.status).toBe(200);
      expect(latest.body.hasMore).toBe(true);
      expect(
        (latest.body.messages as Array<{ id: string }>).map((m) => m.id),
      ).toEqual([ids[3], ids[4]]);

      const older = await request(app)
        .get(
          `/api/interview/sessions/${session.id}/messages?limit=2&before=${ids[3]}`,
        )
        .set(authHeader(token));
      expect(
        (older.body.messages as Array<{ id: string }>).map((m) => m.id),
      ).toEqual([ids[1], ids[2]]);
      expect(older.body.hasMore).toBe(true);

      const oldest = await request(app)
        .get(
          `/api/interview/sessions/${session.id}/messages?limit=2&before=${ids[1]}`,
        )
        .set(authHeader(token));
      expect(
        (oldest.body.messages as Array<{ id: string }>).map((m) => m.id),
      ).toEqual([ids[0]]);
      expect(oldest.body.hasMore).toBe(false);
    });

    it("returns 422 when `before` is not a uuid or limit is out of range", async () => {
      const { token, userId } = await authenticate();
      const session = await seedInterviewSession(userId);

      for (const query of ["before=nope", "limit=0", "limit=51"]) {
        const response = await request(app)
          .get(`/api/interview/sessions/${session.id}/messages?${query}`)
          .set(authHeader(token));
        expect(response.status).toBe(422);
      }
    });

    // BUG: an unknown / foreign `before` cursor silently falls back to the
    // newest page, so a client paging backwards receives duplicates.
    it.fails(
      "does not return the newest page for an unknown `before` cursor",
      async () => {
        const { token, userId } = await authenticate();
        const session = await seedInterviewSession(userId);
        await seedMessages(session.id, userId, 3);

        const response = await request(app)
          .get(
            `/api/interview/sessions/${session.id}/messages?limit=2&before=${randomUUID()}`,
          )
          .set(authHeader(token));

        const ok =
          response.status === 422 ||
          response.status === 404 ||
          (response.status === 200 && response.body.messages.length === 0);
        expect(ok).toBe(true);
      },
    );
  });

  describe("POST /api/interview/sessions/:sessionId/feedback (gaps)", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .post(`/api/interview/sessions/${randomUUID()}/feedback`)
        .send({ rating: "up" });
      expect(response.status).toBe(401);
    });

    it("returns 404 for an unknown session", async () => {
      const { token } = await authenticate();
      const response = await request(app)
        .post(`/api/interview/sessions/${randomUUID()}/feedback`)
        .set(authHeader(token))
        .send({ rating: "up" });
      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/interview/sessions/:sessionId/review-generation/retry (gaps)", () => {
    it("returns 404 for another user's failed session", async () => {
      const { token } = await authenticate();
      const other = await authenticate();
      const session = await seedInterviewSession(other.userId);
      await prisma.interviewSession.update({
        where: { id: session.id },
        data: { isFinished: true, reviewGenerationStatus: "failed" },
      });

      const response = await request(app)
        .post(
          `/api/interview/sessions/${session.id}/review-generation/retry`,
        )
        .set(authHeader(token));
      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/review-sessions/:id", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).delete(
        `/api/review-sessions/${randomUUID()}`,
      );
      expect(response.status).toBe(401);
    });

    it("returns 404 for another user's review session and keeps it", async () => {
      const { token } = await authenticate();
      const other = await authenticate();
      const reviewSession = await seedInProgressReviewSession(other.userId);

      const response = await request(app)
        .delete(`/api/review-sessions/${reviewSession.id}`)
        .set(authHeader(token));

      expect(response.status).toBe(404);
      expect(
        await prisma.reviewSession.findUnique({
          where: { id: reviewSession.id },
        }),
      ).not.toBeNull();
    });

    it("returns 204 for the owner and keeps the underlying review item", async () => {
      const { token, userId } = await authenticate();
      const reviewSession = await seedInProgressReviewSession(userId);
      const reviewItemId = reviewSession.items[0]!.reviewItemId!;

      const response = await request(app)
        .delete(`/api/review-sessions/${reviewSession.id}`)
        .set(authHeader(token));
      expect(response.status).toBe(204);

      const detail = await request(app)
        .get(`/api/review-sessions/${reviewSession.id}`)
        .set(authHeader(token));
      expect(detail.status).toBe(404);
      expect(
        await prisma.reviewItem.findUnique({ where: { id: reviewItemId } }),
      ).not.toBeNull();
    });
  });

  describe("POST /api/review-sessions/:id/stream recovery", () => {
    // BUG: the answer is persisted (pendingQuestion cleared) before the next
    // question is generated. If generation fails, a 429 token limit hits, or
    // the client disconnects, the session can never progress again: retrying
    // with the answer → 400 "No pending question", without → 400 "Answer is
    // required".
    it(
      "lets the user continue after next-question generation failed",
      async () => {
        const { token, userId } = await authenticate();
        const reviewSession = await seedInProgressReviewSession(userId, {
          pendingQuestion: "How do you invalidate a cache?",
        });

        reviewQuestionMock.streamQuestion.mockImplementationOnce(() =>
          (async function* () {
            yield { content: "partial" };
            throw new Error("LLM unavailable");
          })(),
        );

        const failed = await request(app)
          .post(`/api/review-sessions/${reviewSession.id}/stream`)
          .set(authHeader(token))
          .send({ answer: "TTL plus explicit purge.", interviewLocale: "en" });
        expect(failed.status).toBe(200);
        expect(failed.text).toContain("event: error");

        reviewQuestionMock.streamQuestion.mockImplementation(() =>
          (async function* () {
            yield { content: "Next?" };
            return { content: "Next?" };
          })(),
        );

        const retryWithoutAnswer = await request(app)
          .post(`/api/review-sessions/${reviewSession.id}/stream`)
          .set(authHeader(token))
          .send({ interviewLocale: "en" });
        const retryWithAnswer = await request(app)
          .post(`/api/review-sessions/${reviewSession.id}/stream`)
          .set(authHeader(token))
          .send({ answer: "TTL plus explicit purge.", interviewLocale: "en" });

        expect(
          retryWithoutAnswer.status === 200 || retryWithAnswer.status === 200,
        ).toBe(true);
      },
    );
  });

  describe("internal borderless session sync", () => {
    const opaqueToken = () => `opaque-${randomUUID()}`;

    it("POST returns 401 without or with a wrong internal secret", async () => {
      const missing = await request(app)
        .post("/internal/borderless-sessions")
        .send({ accessToken: opaqueToken(), externalId: "x", email: "x@e.com" });
      const wrong = await request(app)
        .post("/internal/borderless-sessions")
        .set("X-Internal-Auth-Secret", "nope")
        .send({ accessToken: opaqueToken(), externalId: "x", email: "x@e.com" });

      expect(missing.status).toBe(401);
      expect(wrong.status).toBe(401);
    });

    it("POST returns 400 when required fields are missing", async () => {
      const response = await request(app)
        .post("/internal/borderless-sessions")
        .set("X-Internal-Auth-Secret", INTERNAL_SECRET)
        .send({ accessToken: opaqueToken() });
      expect(response.status).toBe(400);
    });

    it("registers an opaque token that authenticates, then invalidates it", async () => {
      const token = opaqueToken();
      const register = await request(app)
        .post("/internal/borderless-sessions")
        .set("X-Internal-Auth-Secret", INTERNAL_SECRET)
        .send({
          accessToken: token,
          externalId: `ext-${randomUUID()}`,
          email: `opaque-${randomUUID()}@example.com`,
          name: "Opaque User",
          expiresIn: 600,
        });
      expect(register.status).toBe(204);

      const me = await request(app)
        .get("/api/users/me")
        .set(authHeader(token));
      expect(me.status).toBe(200);
      expect(me.body.name).toBe("Opaque User");

      const invalidate = await request(app)
        .delete("/internal/borderless-sessions")
        .set(authHeader(token));
      expect(invalidate.status).toBe(204);

      const after = await request(app)
        .get("/api/users/me")
        .set(authHeader(token));
      expect(after.status).toBe(401);
    });

    it("DELETE returns 400 without any token", async () => {
      const response = await request(app)
        .delete("/internal/borderless-sessions")
        .send({});
      expect(response.status).toBe(400);
    });
  });
});
