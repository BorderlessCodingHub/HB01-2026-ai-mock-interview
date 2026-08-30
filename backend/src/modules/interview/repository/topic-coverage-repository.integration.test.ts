import { afterAll, afterEach, describe, expect, it } from "vitest";
import prisma from "@/infrastructure/database";
import { disconnectDatabase, resetDatabase } from "@/test/integration/helpers";
import { TopicCoverageRepository } from "./topic-coverage-repository";

async function seedSession() {
  const user = await prisma.user.create({
    data: {
      name: "Topic Coverage Test User",
      email: "topic-coverage-test@example.com",
      password: "hashed-password",
    },
  });
  const resume = await prisma.resume.create({
    data: {
      userId: user.id,
      name: "Test Resume",
      sourceFormat: "pdf",
      storageKey: "resumes/topic-coverage-test.pdf",
      status: "ready",
    },
  });
  const session = await prisma.interviewSession.create({
    data: {
      userId: user.id,
      resumeId: resume.id,
      level: "entry",
      maxTurns: 5,
    },
  });

  return { user, resume, session };
}

describe("TopicCoverageRepository (integration)", () => {
  const repository = new TopicCoverageRepository();

  afterEach(() => resetDatabase());
  afterAll(() => disconnectDatabase());

  it("createMany persists topic and angle rows for a session", async () => {
    const { user, session } = await seedSession();

    await repository.createMany([
      {
        userId: user.id,
        sessionId: session.id,
        topic: "System design",
        angle: "trade-offs",
      },
      {
        userId: user.id,
        sessionId: session.id,
        topic: "Databases",
        angle: "indexing",
      },
    ]);

    const stored = await prisma.topicCoverage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({
      sessionId: session.id,
      topic: "System design",
      angle: "trade-offs",
    });
    expect(stored[1]).toMatchObject({
      sessionId: session.id,
      topic: "Databases",
      angle: "indexing",
    });
  });

  it("listRecentByUserId returns newest-first rows up to the limit", async () => {
    const { user, session } = await seedSession();
    const base = new Date("2026-01-01T00:00:00.000Z");

    await prisma.topicCoverage.createMany({
      data: [
        {
          userId: user.id,
          sessionId: session.id,
          topic: "Oldest",
          angle: "a",
          createdAt: new Date(base.getTime()),
        },
        {
          userId: user.id,
          sessionId: session.id,
          topic: "Middle",
          angle: "b",
          createdAt: new Date(base.getTime() + 1_000),
        },
        {
          userId: user.id,
          sessionId: session.id,
          topic: "Newest",
          angle: "c",
          createdAt: new Date(base.getTime() + 2_000),
        },
      ],
    });

    const listed = await repository.listRecentByUserId(user.id, 2);

    expect(listed).toHaveLength(2);
    expect(listed[0]!.topic).toBe("Newest");
    expect(listed[1]!.topic).toBe("Middle");
  });

  it("countBySessionId returns the number of rows for a session", async () => {
    const { user, session } = await seedSession();
    const otherSession = await prisma.interviewSession.create({
      data: {
        userId: user.id,
        resumeId: (
          await prisma.resume.findFirstOrThrow({ where: { userId: user.id } })
        ).id,
        level: "entry",
        maxTurns: 5,
      },
    });

    await repository.createMany([
      {
        userId: user.id,
        sessionId: session.id,
        topic: "Algorithms",
        angle: "complexity",
      },
      {
        userId: user.id,
        sessionId: session.id,
        topic: "Networking",
        angle: "latency",
      },
      {
        userId: user.id,
        sessionId: otherSession.id,
        topic: "Other session",
        angle: "ignored",
      },
    ]);

    expect(await repository.countBySessionId(session.id)).toBe(2);
    expect(await repository.countBySessionId(otherSession.id)).toBe(1);
    expect(await repository.countBySessionId("missing-session-id")).toBe(0);
  });

  it("pruneOldestBeyondLimit keeps only the newest rows for the user", async () => {
    const { user, session } = await seedSession();
    const base = new Date("2026-02-01T00:00:00.000Z");

    await prisma.topicCoverage.createMany({
      data: [
        {
          userId: user.id,
          sessionId: session.id,
          topic: "T1",
          angle: "a",
          createdAt: new Date(base.getTime()),
        },
        {
          userId: user.id,
          sessionId: session.id,
          topic: "T2",
          angle: "b",
          createdAt: new Date(base.getTime() + 1_000),
        },
        {
          userId: user.id,
          sessionId: session.id,
          topic: "T3",
          angle: "c",
          createdAt: new Date(base.getTime() + 2_000),
        },
        {
          userId: user.id,
          sessionId: session.id,
          topic: "T4",
          angle: "d",
          createdAt: new Date(base.getTime() + 3_000),
        },
      ],
    });

    const deleted = await repository.pruneOldestBeyondLimit(user.id, 2);

    expect(deleted).toBe(2);

    const remaining = await repository.listRecentByUserId(user.id, 10);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((row) => row.topic)).toEqual(["T4", "T3"]);
  });

  it("pruneOldestBeyondLimit does not remove rows belonging to another user", async () => {
    const { user, session } = await seedSession();
    const otherUser = await prisma.user.create({
      data: {
        name: "Other User",
        email: "topic-coverage-other@example.com",
        password: "hashed-password",
      },
    });
    const otherResume = await prisma.resume.create({
      data: {
        userId: otherUser.id,
        name: "Other Resume",
        sourceFormat: "pdf",
        storageKey: "resumes/other.pdf",
        status: "ready",
      },
    });
    const otherSession = await prisma.interviewSession.create({
      data: {
        userId: otherUser.id,
        resumeId: otherResume.id,
        level: "entry",
        maxTurns: 5,
      },
    });
    const base = new Date("2026-03-01T00:00:00.000Z");

    await prisma.topicCoverage.createMany({
      data: [
        {
          userId: user.id,
          sessionId: session.id,
          topic: "User A old",
          angle: "a",
          createdAt: new Date(base.getTime()),
        },
        {
          userId: user.id,
          sessionId: session.id,
          topic: "User A new",
          angle: "b",
          createdAt: new Date(base.getTime() + 1_000),
        },
        {
          userId: otherUser.id,
          sessionId: otherSession.id,
          topic: "User B",
          angle: "c",
          createdAt: new Date(base.getTime()),
        },
      ],
    });

    await repository.pruneOldestBeyondLimit(user.id, 1);

    expect(await repository.listRecentByUserId(user.id, 10)).toHaveLength(1);
    expect(await repository.listRecentByUserId(otherUser.id, 10)).toHaveLength(
      1,
    );
  });
});
