import { describe, expect, it, vi } from "vitest";
import type Redis from "ioredis";

import { RedisBorderlessSessionStore } from "./borderless-session-store";

function createRedisMock() {
  const data = new Map<string, string>();
  return {
    data,
    set: vi.fn(async (key: string, value: string, _ex?: string, _ttl?: number) => {
      data.set(key, value);
      return "OK";
    }),
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    del: vi.fn(async (key: string) => {
      data.delete(key);
      return 1;
    }),
  };
}

describe("RedisBorderlessSessionStore", () => {
  it("saves and retrieves a session record", async () => {
    const redis = createRedisMock();
    const store = new RedisBorderlessSessionStore(redis as unknown as Redis);

    await store.save(
      "opaque-token",
      {
        externalId: "ext-1",
        email: "a@example.com",
        name: "Ada",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      3600,
    );

    expect(redis.set).toHaveBeenCalledWith(
      "borderless:session:opaque-token",
      expect.any(String),
      "EX",
      3600,
    );

    await expect(store.get("opaque-token")).resolves.toMatchObject({
      externalId: "ext-1",
      email: "a@example.com",
      name: "Ada",
    });
  });

  it("returns null for missing tokens", async () => {
    const redis = createRedisMock();
    const store = new RedisBorderlessSessionStore(redis as unknown as Redis);

    await expect(store.get("missing")).resolves.toBeNull();
  });

  it("deletes expired records on read", async () => {
    const redis = createRedisMock();
    const store = new RedisBorderlessSessionStore(redis as unknown as Redis);
    await redis.set(
      "borderless:session:expired",
      JSON.stringify({
        externalId: "ext-2",
        email: "b@example.com",
        name: "Bob",
        exp: Math.floor(Date.now() / 1000) - 10,
      }),
    );

    await expect(store.get("expired")).resolves.toBeNull();
    expect(redis.del).toHaveBeenCalledWith("borderless:session:expired");
  });

  it("deletes a session by token", async () => {
    const redis = createRedisMock();
    const store = new RedisBorderlessSessionStore(redis as unknown as Redis);
    await store.save(
      "to-delete",
      { externalId: "ext-3", email: "c@example.com", name: "Cara" },
      60,
    );

    await store.delete("to-delete");
    await expect(store.get("to-delete")).resolves.toBeNull();
  });
});
