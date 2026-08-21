import { describe, expect, it } from "vitest";

import {
  SessionQuotaExceededError,
  TokenLimitExceededError,
} from "./http-errors";

const AI_LIMITER_MESSAGE = "Too many requests, please try again later.";

describe("SessionQuotaExceededError", () => {
  it("uses the practice quota message", () => {
    const error = new SessionQuotaExceededError({
      retryAfterSeconds: 3600,
      quota: "practice",
    });

    expect(error.message).toBe(
      "Practice session limit reached. You can start another after the waiting period.",
    );
  });

  it("uses the study quota message", () => {
    const error = new SessionQuotaExceededError({
      retryAfterSeconds: 3600,
      quota: "study",
    });

    expect(error.message).toBe(
      "Study session limit reached. You can start another after the waiting period.",
    );
  });

  it("sets status 429 and preserves retryAfterSeconds and quota", () => {
    const error = new SessionQuotaExceededError({
      retryAfterSeconds: 42,
      quota: "practice",
    });

    expect(error.statusCode).toBe(429);
    expect(error.retryAfterSeconds).toBe(42);
    expect(error.quota).toBe("practice");
  });

  it("uses messages distinct from the AI limiter and TokenLimitExceededError", () => {
    const tokenLimitMessage = new TokenLimitExceededError().message;
    const practice = new SessionQuotaExceededError({
      retryAfterSeconds: 1,
      quota: "practice",
    });
    const study = new SessionQuotaExceededError({
      retryAfterSeconds: 1,
      quota: "study",
    });

    expect(practice.message).not.toBe(AI_LIMITER_MESSAGE);
    expect(practice.message).not.toBe(tokenLimitMessage);
    expect(study.message).not.toBe(AI_LIMITER_MESSAGE);
    expect(study.message).not.toBe(tokenLimitMessage);
    expect(practice.message).not.toBe(study.message);
  });
});
