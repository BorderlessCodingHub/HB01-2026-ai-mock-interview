import type { BorderlessTokenClaims } from "./borderless-token-verifier";

export type BorderlessSessionRecord = BorderlessTokenClaims & {
  /** Unix epoch seconds; omit when no expiry. */
  exp?: number;
};

export interface IBorderlessSessionStore {
  save(
    accessToken: string,
    record: BorderlessSessionRecord,
    ttlSeconds: number,
  ): Promise<void>;
  get(accessToken: string): Promise<BorderlessSessionRecord | null>;
  delete(accessToken: string): Promise<void>;
}
