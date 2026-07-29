import { describe, expect, it } from "vitest";

import { serverEnvSchema } from "./server-schema";

const validEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/hackathon2026",
  PORT: "3000",
  CORS_ORIGIN: "http://localhost:3001",
  FRONTEND_URL: "http://localhost:3001",
  NODE_ENV: "development",
  OPENAI_API_KEY: "sk-test-openai-api-key",
  ASSEMBLYAI_API_KEY: "test-assemblyai-api-key",
  R2_ACCOUNT_ID: "test-account-id",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_BUCKET_NAME: "test-bucket",
  INTERNAL_AUTH_SYNC_SECRET: "test-internal-auth-sync-secret-min-32-chars",
};

describe("serverEnvSchema", () => {
  it("parses a valid environment", () => {
    const result = serverEnvSchema.safeParse(validEnv);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.PORT).toBe(3000);
    expect(result.data.RATE_LIMIT_WINDOW_MS).toBe(900000);
    expect(result.data.RATE_LIMIT_MAX).toBe(20);
    expect(result.data.RATE_LIMIT_AI_WINDOW_MS).toBe(900000);
    expect(result.data.RATE_LIMIT_AI_MAX).toBe(60);
    expect(result.data.OPENAI_MODEL_INTERVIEW).toBe("gpt-5");
    expect(result.data.OPENAI_MODEL_EXTRACTION).toBe("gpt-5-nano");
    expect(result.data.OPENAI_MODEL_REVIEW).toBe("gpt-5-nano");
    expect(result.data.REVIEW_SESSION_QUESTION_COUNT).toBe(3);
    expect(result.data.REDIS_URL).toBe("redis://localhost:6379");
    expect(result.data.RESUME_MAX_BYTES).toBe(5_242_880);
    expect(result.data.TRANSCRIBE_MAX_BYTES).toBe(5_242_880);
    expect(result.data.TOKEN_LIMIT_ENABLED).toBe(true);
    expect(result.data.TOKEN_LIMIT_MONTHLY_MAX).toBe(500_000);
    expect(result.data.R2_ENDPOINT).toBe(
      "https://test-account-id.r2.cloudflarestorage.com",
    );
  });

  it("uses default REVIEW_SESSION_QUESTION_COUNT when omitted", () => {
    const result = serverEnvSchema.safeParse(validEnv);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.REVIEW_SESSION_QUESTION_COUNT).toBe(3);
  });

  it("coerces REVIEW_SESSION_QUESTION_COUNT when overridden", () => {
    const result = serverEnvSchema.safeParse({
      ...validEnv,
      REVIEW_SESSION_QUESTION_COUNT: "5",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.REVIEW_SESSION_QUESTION_COUNT).toBe(5);
  });

  it("uses explicit R2_ENDPOINT when provided", () => {
    const result = serverEnvSchema.safeParse({
      ...validEnv,
      R2_ENDPOINT: "https://custom.r2.example.com",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.R2_ENDPOINT).toBe("https://custom.r2.example.com");
  });

  it("accepts comma-separated CORS_ORIGIN values", () => {
    const result = serverEnvSchema.safeParse({
      ...validEnv,
      CORS_ORIGIN:
        "https://labs-gateway.yuri-491.workers.dev,https://labs.borderlesscoding.com",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid environment with clear field errors", () => {
    const result = serverEnvSchema.safeParse({
      ...validEnv,
      CORS_ORIGIN: "not-a-url",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    const messages = result.error.issues.map((i) => i.message).join(" ");
    expect(messages.length).toBeGreaterThan(0);
    expect(
      result.error.issues.some((i) => i.path.includes("CORS_ORIGIN")),
    ).toBe(true);
  });
});
