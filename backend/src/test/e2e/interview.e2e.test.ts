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

import { randomUUID } from "node:crypto";
import request from "supertest";
import type { Express } from "express";

import { createApp } from "@/config/app";
import { makeReviewGenerationService } from "@/factories/interview/review-generation-service-factory";
import prisma from "@/infrastructure/database";
import { MessageRole, ResumeStatus } from "../../../prisma/generated/client";
import {
  authHeader,
  seedAuthenticatedUser,
} from "@/test/helpers/auth-helpers";
import {
  buildCreateSessionPayload,
  buildStreamMessagePayload,
  sampleStructuredSummary,
  seedFailedResume,
  seedProcessingResume,
  seedReadyResume,
} from "@/test/helpers/interview-seed-helpers";
import { truncateTables } from "@/test/containers/truncate-tables";

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

describe("Interview API E2E", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    interviewGraphMock.streamMessages.mockClear();
    reviewItemsGeneratorMock.generate.mockClear();
    await truncateTables();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("POST /api/interview/sessions", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .post("/api/interview/sessions")
        .send(
          buildCreateSessionPayload({
            resumeId: randomUUID(),
            level: "entry",
          }),
        );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("returns 422 when payload is invalid", async () => {
      const { token } = await authenticate();

      const response = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send({
          resumeId: "not-a-uuid",
          level: "junior",
          interviewLocale: "en",
        });

      expect(response.status).toBe(422);
      expect(response.body.message).toBe("Validation failed");
      expect(response.body.errors).toBeDefined();
    });

    it("returns 422 when interviewLocale is omitted", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const response = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send({ resumeId: resume.id, level: "entry" });

      expect(response.status).toBe(422);
      expect(response.body.message).toBe("Validation failed");
      expect(response.body.errors).toBeDefined();
    });

    it("returns 201 when session is created for a ready resume", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const response = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
            interviewLocale: "en",
          }),
        );

      expect(response.status).toBe(201);
      expect(response.body.id).toEqual(expect.any(String));

      const session = await prisma.interviewSession.findUnique({
        where: { id: response.body.id as string },
      });
      expect(session?.interviewLocale).toBe("en");
    });

    it("returns 400 when resume is still processing", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedProcessingResume(userId);

      const reloaded = await prisma.resume.findUnique({
        where: { id: resume.id },
      });
      expect(reloaded?.status).toBe(ResumeStatus.processing);

      const response = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: "Resume is still being processed",
      });
    });

    it("returns 400 when resume processing failed", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedFailedResume(userId);

      const reloaded = await prisma.resume.findUnique({
        where: { id: resume.id },
      });
      expect(reloaded?.status).toBe(ResumeStatus.failed);
      expect(reloaded?.errorMessage).toBe("PDF extraction failed");

      const response = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Resume processing failed" });
    });

    it("returns 404 when resume does not exist or belongs to another user", async () => {
      const { token, userId } = await authenticate();

      const missingResumeResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: randomUUID(),
            level: "entry",
          }),
        );

      expect(missingResumeResponse.status).toBe(404);
      expect(missingResumeResponse.body).toEqual({ message: "Not Found" });

      const resume = await seedReadyResume(userId);

      const other = await seedAuthenticatedUser({
        email: "other-resume@example.com",
        name: "Other Resume User",
      });

      const otherUserResumeResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(other.accessToken))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      expect(otherUserResumeResponse.status).toBe(404);
      expect(otherUserResumeResponse.body).toEqual({ message: "Not Found" });
    });

    it("returns 201 when session is created with an optional job description", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const response = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "mid",
            interviewLocale: "pt",
            jobDescription: "Senior Backend Engineer with Node.js experience",
          }),
        );

      expect(response.status).toBe(201);
      expect(response.body.id).toEqual(expect.any(String));

      const session = await prisma.interviewSession.findUnique({
        where: { id: response.body.id as string },
      });
      expect(session?.jobDescription).toBe(
        "Senior Backend Engineer with Node.js experience",
      );
      expect(session?.interviewLocale).toBe("pt");
    });

    it("returns 422 when job description exceeds max length", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const response = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
            jobDescription: "x".repeat(5_001),
          }),
        );

      expect(response.status).toBe(422);
      expect(response.body.message).toBe("Validation failed");
    });
  });

  describe("GET /api/interview/sessions", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).get("/api/interview/sessions");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("returns 200 with the user's sessions", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "mid",
          }),
        );

      const response = await request(app)
        .get("/api/interview/sessions")
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.sessions[0]).toMatchObject({
        id: createResponse.body.id,
        resumeId: resume.id,
        resumeName: resume.name,
        level: "mid",
        turnCount: 0,
        maxTurns: 6,
        isFinished: false,
        hasJobDescription: false,
        reviewGenerationStatus: "idle",
        reviewGenerationError: null,
      });
      expect(response.body.sessions[0].createdAt).toEqual(expect.any(String));
    });

    it("keeps resumeName after the resume is deleted", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);
      const resumeName = resume.name;

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "mid",
          }),
        );

      expect(createResponse.status).toBe(201);

      const deleteResponse = await request(app)
        .delete(`/api/resumes/${resume.id}`)
        .set(authHeader(token));

      expect(deleteResponse.status).toBe(204);

      const response = await request(app)
        .get("/api/interview/sessions")
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.sessions[0]).toMatchObject({
        id: createResponse.body.id,
        resumeId: null,
        resumeName,
      });
    });
  });

  describe("GET /api/interview/sessions/:sessionId", () => {
    it("returns 200 with session summary including review generation status", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      const response = await request(app)
        .get(`/api/interview/sessions/${sessionId}`)
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: sessionId,
        resumeId: resume.id,
        resumeName: resume.name,
        level: "entry",
        turnCount: 0,
        maxTurns: 6,
        isFinished: false,
        hasJobDescription: false,
        reviewGenerationStatus: "idle",
        reviewGenerationError: null,
      });
      expect(response.body.createdAt).toEqual(expect.any(String));
    });

    it("returns 404 for a session that does not belong to the user", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      const other = await seedAuthenticatedUser({
        email: "get-session-other@example.com",
        name: "Get Session Other",
      });

      const response = await request(app)
        .get(`/api/interview/sessions/${sessionId}`)
        .set(authHeader(other.accessToken));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Not Found" });
    });
  });

  describe("GET /api/interview/sessions/:id/messages", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).get(
        `/api/interview/sessions/${randomUUID()}/messages`,
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("returns 200 with session messages", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      await prisma.interviewMessage.createMany({
        data: [
          {
            sessionId,
            userId,
            role: MessageRole.human,
            content: "Tell me about yourself",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            sessionId,
            userId,
            role: MessageRole.ai,
            content: "Great question.",
            createdAt: new Date("2026-01-01T00:00:01.000Z"),
          },
        ],
      });

      const response = await request(app)
        .get(`/api/interview/sessions/${sessionId}/messages`)
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0]).toMatchObject({
        role: "human",
        content: "Tell me about yourself",
      });
      expect(response.body.messages[1]).toMatchObject({
        role: "ai",
        content: "Great question.",
      });
    });

    it("returns 404 for a session that does not belong to the user", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      const other = await seedAuthenticatedUser({
        email: "other@example.com",
        name: "Other User",
      });

      const response = await request(app)
        .get(`/api/interview/sessions/${sessionId}/messages`)
        .set(authHeader(other.accessToken));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Not Found" });
    });

    it("returns 404 when session does not exist", async () => {
      const { token } = await authenticate();

      const response = await request(app)
        .get(`/api/interview/sessions/${randomUUID()}/messages`)
        .set(authHeader(token));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Not Found" });
    });
  });

  describe("POST /api/interview/sessions/:sessionId/stream", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .post(`/api/interview/sessions/${randomUUID()}/stream`)
        .send(buildStreamMessagePayload());

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("returns 409 when interview session is finished", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { isFinished: true },
      });

      const response = await request(app)
        .post(`/api/interview/sessions/${sessionId}/stream`)
        .set(authHeader(token))
        .send(buildStreamMessagePayload());

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        message: "Interview session is finished",
      });
      expect(interviewGraphMock.streamMessages).not.toHaveBeenCalled();
    });

    it("returns SSE headers and streams mocked graph tokens", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
            interviewLocale: "pt",
          }),
        );

      const sessionId = createResponse.body.id as string;

      const response = await request(app)
        .post(`/api/interview/sessions/${sessionId}/stream`)
        .set(authHeader(token))
        .send(
          buildStreamMessagePayload({
            content: "Hello interviewer",
            interviewLocale: "pt",
          }),
        );

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");
      expect(response.headers["cache-control"]).toBe("no-cache");
      expect(response.text).toContain("event: token");
      expect(response.text).toContain("event: meta");
      expect(response.text).toContain("data: [DONE]");
      expect(interviewGraphMock.streamMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeSummary: sampleStructuredSummary,
          runReview: false,
          interviewLocale: "pt",
        }),
        expect.objectContaining({ threadId: sessionId }),
      );
    });

    it("returns 422 when interviewLocale is omitted", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      const response = await request(app)
        .post(`/api/interview/sessions/${sessionId}/stream`)
        .set(authHeader(token))
        .send({ content: "Hello interviewer" });

      expect(response.status).toBe(422);
      expect(response.body.message).toBe("Validation failed");
      expect(response.body.errors).toBeDefined();
      expect(interviewGraphMock.streamMessages).not.toHaveBeenCalled();
    });

    it("returns 404 when session does not exist or belongs to another user", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      const missingSessionResponse = await request(app)
        .post(`/api/interview/sessions/${randomUUID()}/stream`)
        .set(authHeader(token))
        .send(buildStreamMessagePayload());

      expect(missingSessionResponse.status).toBe(404);
      expect(missingSessionResponse.body).toEqual({ message: "Not Found" });

      const other = await seedAuthenticatedUser({
        email: "stream-other@example.com",
        name: "Stream Other User",
      });

      const otherUserResponse = await request(app)
        .post(`/api/interview/sessions/${sessionId}/stream`)
        .set(authHeader(other.accessToken))
        .send(buildStreamMessagePayload());

      expect(otherUserResponse.status).toBe(404);
      expect(otherUserResponse.body).toEqual({ message: "Not Found" });
      expect(interviewGraphMock.streamMessages).not.toHaveBeenCalled();
    });

    it("returns 422 when stream payload is invalid", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      const response = await request(app)
        .post(`/api/interview/sessions/${sessionId}/stream`)
        .set(authHeader(token))
        .send(buildStreamMessagePayload({ content: "" }));

      expect(response.status).toBe(422);
      expect(response.body.message).toBe("Validation failed");
      expect(response.body.errors).toBeDefined();
      expect(interviewGraphMock.streamMessages).not.toHaveBeenCalled();
    });

    it("marks session finished with pending review generation without invoking generator", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
            interviewLocale: "en",
          }),
        );

      const sessionId = createResponse.body.id as string;

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { turnCount: 5 },
      });

      const response = await request(app)
        .post(`/api/interview/sessions/${sessionId}/stream`)
        .set(authHeader(token))
        .send(
          buildStreamMessagePayload({
            content: "Final answer",
            interviewLocale: "pt",
          }),
        );

      expect(response.status).toBe(200);
      expect(response.text).toContain('"isFinished":true');
      expect(response.text).toContain('"reviewGenerationStatus":"pending"');
      expect(reviewItemsGeneratorMock.generate).not.toHaveBeenCalled();

      const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
      });
      expect(session?.isFinished).toBe(true);
      expect(session?.interviewLocale).toBe("pt");
      expect(session?.reviewGenerationStatus).toBe("pending");
      expect(session?.reviewGenerationError).toBeNull();
    });

    it("marks review generation ready after process runs", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
            interviewLocale: "en",
          }),
        );

      const sessionId = createResponse.body.id as string;

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { turnCount: 5 },
      });

      const streamResponse = await request(app)
        .post(`/api/interview/sessions/${sessionId}/stream`)
        .set(authHeader(token))
        .send(
          buildStreamMessagePayload({
            content: "Final answer",
            interviewLocale: "en",
          }),
        );

      expect(streamResponse.status).toBe(200);
      expect(reviewItemsGeneratorMock.generate).not.toHaveBeenCalled();

      reviewItemsGeneratorMock.generate.mockResolvedValueOnce({
        items: [
          {
            topic: "Communication",
            angle: "conciseness under pressure",
            description: "Be more concise",
            priority: "medium",
          },
        ],
      });

      const result = await makeReviewGenerationService().process(sessionId);

      expect(result).toEqual({ status: "ready", sessionId });
      expect(reviewItemsGeneratorMock.generate).toHaveBeenCalled();

      const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
      });
      expect(session?.reviewGenerationStatus).toBe("ready");
      expect(session?.reviewGenerationError).toBeNull();

      const reviewItems = await prisma.reviewItem.findMany({
        where: { userId },
      });
      expect(reviewItems.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("POST /api/interview/sessions/:sessionId/review-generation/retry", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).post(
        `/api/interview/sessions/${randomUUID()}/review-generation/retry`,
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("retries from failed and returns pending status", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          isFinished: true,
          reviewGenerationStatus: "failed",
          reviewGenerationError: "previous failure",
        },
      });

      const response = await request(app)
        .post(`/api/interview/sessions/${sessionId}/review-generation/retry`)
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: sessionId,
        isFinished: true,
        reviewGenerationStatus: "pending",
        reviewGenerationError: null,
      });

      const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
      });
      expect(session?.reviewGenerationStatus).toBe("pending");
      expect(session?.reviewGenerationError).toBeNull();
    });

    it("returns 409 when review generation is ready", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          isFinished: true,
          reviewGenerationStatus: "ready",
        },
      });

      const response = await request(app)
        .post(`/api/interview/sessions/${sessionId}/review-generation/retry`)
        .set(authHeader(token));

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        message:
          "Review generation can only be retried when the session is finished and generation failed",
      });
    });

    it("returns 409 when review generation is pending or idle", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          isFinished: true,
          reviewGenerationStatus: "pending",
        },
      });

      const pendingResponse = await request(app)
        .post(`/api/interview/sessions/${sessionId}/review-generation/retry`)
        .set(authHeader(token));

      expect(pendingResponse.status).toBe(409);

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          isFinished: false,
          reviewGenerationStatus: "idle",
        },
      });

      const idleResponse = await request(app)
        .post(`/api/interview/sessions/${sessionId}/review-generation/retry`)
        .set(authHeader(token));

      expect(idleResponse.status).toBe(409);
    });
  });

  describe("AI rate limiting", () => {
    let rateLimitedApp: Express;
    let previousMax: string | undefined;
    let previousWindow: string | undefined;

    async function flushAiRateLimitKeys(): Promise<void> {
      const { redisConnection } =
        await import("@/infrastructure/queue/resume-queue");
      const redis = redisConnection as import("ioredis").default;
      const keys = await redis.keys("rl:ai:*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    async function createSessionAndGetId(
      appInstance: Express,
      token: string,
      resumeId: string,
    ): Promise<string> {
      const response = await request(appInstance)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId,
            level: "entry",
          }),
        )
        .expect(201);

      return response.body.id as string;
    }

    function streamTurn(
      appInstance: Express,
      token: string,
      sessionId: string,
    ) {
      return request(appInstance)
        .post(`/api/interview/sessions/${sessionId}/stream`)
        .set(authHeader(token))
        .send(buildStreamMessagePayload());
    }

    beforeAll(async () => {
      previousMax = process.env.RATE_LIMIT_AI_MAX;
      previousWindow = process.env.RATE_LIMIT_AI_WINDOW_MS;
      process.env.RATE_LIMIT_AI_MAX = "2";
      process.env.RATE_LIMIT_AI_WINDOW_MS = "60000";
      vi.resetModules();
      await flushAiRateLimitKeys();

      const { createApp: createAppWithRateLimit } =
        await import("@/config/app");
      rateLimitedApp = await createAppWithRateLimit();
    });

    beforeEach(async () => {
      await flushAiRateLimitKeys();
    });

    afterAll(() => {
      process.env.RATE_LIMIT_AI_MAX = previousMax;
      process.env.RATE_LIMIT_AI_WINDOW_MS = previousWindow;
      vi.resetModules();
    });

    it("returns 429 when exceeding RATE_LIMIT_AI_MAX", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);
      const sessionId = await createSessionAndGetId(
        rateLimitedApp,
        token,
        resume.id,
      );

      await streamTurn(rateLimitedApp, token, sessionId).expect(200);
      await streamTurn(rateLimitedApp, token, sessionId).expect(200);

      const response = await streamTurn(rateLimitedApp, token, sessionId);

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        message: "Too many requests, please try again later.",
      });
    });

    it("isolates rate limits per authenticated user", async () => {
      const { token: tokenA, userId: userIdA } =
        await authenticate();
      const resumeA = await seedReadyResume(userIdA);
      const sessionIdA = await createSessionAndGetId(
        rateLimitedApp,
        tokenA,
        resumeA.id,
      );

      await streamTurn(rateLimitedApp, tokenA, sessionIdA).expect(200);
      await streamTurn(rateLimitedApp, tokenA, sessionIdA).expect(200);
      await streamTurn(rateLimitedApp, tokenA, sessionIdA).expect(429);

      const other = await seedAuthenticatedUser({
        email: "rate-limit-user-b@example.com",
        name: "Rate Limit User B",
      });
      const resumeB = await seedReadyResume(other.userId);
      const sessionIdB = await createSessionAndGetId(
        rateLimitedApp,
        other.accessToken,
        resumeB.id,
      );

      await streamTurn(rateLimitedApp, other.accessToken, sessionIdB).expect(200);
      await streamTurn(rateLimitedApp, other.accessToken, sessionIdB).expect(200);

      const response = await streamTurn(
        rateLimitedApp,
        other.accessToken,
        sessionIdB,
      );

      expect(response.status).toBe(429);
    });

    it("does not rate limit GET /sessions after AI route returns 429", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);
      const sessionId = await createSessionAndGetId(
        rateLimitedApp,
        token,
        resume.id,
      );

      await streamTurn(rateLimitedApp, token, sessionId).expect(200);
      await streamTurn(rateLimitedApp, token, sessionId).expect(200);
      await streamTurn(rateLimitedApp, token, sessionId).expect(429);

      const response = await request(rateLimitedApp)
        .get("/api/interview/sessions")
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.sessions).toHaveLength(1);
    });
  });

  describe("POST /api/interview/sessions/:sessionId/feedback", () => {
    it("returns 201 when submitting feedback for own session", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      const response = await request(app)
        .post(`/api/interview/sessions/${sessionId}/feedback`)
        .set(authHeader(token))
        .send({ rating: "up", comment: "Helpful session" });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        sessionId,
        userId,
        rating: "up",
        comment: "Helpful session",
      });
    });

    it("returns 404 when submitting feedback for another user's session", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      const other = await seedAuthenticatedUser({
        email: "feedback-other@example.com",
        name: "Feedback Other User",
      });

      const response = await request(app)
        .post(`/api/interview/sessions/${sessionId}/feedback`)
        .set(authHeader(other.accessToken))
        .send({ rating: "down" });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Not Found" });
    });

    it("returns 422 for invalid feedback body", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const createResponse = await request(app)
        .post("/api/interview/sessions")
        .set(authHeader(token))
        .send(
          buildCreateSessionPayload({
            resumeId: resume.id,
            level: "entry",
          }),
        );

      const sessionId = createResponse.body.id as string;

      const response = await request(app)
        .post(`/api/interview/sessions/${sessionId}/feedback`)
        .set(authHeader(token))
        .send({ rating: "invalid" });

      expect(response.status).toBe(422);
      expect(response.body.message).toBe("Validation failed");
    });
  });
});
