import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

import type { IBorderlessSessionStore } from "@/modules/auth/protocols/borderless-session-store";
import { BorderlessSessionController } from "./borderless-session-controller";

const SECRET = "test-internal-auth-sync-secret-min-32-chars";

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
    send() {
      return this;
    },
  };
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
  };
}

describe("BorderlessSessionController", () => {
  it("rejects register without matching internal secret", async () => {
    const store = { save: vi.fn(), get: vi.fn(), delete: vi.fn() };
    const controller = new BorderlessSessionController(
      store as IBorderlessSessionStore,
      SECRET,
    );
    const req = {
      headers: {},
      body: {
        accessToken: "tok",
        externalId: "ext",
        email: "a@example.com",
      },
    } as unknown as Request;
    const res = createRes();

    await controller.register(req, res);

    expect(res.statusCode).toBe(401);
    expect(store.save).not.toHaveBeenCalled();
  });

  it("registers a session when secret and body are valid", async () => {
    const store = { save: vi.fn(), get: vi.fn(), delete: vi.fn() };
    const controller = new BorderlessSessionController(
      store as IBorderlessSessionStore,
      SECRET,
    );
    const req = {
      headers: { "x-internal-auth-secret": SECRET },
      body: {
        accessToken: "opaque-tok",
        externalId: "ext-1",
        email: "a@example.com",
        name: "Ada",
        expiresIn: 7200,
      },
    } as unknown as Request;
    const res = createRes();

    await controller.register(req, res);

    expect(res.statusCode).toBe(204);
    expect(store.save).toHaveBeenCalledWith(
      "opaque-tok",
      expect.objectContaining({
        externalId: "ext-1",
        email: "a@example.com",
        name: "Ada",
      }),
      7200,
    );
  });

  it("invalidates a session by Bearer token", async () => {
    const store = { save: vi.fn(), get: vi.fn(), delete: vi.fn() };
    const controller = new BorderlessSessionController(
      store as IBorderlessSessionStore,
      SECRET,
    );
    const req = {
      headers: { authorization: "Bearer opaque-tok" },
      body: {},
    } as unknown as Request;
    const res = createRes();

    await controller.invalidate(req, res);

    expect(res.statusCode).toBe(204);
    expect(store.delete).toHaveBeenCalledWith("opaque-tok");
  });
});
