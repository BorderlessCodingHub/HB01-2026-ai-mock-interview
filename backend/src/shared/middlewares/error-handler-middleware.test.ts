import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { MulterError } from "multer";

import {
  BadRequestError,
  NotFoundError,
  SessionQuotaExceededError,
  TokenLimitExceededError,
} from "../errors/http-errors";
import { logger } from "../logger";
import { errorHandler } from "./error-handler-middleware";

function createMockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
  };
}

describe("errorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps HttpError to its status code and message", () => {
    const res = createMockResponse();
    const next = vi.fn();

    errorHandler(
      new NotFoundError("Resume not found"),
      {} as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Resume not found" });
  });

  it("maps Multer LIMIT_FILE_SIZE to 400 Bad Request", () => {
    const res = createMockResponse();
    const next = vi.fn();
    const err = new MulterError("LIMIT_FILE_SIZE");

    errorHandler(err, {} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "File exceeds maximum allowed size",
    });
  });

  it("maps other Multer errors to 400 with the multer message", () => {
    const res = createMockResponse();
    const next = vi.fn();
    const err = new MulterError("LIMIT_UNEXPECTED_FILE", "file");

    errorHandler(err, {} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: err.message });
  });

  it("returns 500 for unknown errors", () => {
    const res = createMockResponse();
    const next = vi.fn();

    errorHandler(new Error("boom"), {} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });

  it("logs 500 once via logger.error with stack in meta", () => {
    const res = createMockResponse();
    const next = vi.fn();
    const err = new Error("boom");
    const errorSpy = vi.spyOn(logger, "error");
    const req = { method: "GET", path: "/api/test" } as Request;

    errorHandler(err, req, res, next);

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith("boom", {
      method: "GET",
      path: "/api/test",
      statusCode: 500,
      stack: err.stack,
    });
  });

  it("logs 4xx HttpError as logger.warn", () => {
    const res = createMockResponse();
    const next = vi.fn();
    const errorSpy = vi.spyOn(logger, "error");
    const warnSpy = vi.spyOn(logger, "warn");
    const req = { method: "GET", path: "/api/resumes/1" } as Request;

    errorHandler(
      new NotFoundError("Resume not found"),
      req,
      res,
      next,
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith("Resume not found", {
      method: "GET",
      path: "/api/resumes/1",
      statusCode: 404,
    });
  });

  it("passes through BadRequestError from application code", () => {
    const res = createMockResponse();
    const next = vi.fn();

    errorHandler(
      new BadRequestError("Only PDF files are allowed"),
      {} as Request,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Only PDF files are allowed",
    });
  });

  it("maps SessionQuotaExceededError to 429 with retryAfterSeconds and Retry-After", () => {
    const res = createMockResponse();
    const next = vi.fn();
    const retryAfterSeconds = 3600;
    const err = new SessionQuotaExceededError({
      retryAfterSeconds,
      quota: "practice",
    });

    errorHandler(err, {} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Retry-After",
      String(retryAfterSeconds),
    );
    expect(res.json).toHaveBeenCalledWith({
      message: err.message,
      retryAfterSeconds,
    });
  });

  it("maps TokenLimitExceededError to 429 with message only and no Retry-After", () => {
    const res = createMockResponse();
    const next = vi.fn();
    const err = new TokenLimitExceededError();

    errorHandler(err, {} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ message: err.message });
    expect(res.setHeader).not.toHaveBeenCalledWith(
      "Retry-After",
      expect.anything(),
    );
  });

  it("emits retryAfterSeconds for duck-typed errors that are not SessionQuotaExceededError", () => {
    const res = createMockResponse();
    const next = vi.fn();
    const retryAfterSeconds = 42;
    const err = Object.assign(new Error("Quota exceeded"), {
      statusCode: 429,
      retryAfterSeconds,
    });

    errorHandler(err, {} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Retry-After",
      String(retryAfterSeconds),
    );
    expect(res.json).toHaveBeenCalledWith({
      message: "Quota exceeded",
      retryAfterSeconds,
    });
  });
});
