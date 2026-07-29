import type { IBorderlessSessionStore } from "@/modules/auth/protocols/borderless-session-store";
import type {
  BorderlessTokenClaims,
  IBorderlessTokenVerifier,
} from "@/modules/auth/protocols/borderless-token-verifier";

import { BorderlessAccessTokenParser } from "./borderless-access-token-parser";

/** JWT = three base64url segments separated by dots. */
function looksLikeJwt(token: string): boolean {
  const parts = token.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

/**
 * Resolves Borderless Bearer tokens that are either JWTs (decode claims)
 * or opaque session tokens registered in Redis at login.
 */
export class BorderlessTokenResolver implements IBorderlessTokenVerifier {
  private readonly jwtParser = new BorderlessAccessTokenParser();

  constructor(private readonly sessionStore: IBorderlessSessionStore) {}

  async verify(token: string): Promise<BorderlessTokenClaims> {
    if (looksLikeJwt(token)) {
      return this.jwtParser.verify(token);
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
}
