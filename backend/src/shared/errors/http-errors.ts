export class HttpError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad Request") {
    super(message, 400);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not Found") {
    super(message, 404);
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}

export class BadGatewayError extends HttpError {
  constructor(message = "Bad Gateway") {
    super(message, 502);
  }
}

export class GatewayTimeoutError extends HttpError {
  constructor(message = "Gateway Timeout") {
    super(message, 504);
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message = "Service Unavailable") {
    super(message, 503);
  }
}

export class TokenLimitExceededError extends HttpError {
  constructor(
    message = "Monthly token usage limit reached. Your quota resets at the start of next month.",
  ) {
    super(message, 429);
  }
}

type SessionQuotaKind = "practice" | "study";

const SESSION_QUOTA_MESSAGES: Record<SessionQuotaKind, string> = {
  practice:
    "Practice session limit reached. You can start another after the waiting period.",
  study:
    "Study session limit reached. You can start another after the waiting period.",
};

export class SessionQuotaExceededError extends HttpError {
  readonly retryAfterSeconds: number;
  readonly quota: SessionQuotaKind;

  constructor(params: {
    retryAfterSeconds: number;
    quota: SessionQuotaKind;
  }) {
    super(SESSION_QUOTA_MESSAGES[params.quota], 429);
    this.retryAfterSeconds = params.retryAfterSeconds;
    this.quota = params.quota;
  }
}
