import { describe, expect, it, vi } from "vitest";
import jwt, { type SignOptions } from "jsonwebtoken";

import type { ITokenRevocationStore } from "@/modules/auth/protocols/token-revocation-store";
import {
  HONE_JWT_AUDIENCE,
  HONE_JWT_ISSUER,
  HoneAccessTokenVerifier,
} from "./hone-access-token-verifier";

const SECRET = "verifier-test-hone-jwt-secret-min-32-chars";

function createRevocations(revoked = false): ITokenRevocationStore {
  return {
    revoke: vi.fn(),
    isRevoked: vi.fn().mockResolvedValue(revoked),
  };
}

function sign(
  payload: Record<string, unknown> = {
    sub: "ext-1",
    email: "a@example.com",
    name: "Ada",
  },
  options: SignOptions = {},
  secret = SECRET,
): string {
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    issuer: HONE_JWT_ISSUER,
    audience: HONE_JWT_AUDIENCE,
    jwtid: "jti-1",
    expiresIn: "1h",
    ...options,
  });
}

describe("HoneAccessTokenVerifier", () => {
  it("returns claims for a valid token", async () => {
    const verifier = new HoneAccessTokenVerifier(SECRET, createRevocations());

    await expect(verifier.verify(sign())).resolves.toEqual({
      externalId: "ext-1",
      email: "a@example.com",
      name: "Ada",
    });
  });

  it("rejects a token signed with a different secret", async () => {
    const verifier = new HoneAccessTokenVerifier(SECRET, createRevocations());
    const forged = sign(undefined, {}, "another-secret-another-secret-another");

    await expect(verifier.verify(forged)).rejects.toThrow();
  });

  it("rejects an unsigned (alg none) token", async () => {
    const verifier = new HoneAccessTokenVerifier(SECRET, createRevocations());
    const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString(
      "base64url",
    );
    const body = Buffer.from(
      JSON.stringify({
        sub: "victim",
        email: "victim@example.com",
        iss: HONE_JWT_ISSUER,
        aud: HONE_JWT_AUDIENCE,
        jti: "x",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");

    await expect(verifier.verify(`${header}.${body}.x`)).rejects.toThrow();
  });

  it("rejects a token with the wrong audience", async () => {
    const verifier = new HoneAccessTokenVerifier(SECRET, createRevocations());

    await expect(
      verifier.verify(sign(undefined, { audience: "someone-else" })),
    ).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const verifier = new HoneAccessTokenVerifier(SECRET, createRevocations());

    await expect(
      verifier.verify(sign(undefined, { expiresIn: -10 })),
    ).rejects.toThrow();
  });

  it("rejects a token without exp", async () => {
    const verifier = new HoneAccessTokenVerifier(SECRET, createRevocations());
    const token = jwt.sign({ sub: "ext-1", email: "a@example.com" }, SECRET, {
      issuer: HONE_JWT_ISSUER,
      audience: HONE_JWT_AUDIENCE,
      jwtid: "jti-1",
    });

    await expect(verifier.verify(token)).rejects.toThrow(/required claims/);
  });

  it("rejects a revoked token", async () => {
    const verifier = new HoneAccessTokenVerifier(
      SECRET,
      createRevocations(true),
    );

    await expect(verifier.verify(sign())).rejects.toThrow(/revoked/);
  });

  it("revoke stores the jti until expiry and ignores invalid tokens", async () => {
    const revocations = createRevocations();
    const verifier = new HoneAccessTokenVerifier(SECRET, revocations);

    await verifier.revoke(sign());
    await verifier.revoke("garbage.token.value");

    expect(revocations.revoke).toHaveBeenCalledTimes(1);
    const [jti, ttl] = vi.mocked(revocations.revoke).mock.calls[0]!;
    expect(jti).toBe("jti-1");
    expect(ttl).toBeGreaterThan(3500);
    expect(ttl).toBeLessThanOrEqual(3600);
  });
});
