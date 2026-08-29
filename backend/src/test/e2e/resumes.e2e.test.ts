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
}));

const resumeQueueMock = vi.hoisted(() => ({
  add: vi.fn(async () => undefined),
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

import { randomUUID } from "node:crypto";
import request from "supertest";
import type { Express } from "express";

import { createApp } from "@/config/app";
import { env } from "@/config/env";
import prisma from "@/infrastructure/database";
import { ResumeStatus } from "../../../prisma/generated/client";
import {
  authHeader,
  seedAuthenticatedUser,
} from "@/test/helpers/auth-helpers";
import {
  sampleStructuredSummary,
  seedReadyResume,
} from "@/test/helpers/interview-seed-helpers";
import { truncateTables } from "@/test/containers/truncate-tables";

const minimalPdfBuffer = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF",
);

const minimalTexBuffer = Buffer.from(
  "\\documentclass{article}\\begin{document}Hi\\end{document}",
);

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

describe("Resumes API E2E", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    storageMock.put.mockClear();
    resumeQueueMock.add.mockClear();
    await truncateTables();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("POST /api/resumes/", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .post("/api/resumes/")
        .attach("file", minimalPdfBuffer, {
          filename: "resume.pdf",
          contentType: "application/pdf",
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("returns 201 and uploads PDF with mocked storage and queue", async () => {
      const { token, userId } = await authenticate();

      const response = await request(app)
        .post("/api/resumes/")
        .set(authHeader(token))
        .attach("file", minimalPdfBuffer, {
          filename: "my-resume.pdf",
          contentType: "application/pdf",
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: "my-resume.pdf",
        status: ResumeStatus.processing,
      });
      expect(response.body.createdAt).toEqual(expect.any(String));
      expect(response.body).not.toHaveProperty("sourceFormat");
      expect(storageMock.put).toHaveBeenCalledWith(
        `users/${userId}/resumes/${response.body.id}.pdf`,
        expect.any(Buffer),
        "application/pdf",
      );
      expect(resumeQueueMock.add).toHaveBeenCalledWith({
        resumeId: response.body.id,
      });
    });

    it("returns 201 and uploads TeX classified by extension, ignoring MIME", async () => {
      const { token, userId } = await authenticate();

      const response = await request(app)
        .post("/api/resumes/")
        .set(authHeader(token))
        .attach("file", minimalTexBuffer, {
          filename: "cv.tex",
          contentType: "text/plain",
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: "cv.tex",
        status: ResumeStatus.processing,
      });
      expect(response.body).not.toHaveProperty("sourceFormat");
      expect(storageMock.put).toHaveBeenCalledWith(
        `users/${userId}/resumes/${response.body.id}.tex`,
        expect.any(Buffer),
        "text/x-tex",
      );
      expect(resumeQueueMock.add).toHaveBeenCalledWith({
        resumeId: response.body.id,
      });
    });

    it("returns 400 when no PDF file is attached", async () => {
      const { token } = await authenticate();

      const response = await request(app)
        .post("/api/resumes/")
        .set(authHeader(token));

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: "Resume file is required",
      });
      expect(storageMock.put).not.toHaveBeenCalled();
      expect(resumeQueueMock.add).not.toHaveBeenCalled();
    });

    it("returns 400 when file is not a PDF", async () => {
      const { token } = await authenticate();

      const response = await request(app)
        .post("/api/resumes/")
        .set(authHeader(token))
        .attach("file", minimalPdfBuffer, {
          filename: "resume.txt",
          contentType: "text/plain",
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: "Only PDF and TeX files are allowed",
      });
      expect(storageMock.put).not.toHaveBeenCalled();
      expect(resumeQueueMock.add).not.toHaveBeenCalled();
    });

    it("returns 400 when PDF exceeds maximum allowed size", async () => {
      const { token } = await authenticate();
      const oversizedPdf = Buffer.concat([
        minimalPdfBuffer,
        Buffer.alloc(env.RESUME_MAX_BYTES),
      ]);

      const response = await request(app)
        .post("/api/resumes/")
        .set(authHeader(token))
        .attach("file", oversizedPdf, {
          filename: "large-resume.pdf",
          contentType: "application/pdf",
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(
        new RegExp(
          `File must be at most ${env.RESUME_MAX_BYTES} bytes|File exceeds maximum allowed size`,
        ),
      );
      expect(storageMock.put).not.toHaveBeenCalled();
      expect(resumeQueueMock.add).not.toHaveBeenCalled();
    });

    it("returns 502 when object storage upload fails", async () => {
      storageMock.put.mockRejectedValueOnce(new Error("R2 down"));
      const { token, userId } = await authenticate();

      const response = await request(app)
        .post("/api/resumes/")
        .set(authHeader(token))
        .attach("file", minimalPdfBuffer, {
          filename: "resume.pdf",
          contentType: "application/pdf",
        });

      expect(response.status).toBe(502);
      expect(response.body).toEqual({ message: "Failed to upload resume" });
      expect(resumeQueueMock.add).not.toHaveBeenCalled();

      const resume = await prisma.resume.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      expect(resume?.status).toBe(ResumeStatus.failed);
      expect(resume?.errorMessage).toBe("Failed to upload resume to storage");
    });

    it("returns 503 when resume queue is unavailable", async () => {
      resumeQueueMock.add.mockRejectedValueOnce(new Error("Redis down"));
      const { token, userId } = await authenticate();

      const response = await request(app)
        .post("/api/resumes/")
        .set(authHeader(token))
        .attach("file", minimalPdfBuffer, {
          filename: "resume.pdf",
          contentType: "application/pdf",
        });

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        message: "Resume processing is unavailable",
      });
      expect(storageMock.put).toHaveBeenCalledTimes(1);

      const resume = await prisma.resume.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      expect(resume?.status).toBe(ResumeStatus.failed);
      expect(resume?.errorMessage).toBe("Failed to enqueue resume processing");
    });
  });

  describe("GET /api/resumes/:id", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).get(`/api/resumes/${randomUUID()}`);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("returns 200 with resume detail for the owner", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const response = await request(app)
        .get(`/api/resumes/${resume.id}`)
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: resume.id,
        name: "resume.pdf",
        status: ResumeStatus.ready,
        structuredSummary: sampleStructuredSummary,
      });
      expect(response.body).not.toHaveProperty("sourceFormat");
    });

    it("returns 404 when resume does not exist", async () => {
      const { token } = await authenticate();

      const response = await request(app)
        .get(`/api/resumes/${randomUUID()}`)
        .set(authHeader(token));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Resume not found" });
    });

    it("returns 404 when resume belongs to another user", async () => {
      const { userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const other = await seedAuthenticatedUser({
        email: "other@example.com",
        name: "Other User",
      });

      const response = await request(app)
        .get(`/api/resumes/${resume.id}`)
        .set(authHeader(other.accessToken));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Resume not found" });
    });
  });

  describe("AI rate limiting", () => {
    let rateLimitedApp: Express;
    let previousMax: string | undefined;
    let previousWindow: string | undefined;

    async function clearAiRateLimitKeys(): Promise<void> {
      const Redis = (await import("ioredis")).default;
      const { env } = await import("@/config/env");
      const redis = new Redis(env.REDIS_URL);

      try {
        const keys = await redis.keys("rl:ai:*");
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } finally {
        await redis.quit();
      }
    }

    function restoreRateLimitEnv(
      previousMax: string | undefined,
      previousWindow: string | undefined,
    ): void {
      process.env.RATE_LIMIT_AI_MAX = previousMax;
      process.env.RATE_LIMIT_AI_WINDOW_MS = previousWindow;
    }

    function uploadResume(
      appInstance: Express,
      token: string,
      filename: string,
    ) {
      return request(appInstance)
        .post("/api/resumes")
        .set(authHeader(token))
        .attach("file", minimalPdfBuffer, {
          filename,
          contentType: "application/pdf",
        });
    }

    beforeAll(async () => {
      previousMax = process.env.RATE_LIMIT_AI_MAX;
      previousWindow = process.env.RATE_LIMIT_AI_WINDOW_MS;
      await clearAiRateLimitKeys();
      process.env.RATE_LIMIT_AI_MAX = "1";
      process.env.RATE_LIMIT_AI_WINDOW_MS = "60000";
      vi.resetModules();

      const { createApp: createAppWithRateLimit } =
        await import("@/config/app");
      rateLimitedApp = await createAppWithRateLimit();
    });

    beforeEach(async () => {
      await clearAiRateLimitKeys();
    });

    afterAll(() => {
      restoreRateLimitEnv(previousMax, previousWindow);
      vi.resetModules();
    });

    it("returns 429 when exceeding RATE_LIMIT_AI_MAX on upload", async () => {
      const { token } = await authenticate();

      await uploadResume(rateLimitedApp, token, "resume.pdf").expect(201);

      const response = await uploadResume(
        rateLimitedApp,
        token,
        "resume-2.pdf",
      );

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        message: "Too many requests, please try again later.",
      });
    });

    it("allows two different users to reach RATE_LIMIT_AI_MAX independently on upload", async () => {
      const { token: firstToken } = await authenticate();

      await uploadResume(rateLimitedApp, firstToken, "resume.pdf").expect(
        201,
      );
      await uploadResume(rateLimitedApp, firstToken, "resume-2.pdf").expect(
        429,
      );

      const other = await seedAuthenticatedUser({
        email: "rate-limit-other@example.com",
        name: "Rate Limit Other User",
      });

      const response = await uploadResume(
        rateLimitedApp,
        other.accessToken,
        "other-resume.pdf",
      );

      expect(response.status).toBe(201);
    });

    it("returns 200 on GET /api/resumes after 429 on upload", async () => {
      const { token } = await authenticate();

      await uploadResume(rateLimitedApp, token, "resume.pdf").expect(201);
      await uploadResume(rateLimitedApp, token, "resume-2.pdf").expect(429);

      const response = await request(rateLimitedApp)
        .get("/api/resumes")
        .set(authHeader(token));

      expect(response.status).toBe(200);
    });
  });
});
