import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

import type { IBorderlessSessionStore } from "@/modules/auth/protocols/borderless-session-store";
import type { ITokenRevocationStore } from "@/modules/auth/protocols/token-revocation-store";
import { BorderlessTokenResolver } from "./borderless-token-resolver";
import {
  HONE_JWT_AUDIENCE,
  HONE_JWT_ISSUER,
  HoneAccessTokenVerifier,
} from "./hone-access-token-verifier";

const SECRET = "resolver-test-hone-jwt-secret-min-32-chars";

function createStore(
  overrides?: Partial<IBorderlessSessionStore>,
): IBorderlessSessionStore {
  return {
    save: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn(),
    ...overrides,
  };
}

function createRevocations(): ITokenRevocationStore {
  return {
    revoke: vi.fn(),
    isRevoked: vi.fn().mockResolvedValue(false),
  };
}

function createResolver(store = createStore(), revocations = createRevocations()) {
  return new BorderlessTokenResolver(
    store,
    new HoneAccessTokenVerifier(SECRET, revocations),
  );
}

function signHone(): string {
  return jwt.sign({ sub: "ext-1", email: "a@example.com", name: "Ada" }, SECRET, {
    algorithm: "HS256",
    issuer: HONE_JWT_ISSUER,
    audience: HONE_JWT_AUDIENCE,
    jwtid: "jti-1",
    expiresIn: "1h",
  });
}

describe("BorderlessTokenResolver", () => {
  it("verifies Hone-signed JWTs without using the session store", async () => {
    const store = createStore();
    const resolver = createResolver(store);

    await expect(resolver.verify(signHone())).resolves.toEqual({
      externalId: "ext-1",
      email: "a@example.com",
      name: "Ada",
    });
    expect(store.get).not.toHaveBeenCalled();
  });

  it("rejects JWTs signed with another key", async () => {
    const forged = jwt.sign(
      { sub: "victim", email: "victim@example.com" },
      "attacker-chosen-key-attacker-chosen-key",
      {
        issuer: HONE_JWT_ISSUER,
        audience: HONE_JWT_AUDIENCE,
        jwtid: "x",
        expiresIn: "1h",
      },
    );

    await expect(createResolver().verify(forged)).rejects.toThrow();
  });

  it("looks up opaque tokens in the session store", async () => {
    const store = createStore({
      get: vi.fn().mockResolvedValue({
        externalId: "ext-opaque",
        email: "opaque@example.com",
        name: "Opaque User",
      }),
    });
    const resolver = createResolver(store);

    await expect(
      resolver.verify("n8tKYKn0L4r2u3yQQI6c1nRUlWIOvFNZ"),
    ).resolves.toEqual({
      externalId: "ext-opaque",
      email: "opaque@example.com",
      name: "Opaque User",
    });
    expect(store.get).toHaveBeenCalledWith(
      "n8tKYKn0L4r2u3yQQI6c1nRUlWIOvFNZ",
    );
  });

  it("rejects unknown opaque tokens", async () => {
    await expect(
      createResolver().verify("unknown-opaque-token"),
    ).rejects.toThrow(/unknown or expired opaque token/i);
  });

  it("invalidate revokes the jti of a Hone JWT", async () => {
    const store = createStore();
    const revocations = createRevocations();
    await createResolver(store, revocations).invalidate(signHone());

    expect(revocations.revoke).toHaveBeenCalledWith(
      "jti-1",
      expect.any(Number),
    );
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("invalidate deletes opaque sessions", async () => {
    const store = createStore();
    await createResolver(store).invalidate("opaque-tok");

    expect(store.delete).toHaveBeenCalledWith("opaque-tok");
  });
});
