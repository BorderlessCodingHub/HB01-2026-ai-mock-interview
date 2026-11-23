import type { IBorderlessSessionStore } from "@/modules/auth/protocols/borderless-session-store";
import type {
  BorderlessTokenClaims,
  IBorderlessTokenVerifier,
} from "@/modules/auth/protocols/borderless-token-verifier";

import type { HoneAccessTokenVerifier } from "./hone-access-token-verifier";

/** JWT = three base64url segments separated by dots. */
function looksLikeJwt(token: string): boolean {
  const parts = token.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

/**
 * Resolves Bearer tokens that are either Hone-signed JWTs (signature verified)
 * or legacy opaque session tokens registered in Redis at login.
 */
export class BorderlessTokenResolver implements IBorderlessTokenVerifier {
  constructor(
    private readonly sessionStore: IBorderlessSessionStore,
    private readonly jwtVerifier: HoneAccessTokenVerifier,
  ) {}

  async verify(token: string): Promise<BorderlessTokenClaims> {
    if (looksLikeJwt(token)) {
      return this.jwtVerifier.verify(token);
    }

    const session = await this.sessionStore.get(token);
    if (!session) {
      throw new Error("Unknown or expired opaque token");
    }

    return {
      externalId: session.externalId,
      email: session.email,
      name: session.name,
    };
  }

  async invalidate(token: string): Promise<void> {
    if (looksLikeJwt(token)) {
      await this.jwtVerifier.revoke(token);
      return;
    }

    await this.sessionStore.delete(token);
  }
}
