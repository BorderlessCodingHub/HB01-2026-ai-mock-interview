import type { ErrorRequestHandler } from "express";
import multer from "multer";

import { BadRequestError, HttpError } from "../errors/http-errors";
import { logger } from "../logger";

function isHttpErrorLike(err: unknown): err is HttpError {
  return (
    err instanceof Error &&
    "statusCode" in err &&
    typeof (err as { statusCode: unknown }).statusCode === "number"
  );
}

function getRetryAfterSeconds(err: {
  retryAfterSeconds?: unknown;
}): number | undefined {
  return typeof err.retryAfterSeconds === "number"
    ? err.retryAfterSeconds
    : undefined;
}

function toHttpError(err: unknown): HttpError | null {
  // Route modules are loaded via a runtime dynamic import() (see config/routes.ts),
  // which the bundler cannot inline. That gives them a separate module instance of
  // HttpError than this bundled file, so `instanceof HttpError` fails even for real
  // HttpError subclasses thrown from route handlers. Fall back to a structural check.
  if (err instanceof HttpError || isHttpErrorLike(err)) {
    return err as HttpError;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return new BadRequestError("File exceeds maximum allowed size");
    }
    return new BadRequestError(err.message);
  }

  return null;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const httpError = toHttpError(err);
  const isHttpError = httpError !== null;
  const statusCode = isHttpError ? httpError.statusCode : 500;
  const message = isHttpError ? httpError.message : "Internal Server Error";

  const requestMeta = {
    method: req.method,
    path: req.path,
  };

  if (statusCode >= 500) {
    const logMessage =
      err instanceof Error ? err.message : "Internal Server Error";
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error(logMessage, { ...requestMeta, statusCode, stack });
  } else if (statusCode >= 400) {
    logger.warn(message, { ...requestMeta, statusCode });
  }

  const retryAfterSeconds = isHttpError
    ? getRetryAfterSeconds(httpError as { retryAfterSeconds?: unknown })
    : undefined;

  if (retryAfterSeconds !== undefined) {
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(statusCode).json({ message, retryAfterSeconds });
    return;
  }

  res.status(statusCode).json({ message });
};
