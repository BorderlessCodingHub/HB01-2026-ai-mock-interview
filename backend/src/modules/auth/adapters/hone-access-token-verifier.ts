import jwt from "jsonwebtoken";

import type {
  BorderlessTokenClaims,
  IBorderlessTokenVerifier,
} from "@/modules/auth/protocols/borderless-token-verifier";
import type { ITokenRevocationStore } from "@/modules/auth/protocols/token-revocation-store";

/** Must match the issuer/audience the Next.js server signs with. */
export const HONE_JWT_ISSUER = "hone-web";
export const HONE_JWT_AUDIENCE = "hone-api";

type VerifiedPayload = {
  sub: string;
  email: string;
  name: string;
  jti: string;
  exp: number;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Verifies Hone access tokens: HS256 JWTs signed by the Next.js server with
 * HONE_JWT_SECRET after Borderless accepted the user's credentials.
 * Unsigned or foreign-signed tokens are rejected.
 */
export class HoneAccessTokenVerifier implements IBorderlessTokenVerifier {
  constructor(
    private readonly secret: string,
    private readonly revocations: ITokenRevocationStore,
  ) {}

  private decodeVerified(token: string): VerifiedPayload {
    const decoded = jwt.verify(token, this.secret, {
      algorithms: ["HS256"],
      issuer: HONE_JWT_ISSUER,
      audience: HONE_JWT_AUDIENCE,
    });

    if (!decoded || typeof decoded === "string") {
      throw new Error("Invalid token payload");
    }

    const sub = asNonEmptyString(decoded.sub);
    const email = asNonEmptyString(decoded.email);
    const jti = asNonEmptyString(decoded.jti);
    const exp = decoded.exp;

    if (!sub || !email || !jti || typeof exp !== "number") {
      throw new Error("Token missing required claims");
    }

    return {
      sub,
      email,
      jti,
      exp,
      name: asNonEmptyString(decoded.name) ?? email.split("@")[0] ?? "User",
    };
  }

  async verify(token: string): Promise<BorderlessTokenClaims> {
    const payload = this.decodeVerified(token);

    if (await this.revocations.isRevoked(payload.jti)) {
      throw new Error("Token revoked");
    }

    return {
      externalId: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  }

  /** Revokes a valid token; invalid or expired tokens are ignored. */
  async revoke(token: string): Promise<void> {
    let payload: VerifiedPayload;
    try {
      payload = this.decodeVerified(token);
    } catch {
      return;
    }

    const ttlSeconds = payload.exp - Math.floor(Date.now() / 1000);
    if (ttlSeconds > 0) {
      await this.revocations.revoke(payload.jti, ttlSeconds);
    }
  }
}
