import { afterAll, afterEach, describe, expect, it } from "vitest";
import { disconnectDatabase, resetDatabase } from "@/test/integration/helpers";
import { UserRepository } from "@/modules/auth/repository/user-repository";
import prisma from "@/infrastructure/database";
import { SessionQuotaRepository } from "./session-quota-repository";

describe("SessionQuotaRepository (integration)", () => {
  const userRepository = new UserRepository();
  const repository = new SessionQuotaRepository();

  async function seedUser(name = "Quota Owner") {
    return userRepository.create({
      name,
      email: `quota-owner-${crypto.randomUUID()}@example.com`,
      password: "$2b$10$hashedpasswordplaceholderfortests",
    });
  }

  afterEach(() => resetDatabase());
  afterAll(() => disconnectDatabase());

  it("insert + listInWindow round-trip returns the event", async () => {
    const user = await seedUser();
    const windowStart = new Date(Date.now() - 4 * 60 * 60 * 1000);

    const events = await prisma.$transaction(async (tx) => {
      await repository.insert(tx, user.id, "practice");
      return repository.listInWindow(tx, user.id, "practice", windowStart);
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: user.id,
      kind: "practice",
    });
    expect(events[0]?.id).toBeTruthy();
    expect(events[0]?.createdAt).toBeInstanceOf(Date);
    expect(events[0]?.createdAt.getTime()).toBeGreaterThan(
      windowStart.getTime(),
    );
  });

  it("does not list an event aged to exactly windowStart", async () => {
    const user = await seedUser();
    const windowStart = new Date(Date.now() - 4 * 60 * 60 * 1000);

    const inserted = await prisma.$transaction(async (tx) => {
      await repository.insert(tx, user.id, "practice");
      return repository.listInWindow(tx, user.id, "practice", windowStart);
    });

    expect(inserted).toHaveLength(1);
    const eventId = inserted[0]!.id;

    await prisma.sessionQuotaEvent.update({
      where: { id: eventId },
      data: { createdAt: windowStart },
    });

    const listed = await prisma.$transaction(async (tx) =>
      repository.listInWindow(tx, user.id, "practice", windowStart),
    );

    expect(listed).toHaveLength(0);
  });

  it("keeps practice and study buckets independent", async () => {
    const user = await seedUser();
    const windowStart = new Date(Date.now() - 4 * 60 * 60 * 1000);

    const { studyEvents, practiceEvents } = await prisma.$transaction(
      async (tx) => {
        await repository.insert(tx, user.id, "practice");
        const study = await repository.listInWindow(
          tx,
          user.id,
          "study",
          windowStart,
        );
        const practice = await repository.listInWindow(
          tx,
          user.id,
          "practice",
          windowStart,
        );
        return { studyEvents: study, practiceEvents: practice };
      },
    );

    expect(studyEvents).toHaveLength(0);
    expect(practiceEvents).toHaveLength(1);
    expect(practiceEvents[0]?.kind).toBe("practice");
  });

  it("lockBucket completes inside a transaction for practice and study", async () => {
    const user = await seedUser();

    await prisma.$transaction(async (tx) => {
      await repository.lockBucket(tx, user.id, "practice");
      await repository.lockBucket(tx, user.id, "study");
    });
  });

  it("scopes events to the owning user", async () => {
    const owner = await seedUser("Quota Owner");
    const other = await seedUser("Other Quota User");
    const windowStart = new Date(Date.now() - 4 * 60 * 60 * 1000);

    const { ownerEvents, otherEvents } = await prisma.$transaction(
      async (tx) => {
        await repository.insert(tx, owner.id, "practice");
        const forOwner = await repository.listInWindow(
          tx,
          owner.id,
          "practice",
          windowStart,
        );
        const forOther = await repository.listInWindow(
          tx,
          other.id,
          "practice",
          windowStart,
        );
        return { ownerEvents: forOwner, otherEvents: forOther };
      },
    );

    expect(ownerEvents).toHaveLength(1);
    expect(ownerEvents[0]?.userId).toBe(owner.id);
    expect(otherEvents).toHaveLength(0);
  });
});
