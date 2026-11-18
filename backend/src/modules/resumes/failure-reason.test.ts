import { describe, expect, it } from "vitest";

import { TokenLimitExceededError } from "@/shared";

import {
  formatResumeFailure,
  RESUME_FAILURE_REASONS,
  resolveResumeFailureReason,
} from "./failure-reason";

describe("formatResumeFailure", () => {
  it("prefixes the message with the bracketed reason", () => {
    expect(formatResumeFailure("storage_failed", "R2 down")).toBe(
      "[storage_failed] R2 down",
    );
  });
});

describe("resolveResumeFailureReason", () => {
  it.each(RESUME_FAILURE_REASONS)(
    "resolves a message prefixed with [%s]",
    (reason) => {
      expect(resolveResumeFailureReason(`[${reason}] something broke`)).toBe(
        reason,
      );
    },
  );

  it.each(RESUME_FAILURE_REASONS)(
    "round-trips %s through formatResumeFailure",
    (reason) => {
      expect(
        resolveResumeFailureReason(formatResumeFailure(reason, "boom")),
      ).toBe(reason);
    },
  );

  it("returns unknown for an unrecognised prefix", () => {
    expect(resolveResumeFailureReason("[bogus] x")).toBe("unknown");
  });

  it.each([
    ["Failed to upload resume to storage", "storage_failed"],
    ["Failed to enqueue resume processing", "queue_unavailable"],
    [new TokenLimitExceededError().message, "quota_exceeded"],
    ["Resume contains no extractable text", "unreadable_file"],
    ["Failed to convert TeX resume", "unreadable_file"],
  ] as const)("maps legacy message %j to %s", (message, reason) => {
    expect(resolveResumeFailureReason(message)).toBe(reason);
  });

  it.each([null, ""])("returns unknown for %j", (value) => {
    expect(resolveResumeFailureReason(value)).toBe("unknown");
  });

  it("returns unknown for an unrecognised raw message", () => {
    expect(resolveResumeFailureReason("429 Rate limit exceeded")).toBe(
      "unknown",
    );
  });
});
