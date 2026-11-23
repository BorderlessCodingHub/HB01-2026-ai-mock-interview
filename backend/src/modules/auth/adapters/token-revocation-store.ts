import type Redis from "ioredis";

import type { ITokenRevocationStore } from "@/modules/auth/protocols/token-revocation-store";

const KEY_PREFIX = "hone:revoked-jti:";

export class RedisTokenRevocationStore implements ITokenRevocationStore {
  constructor(private readonly redis: Redis) {}

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    const ttl = Math.max(1, Math.floor(ttlSeconds));
    await this.redis.set(`${KEY_PREFIX}${jti}`, "1", "EX", ttl);
  }

  async isRevoked(jti: string): Promise<boolean> {
    return (await this.redis.exists(`${KEY_PREFIX}${jti}`)) === 1;
  }
}
