import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import request from "supertest";
import type { Express } from "express";

import prisma from "@/infrastructure/database";
import {
  authHeader,
  seedAuthenticatedUser,
} from "@/test/helpers/auth-helpers";
import { seedReadyResume } from "@/test/helpers/interview-seed-helpers";
import { truncateTables } from "@/test/containers/truncate-tables";

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

vi.mock("@/factories/interview/interview-graph-factory", () => ({
  makeInterviewGraph: () => interviewGraphMock,
}));

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

async function flushAiRateLimitKeys(): Promise<void> {
  const { redisConnection } = await import("@/infrastructure/queue/resume-queue");
  const redis = redisConnection as import("ioredis").default;
  const keys = await redis.keys("rl:ai:*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

async function createSessionAndGetId(
  app: Express,
  token: string,
  resumeId: string,
): Promise<string> {
  const response = await request(app)
    .post("/api/interview/sessions")
    .set(authHeader(token))
    .send({ resumeId, level: "entry", interviewLocale: "en", turns: 5 })
    .expect(201);

  return response.body.id as string;
}

function streamTurn(app: Express, token: string, sessionId: string) {
  return request(app)
    .post(`/api/interview/sessions/${sessionId}/stream`)
    .set(authHeader(token))
    .send({ content: "Hello interviewer", interviewLocale: "en" });
}

describe("AI rate limit shared Redis E2E", () => {
  beforeEach(async () => {
    interviewGraphMock.streamMessages.mockClear();
    await truncateTables();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("shares RATE_LIMIT_AI_MAX count across two Express app instances", async () => {
    const previousMax = process.env.RATE_LIMIT_AI_MAX;
    const previousWindow = process.env.RATE_LIMIT_AI_WINDOW_MS;

    try {
      process.env.RATE_LIMIT_AI_MAX = "3";
      process.env.RATE_LIMIT_AI_WINDOW_MS = "60000";
      vi.resetModules();
      await flushAiRateLimitKeys();

      const { createApp } = await import("@/config/app");
      const app1 = await createApp();
      const app2 = await createApp();

      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);
      const sessionId = await createSessionAndGetId(app1, token, resume.id);

      await streamTurn(app1, token, sessionId).expect(200);
      await streamTurn(app1, token, sessionId).expect(200);
      await streamTurn(app2, token, sessionId).expect(200);

      const responseOnApp1 = await streamTurn(app1, token, sessionId);
      expect(responseOnApp1.status).toBe(429);
      expect(responseOnApp1.body).toEqual({
        message: "Too many requests, please try again later.",
      });

      const responseOnApp2 = await streamTurn(app2, token, sessionId);
      expect(responseOnApp2.status).toBe(429);
      expect(responseOnApp2.body).toEqual({
        message: "Too many requests, please try again later.",
      });
    } finally {
      process.env.RATE_LIMIT_AI_MAX = previousMax;
      process.env.RATE_LIMIT_AI_WINDOW_MS = previousWindow;
      vi.resetModules();
    }
  });
});
