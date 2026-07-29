import type Redis from "ioredis";

import type {
  BorderlessSessionRecord,
  IBorderlessSessionStore,
} from "@/modules/auth/protocols/borderless-session-store";

const KEY_PREFIX = "borderless:session:";

export class RedisBorderlessSessionStore implements IBorderlessSessionStore {
  constructor(private readonly redis: Redis) {}

  private key(accessToken: string): string {
    return `${KEY_PREFIX}${accessToken}`;
  }

  async save(
    accessToken: string,
    record: BorderlessSessionRecord,
    ttlSeconds: number,
  ): Promise<void> {
    const ttl = Math.max(1, Math.floor(ttlSeconds));
    await this.redis.set(
      this.key(accessToken),
      JSON.stringify(record),
      "EX",
      ttl,
    );
  }

  async get(accessToken: string): Promise<BorderlessSessionRecord | null> {
    const raw = await this.redis.get(this.key(accessToken));
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as BorderlessSessionRecord;
      if (
        typeof parsed.externalId !== "string" ||
        typeof parsed.email !== "string" ||
        typeof parsed.name !== "string"
      ) {
        return null;
      }

      if (typeof parsed.exp === "number" && Date.now() >= parsed.exp * 1000) {
        await this.delete(accessToken);
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  async delete(accessToken: string): Promise<void> {
    await this.redis.del(this.key(accessToken));
  }
}
