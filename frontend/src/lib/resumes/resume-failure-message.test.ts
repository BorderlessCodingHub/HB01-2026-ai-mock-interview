import { describe, expect, it } from "vitest";

import type { ResumeFailureReason } from "@/lib/api/resumes";

import { getResumeFailureMessage } from "./resume-failure-message";

describe("getResumeFailureMessage", () => {
  it.each([
    ["quota_exceeded", "Monthly usage limit reached — resets next month."],
    ["storage_failed", "Couldn't store the file — please upload it again."],
    [
      "queue_unavailable",
      "Processing is temporarily unavailable — please upload it again.",
    ],
    ["unreadable_file", "Couldn't read this resume — try another format."],
    ["extraction_failed", "Couldn't analyze this resume — please try again."],
    ["unknown", "Something went wrong — please upload it again."],
  ] as const)("returns the copy for %s", (reason, message) => {
    expect(getResumeFailureMessage(reason)).toBe(message);
  });

  it("falls back to the generic copy when the reason is missing", () => {
    expect(getResumeFailureMessage(undefined)).toBe(
      "Something went wrong — please upload it again.",
    );
  });

  it("falls back to the generic copy for a reason this client does not know", () => {
    expect(
      getResumeFailureMessage("brand_new_reason" as ResumeFailureReason),
    ).toBe("Something went wrong — please upload it again.");
  });
});
