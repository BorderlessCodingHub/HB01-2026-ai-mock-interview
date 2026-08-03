import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/shared";

vi.mock("@/infrastructure/queue/resume-queue", () => ({
  RESUME_QUEUE_NAME: "resume-processing",
  redisConnection: {},
}));

vi.mock("@/infrastructure/queue/review-generation-queue", () => ({
  REVIEW_GENERATION_QUEUE_NAME: "review-generation",
}));

vi.mock("@/infrastructure/queue/weak-answer-queue", () => ({
  WEAK_ANSWER_QUEUE_NAME: "weak-answer-generation",
}));

vi.mock("@/infrastructure/queue/coverage-extraction-queue", () => ({
  COVERAGE_EXTRACTION_QUEUE_NAME: "coverage-extraction",
}));

vi.mock("@/factories/resumes/resume-service-factory", () => ({
  makeResumeService: vi.fn(() => ({ process: vi.fn() })),
}));

vi.mock("@/factories/interview/review-generation-service-factory", () => ({
  makeReviewGenerationService: vi.fn(() => ({ process: vi.fn() })),
}));

vi.mock("@/factories/interview/weak-answer-generation-service-factory", () => ({
  makeWeakAnswerGenerationService: vi.fn(() => ({ process: vi.fn() })),
}));

vi.mock("@/factories/interview/coverage-extraction-service-factory", () => ({
  makeCoverageExtractionService: vi.fn(() => ({ process: vi.fn() })),
}));

vi.mock("@/modules/interview/repository/session-repository", () => ({
  SessionRepository: vi.fn().mockImplementation(() => ({
    markReviewGenerationFailed: vi.fn(),
  })),
}));

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
}));

import {
  handleReviewJobExhaustedFailure,
  logCoverageExtractionJobResult,
  logResumeJobResult,
  logReviewJobResult,
  logWeakAnswerJobResult,
  processCoverageExtractionJob,
  processResumeJob,
  processReviewJob,
  processWeakAnswerJob,
} from "./worker";

describe("processResumeJob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to resumeService.process and returns the result", async () => {
    const ready = { status: "ready" as const, resumeId: "resume-1" };
    const process = vi.fn().mockResolvedValue(ready);

    const result = await processResumeJob("resume-1", { process });

    expect(process).toHaveBeenCalledWith("resume-1");
    expect(result).toEqual(ready);
  });
});

describe("logResumeJobResult", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs info when processing succeeds", () => {
    const infoSpy = vi.spyOn(logger, "info");

    logResumeJobResult("job-1", {
      status: "ready",
      resumeId: "resume-1",
    });

    expect(infoSpy).toHaveBeenCalledWith(
      "Resume job job-1 succeeded (resume resume-1)",
    );
  });

  it("logs error with stack meta when processing fails", () => {
    const errorSpy = vi.spyOn(logger, "error");
    const cause = new Error("parse failed");

    logResumeJobResult("job-2", {
      status: "failed",
      resumeId: "resume-2",
      error: "parse failed",
      cause,
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "Resume job job-2 failed (resume resume-2): parse failed",
      {
        resumeId: "resume-2",
        error: "parse failed",
        stack: cause.stack,
      },
    );
  });

  it("logs warn when resume was skipped (not found)", () => {
    const warnSpy = vi.spyOn(logger, "warn");

    logResumeJobResult("job-3", {
      status: "skipped",
      resumeId: "resume-3",
      reason: "not_found",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "Resume job job-3 skipped: resume resume-3 not found",
    );
  });
});

describe("processReviewJob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to reviewGenerationService.process and returns the result", async () => {
    const ready = { status: "ready" as const, sessionId: "session-1" };
    const process = vi.fn().mockResolvedValue(ready);

    const result = await processReviewJob("session-1", { process });

    expect(process).toHaveBeenCalledWith("session-1");
    expect(result).toEqual(ready);
  });
});

describe("logReviewJobResult", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs info when processing succeeds", () => {
    const infoSpy = vi.spyOn(logger, "info");

    logReviewJobResult("job-1", {
      status: "ready",
      sessionId: "session-1",
    });

    expect(infoSpy).toHaveBeenCalledWith(
      "Review job job-1 succeeded (session session-1)",
    );
  });

  it("logs error with stack meta when processing fails non-retryably", () => {
    const errorSpy = vi.spyOn(logger, "error");
    const cause = new Error("token limit exceeded");

    logReviewJobResult("job-2", {
      status: "failed",
      sessionId: "session-2",
      error: "token limit exceeded",
      cause,
      retryable: false,
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "Review job job-2 failed (session session-2): token limit exceeded",
      {
        sessionId: "session-2",
        error: "token limit exceeded",
        stack: cause.stack,
      },
    );
  });

  it("logs warn when review generation was skipped", () => {
    const warnSpy = vi.spyOn(logger, "warn");

    logReviewJobResult("job-3", {
      status: "skipped",
      sessionId: "session-3",
      reason: "already_ready",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "Review job job-3 skipped: session session-3 (already_ready)",
    );
  });
});

describe("handleReviewJobExhaustedFailure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks the session review generation as failed", async () => {
    const markReviewGenerationFailed = vi.fn().mockResolvedValue({});
    const error = new Error("OpenAI timeout");

    await handleReviewJobExhaustedFailure("session-4", error, {
      markReviewGenerationFailed,
    });

    expect(markReviewGenerationFailed).toHaveBeenCalledWith(
      "session-4",
      "OpenAI timeout",
    );
  });
});

describe("processWeakAnswerJob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to weakAnswerGenerationService.process and returns the result", async () => {
    const ready = { status: "ready" as const, sessionId: "session-1" };
    const process = vi.fn().mockResolvedValue(ready);

    const result = await processWeakAnswerJob("session-1", { process });

    expect(process).toHaveBeenCalledWith("session-1");
    expect(result).toEqual(ready);
  });
});

describe("logWeakAnswerJobResult", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs info when processing succeeds", () => {
    const infoSpy = vi.spyOn(logger, "info");

    logWeakAnswerJobResult("job-1", {
      status: "ready",
      sessionId: "session-1",
    });

    expect(infoSpy).toHaveBeenCalledWith(
      "Weak answer job job-1 succeeded (session session-1)",
    );
  });

  it("logs warn when skipped", () => {
    const warnSpy = vi.spyOn(logger, "warn");

    logWeakAnswerJobResult("job-2", {
      status: "skipped",
      sessionId: "session-2",
      reason: "not_finished",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "Weak answer job job-2 skipped (session session-2): not_finished",
    );
  });
});

describe("processCoverageExtractionJob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to coverageExtractionService.process and returns the result", async () => {
    const ready = { status: "ready" as const, sessionId: "session-1" };
    const process = vi.fn().mockResolvedValue(ready);

    const result = await processCoverageExtractionJob("session-1", {
      process,
    });

    expect(process).toHaveBeenCalledWith("session-1");
    expect(result).toEqual(ready);
  });
});

describe("logCoverageExtractionJobResult", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs info when processing succeeds", () => {
    const infoSpy = vi.spyOn(logger, "info");

    logCoverageExtractionJobResult("job-1", {
      status: "ready",
      sessionId: "session-1",
    });

    expect(infoSpy).toHaveBeenCalledWith(
      "Coverage extraction job job-1 succeeded (session session-1)",
    );
  });

  it("logs warn when skipped", () => {
    const warnSpy = vi.spyOn(logger, "warn");

    logCoverageExtractionJobResult("job-2", {
      status: "skipped",
      sessionId: "session-2",
      reason: "already_processed",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "Coverage extraction job job-2 skipped (session session-2): already_processed",
    );
  });
});
