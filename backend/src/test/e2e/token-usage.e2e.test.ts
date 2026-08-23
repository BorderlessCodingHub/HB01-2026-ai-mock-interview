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

vi.mock("@/factories/interview/interview-graph-factory", () => ({
  makeInterviewGraph: () => interviewGraphMock,
}));

import request from "supertest";
import type { Express } from "express";

import prisma from "@/infrastructure/database";
import { getCurrentPeriodKey } from "@/modules/token-usage/utils/period-key";
import {
  authHeader,
  seedAuthenticatedUser,
} from "@/test/helpers/auth-helpers";
import { seedReadyResume } from "@/test/helpers/interview-seed-helpers";
import { truncateTables } from "@/test/containers/truncate-tables";

describe("Token usage limits E2E", () => {
  let app: Express;
  let previousEnabled: string | undefined;
  let previousMax: string | undefined;

  beforeAll(async () => {
    previousEnabled = process.env.TOKEN_LIMIT_ENABLED;
    previousMax = process.env.TOKEN_LIMIT_MONTHLY_MAX;
    process.env.TOKEN_LIMIT_ENABLED = "true";
    process.env.TOKEN_LIMIT_MONTHLY_MAX = "100";
    vi.resetModules();

    const { createApp: createAppWithTokenLimits } = await import("@/config/app");
    app = await createAppWithTokenLimits();
  });

  beforeEach(async () => {
    interviewGraphMock.streamMessages.mockClear();
    await truncateTables();
  });

  afterAll(() => {
    process.env.TOKEN_LIMIT_ENABLED = previousEnabled;
    process.env.TOKEN_LIMIT_MONTHLY_MAX = previousMax;
    vi.resetModules();
  });

  async function authenticate(): Promise<{ token: string; userId: number }> {
    const auth = await seedAuthenticatedUser();
    return {
      token: auth.accessToken,
      userId: auth.userId,
    };
  }

  it("returns 429 when monthly token limit is already reached before streaming", async () => {
    const { token, userId } = await authenticate();
    const resume = await seedReadyResume(userId);

    await prisma.userTokenUsage.create({
      data: {
        userId,
        periodKey: getCurrentPeriodKey(),
        promptTokens: 70,
        completionTokens: 30,
      },
    });

    const sessionResponse = await request(app)
      .post("/api/interview/sessions")
      .set(authHeader(token))
      .send({ resumeId: resume.id, level: "entry", interviewLocale: "en", turns: 5 })
      .expect(201);

    const sessionId = sessionResponse.body.id as string;

    const response = await request(app)
      .post(`/api/interview/sessions/${sessionId}/stream`)
      .set(authHeader(token))
      .send({ content: "Hello interviewer", interviewLocale: "en" });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      message:
        "Monthly token usage limit reached. Your quota resets at the start of next month.",
    });
    expect(interviewGraphMock.streamMessages).not.toHaveBeenCalled();
  });
});
