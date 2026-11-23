export interface ITokenRevocationStore {
  /** Marks a token id as revoked until it would have expired anyway. */
  revoke(jti: string, ttlSeconds: number): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
}
