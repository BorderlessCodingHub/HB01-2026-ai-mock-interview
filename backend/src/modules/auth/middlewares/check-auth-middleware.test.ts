import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import type {
  BorderlessTokenClaims,
  IBorderlessTokenVerifier,
} from "../protocols/borderless-token-verifier";
import type { UserSyncService } from "../service/user-sync-service";
import type { User } from "../types/user";

import {
  makeCheckAuthMiddleware,
  PUBLIC_ROUTES,
} from "./check-auth-middleware";

class StubVerifier implements IBorderlessTokenVerifier {
  claims: BorderlessTokenClaims | null = {
    externalId: "ext-1",
    email: "a@example.com",
    name: "Ada",
  };
  error: Error | null = null;

  async verify(_token: string): Promise<BorderlessTokenClaims> {
    if (this.error) {
      throw this.error;
    }
    if (!this.claims) {
      throw new Error("no claims");
    }
    return this.claims;
  }
}

function makeUser(): User {
  return {
    id: 42,
    externalId: "ext-1",
    name: "Ada",
    email: "a@example.com",
    password: null,
    interviewLocale: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
  };
}

describe("makeCheckAuthMiddleware", () => {
  it("exposes health and internal session sync public routes", () => {
    expect(PUBLIC_ROUTES.map((r) => `${r.method} ${r.path}`)).toEqual([
      "GET /",
      "GET /health",
      "GET /health/ready",
      "POST /internal/borderless-sessions",
      "DELETE /internal/borderless-sessions",
    ]);
  });

  it("allows public routes without auth", () => {
    const verifier = new StubVerifier();
    const userSync = {
      resolveLocalUser: vi.fn(),
    } as unknown as UserSyncService;
    const middleware = makeCheckAuthMiddleware(verifier, userSync);
    const req = { method: "GET", path: "/health", headers: {} } as Request;
    const res = createRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(userSync.resolveLocalUser).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization is missing", () => {
    const verifier = new StubVerifier();
    const userSync = {
      resolveLocalUser: vi.fn(),
    } as unknown as UserSyncService;
    const middleware = makeCheckAuthMiddleware(verifier, userSync);
    const req = {
      method: "GET",
      path: "/api/resumes",
      headers: {},
    } as Request;
    const res = createRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.userId when token is valid", async () => {
    const verifier = new StubVerifier();
    const resolveLocalUser = vi.fn().mockResolvedValue(makeUser());
    const userSync = { resolveLocalUser } as unknown as UserSyncService;
    const middleware = makeCheckAuthMiddleware(verifier, userSync);
    const req = {
      method: "GET",
      path: "/api/resumes",
      headers: { authorization: "Bearer valid-token" },
    } as Request;
    const res = createRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());

    expect(req.userId).toBe(42);
    expect(resolveLocalUser).toHaveBeenCalledWith({
      externalId: "ext-1",
      email: "a@example.com",
      name: "Ada",
    });
  });

  it("returns 401 when verifier rejects the token", async () => {
    const verifier = new StubVerifier();
    verifier.error = new Error("expired");
    const userSync = {
      resolveLocalUser: vi.fn(),
    } as unknown as UserSyncService;
    const middleware = makeCheckAuthMiddleware(verifier, userSync);
    const req = {
      method: "GET",
      path: "/api/resumes",
      headers: { authorization: "Bearer bad" },
    } as Request;
    const res = createRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);
    await vi.waitFor(() => expect(res.statusCode).toBe(401));

    expect(next).not.toHaveBeenCalled();
    expect(res.body).toEqual({ message: "Invalid or expired token" });
  });
});
