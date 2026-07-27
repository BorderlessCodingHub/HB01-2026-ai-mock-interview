import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

import type { IBorderlessSessionStore } from "@/modules/auth/protocols/borderless-session-store";
import { BorderlessTokenResolver } from "./borderless-token-resolver";

const SIGNING_KEY = "test-only-signing-key-ignored-by-parser";

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

describe("BorderlessTokenResolver", () => {
  it("decodes JWT-shaped tokens without using the session store", async () => {
    const store = createStore();
    const resolver = new BorderlessTokenResolver(store);
    const token = jwt.sign(
      { sub: "ext-1", email: "a@example.com", name: "Ada" },
      SIGNING_KEY,
      { expiresIn: "1h" },
    );

    await expect(resolver.verify(token)).resolves.toEqual({
      externalId: "ext-1",
      email: "a@example.com",
      name: "Ada",
    });
    expect(store.get).not.toHaveBeenCalled();
  });

  it("looks up opaque tokens in the session store", async () => {
    const store = createStore({
      get: vi.fn().mockResolvedValue({
        externalId: "ext-opaque",
        email: "opaque@example.com",
        name: "Opaque User",
      }),
    });
    const resolver = new BorderlessTokenResolver(store);

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
    const resolver = new BorderlessTokenResolver(createStore());

    await expect(resolver.verify("unknown-opaque-token")).rejects.toThrow(
      /unknown or expired opaque token/i,
    );
  });
});
