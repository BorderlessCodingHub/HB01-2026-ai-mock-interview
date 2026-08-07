import { describe, expect, it, vi } from "vitest";

import type { UserRepository } from "../repository/user-repository";
import type { User } from "../types/user";

import { UserSyncService } from "./user-sync-service";

function makeUser(overrides?: Partial<User>): User {
  return {
    id: 1,
    externalId: "ext-1",
    name: "Ada",
    email: "ada@example.com",
    password: null,
    interviewLocale: "en",
    hasCompletedTutorial: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("UserSyncService", () => {
  it("delegates upsert to the repository and returns the local user", async () => {
    const upsertFromBorderless = vi.fn().mockResolvedValue(makeUser());
    const repository = {
      upsertFromBorderless,
    } as unknown as UserRepository;

    const service = new UserSyncService(repository);
    const user = await service.resolveLocalUser({
      externalId: "ext-1",
      email: "ada@example.com",
      name: "Ada Lovelace",
    });

    expect(upsertFromBorderless).toHaveBeenCalledWith({
      externalId: "ext-1",
      email: "ada@example.com",
      name: "Ada Lovelace",
    });
    expect(user.interviewLocale).toBe("en");
    expect(user.id).toBe(1);
  });
});
