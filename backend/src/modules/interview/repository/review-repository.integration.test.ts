import { afterAll, afterEach, describe, expect, it } from "vitest";
import prisma from "@/infrastructure/database";
import { ReviewPriority } from "../../../../prisma/generated/client";
import { disconnectDatabase, resetDatabase } from "@/test/integration/helpers";
import { ReviewRepository } from "./review-repository";

async function seedSession() {
  const user = await prisma.user.create({
    data: {
      name: "Review Test User",
      email: "review-test@example.com",
      password: "hashed-password",
    },
  });
  const resume = await prisma.resume.create({
    data: {
      userId: user.id,
      name: "Test Resume",
      sourceFormat: "pdf",
      storageKey: "resumes/review-test.pdf",
      status: "ready",
    },
  });
  const session = await prisma.interviewSession.create({
    data: {
      userId: user.id,
      resumeId: resume.id,
      level: "entry",
      interviewLocale: "en",
      maxTurns: 5,
    },
  });

  return { user, resume, session };
}

describe("ReviewRepository (integration)", () => {
  const repository = new ReviewRepository();

  afterEach(() => resetDatabase());
  afterAll(() => disconnectDatabase());

  it("upsert creates a review item with normalized topic", async () => {
    const { user, session } = await seedSession();

    const created = await repository.upsert({
      userId: user.id,
      sessionId: session.id,
      topic: "System Design",
      angle: "scalability patterns",
      description: "Practice scalability patterns",
      priority: ReviewPriority.high,
    });

    expect(created).toMatchObject({
      userId: user.id,
      sessionId: session.id,
      topic: "system design",
      angle: "scalability patterns",
      description: "Practice scalability patterns",
      priority: ReviewPriority.high,
    });
    expect(created.id).toBeTruthy();
  });

  it("upsert updates an existing item for the same user, topic, and angle", async () => {
    const { user, session } = await seedSession();
    const otherSession = await prisma.interviewSession.create({
      data: {
        userId: user.id,
        resumeId: session.resumeId,
        level: "senior",
        interviewLocale: "en",
      maxTurns: 8,
      },
    });

    const created = await repository.upsert({
      userId: user.id,
      sessionId: session.id,
      topic: "Algorithms",
      angle: "dynamic programming",
      description: "Review sorting",
      priority: ReviewPriority.medium,
    });

    const updated = await repository.upsert({
      userId: user.id,
      sessionId: otherSession.id,
      topic: "ALGORITHMS",
      angle: "dynamic programming",
      description: "Review dynamic programming",
      priority: ReviewPriority.high,
    });

    expect(updated.id).toBe(created.id);
    expect(updated).toMatchObject({
      sessionId: otherSession.id,
      topic: "algorithms",
      description: "Review dynamic programming",
      priority: ReviewPriority.high,
    });

    const stored = await prisma.reviewItem.findMany({
      where: { userId: user.id },
    });
    expect(stored).toHaveLength(1);
  });

  it("listByUserId returns review items for the user ordered by updatedAt desc", async () => {
    const { user, session } = await seedSession();
    const otherSession = await prisma.interviewSession.create({
      data: {
        userId: user.id,
        resumeId: session.resumeId,
        level: "mid",
        interviewLocale: "en",
      maxTurns: 7,
      },
    });

    await repository.upsert({
      userId: user.id,
      sessionId: session.id,
      topic: "databases",
      angle: "indexing strategies",
      description: "Indexes and query plans",
      priority: ReviewPriority.low,
    });
    await repository.upsert({
      userId: user.id,
      sessionId: otherSession.id,
      topic: "networking",
      angle: "tcp fundamentals",
      description: "TCP and HTTP fundamentals",
      priority: ReviewPriority.high,
    });

    const forSession = await prisma.reviewItem.findMany({
      where: { sessionId: session.id },
      orderBy: { updatedAt: "desc" },
    });
    const listed = await repository.listByUserId(user.id);

    expect(listed).toHaveLength(2);
    expect(listed[0]!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      listed[1]!.updatedAt.getTime(),
    );
    expect(forSession).toHaveLength(1);
    expect(forSession[0]).toMatchObject({
      sessionId: session.id,
      topic: "databases",
    });
    expect(listed.some((item) => item.sessionId === session.id)).toBe(true);
    expect(listed.some((item) => item.sessionId === otherSession.id)).toBe(
      true,
    );
  });

  it("findByUserIdAndTopicCaseInsensitive returns the same row regardless of topic casing", async () => {
    const { user, session } = await seedSession();

    const created = await repository.upsert({
      userId: user.id,
      sessionId: session.id,
      topic: "System Design",
      angle: "scalability patterns",
      description: "Practice scalability patterns",
      priority: ReviewPriority.high,
    });

    const found = await repository.findByUserIdAndTopicCaseInsensitive(
      user.id,
      "SYSTEM DESIGN",
    );

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.topic).toBe("system design");
  });

  // ReviewRepository uses PAIR_SIMILARITY_THRESHOLD = 0.7 (pg_trgm similarity on topic+angle).
  it("findSimilarByUserIdAndTopicAngle returns a row when the search phrase is similar enough", async () => {
    const { user, session } = await seedSession();

    const created = await repository.upsert({
      userId: user.id,
      sessionId: session.id,
      topic: "database indexing",
      angle: "b-tree and composite indexes",
      description: "B-tree and composite indexes",
      priority: ReviewPriority.medium,
    });

    const found = await repository.findSimilarByUserIdAndTopicAngle(
      user.id,
      "database index",
      "b-tree composite indexes",
    );

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.topic).toBe("database indexing");
    expect(found!.angle).toBe("b-tree and composite indexes");
  });

  it("findActiveByIdsAndUserId returns only active items owned by the user", async () => {
    const { user, session } = await seedSession();
    const otherUser = await prisma.user.create({
      data: {
        name: "Other User",
        email: "other-review@example.com",
        password: "hashed-password",
      },
    });
    const otherResume = await prisma.resume.create({
      data: {
        userId: otherUser.id,
        name: "Other Resume",
        sourceFormat: "pdf",
        storageKey: "resumes/other-review.pdf",
        status: "ready",
      },
    });
    const otherSession = await prisma.interviewSession.create({
      data: {
        userId: otherUser.id,
        resumeId: otherResume.id,
        level: "entry",
        interviewLocale: "en",
      maxTurns: 5,
      },
    });

    const activeItem = await repository.upsert({
      userId: user.id,
      sessionId: session.id,
      topic: "active topic",
      angle: "core concepts",
      description: "Still reviewing",
      priority: ReviewPriority.high,
    });
    const learnedItem = await prisma.reviewItem.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        topic: "learned topic",
        angle: "general",
        description: "Already mastered",
        priority: ReviewPriority.medium,
        status: "learned",
      },
    });
    const otherUserItem = await prisma.reviewItem.create({
      data: {
        userId: otherUser.id,
        sessionId: otherSession.id,
        topic: "foreign topic",
        angle: "general",
        description: "Belongs to another user",
        priority: ReviewPriority.low,
        status: "active",
      },
    });
    const nonexistentId = "00000000-0000-4000-8000-000000000000";

    const found = await repository.findActiveByIdsAndUserId(user.id, [
      activeItem.id,
      learnedItem.id,
      otherUserItem.id,
      nonexistentId,
    ]);

    expect(found).toHaveLength(1);
    expect(found[0]!.id).toBe(activeItem.id);
  });

  it("findActiveByIdsAndUserId returns all matching active items when every id is valid", async () => {
    const { user, session } = await seedSession();

    const first = await repository.upsert({
      userId: user.id,
      sessionId: session.id,
      topic: "first topic",
      angle: "foundations",
      description: "First active item",
      priority: ReviewPriority.high,
    });
    const second = await repository.upsert({
      userId: user.id,
      sessionId: session.id,
      topic: "second topic",
      angle: "advanced patterns",
      description: "Second active item",
      priority: ReviewPriority.medium,
    });

    const found = await repository.findActiveByIdsAndUserId(user.id, [
      first.id,
      second.id,
    ]);

    expect(found).toHaveLength(2);
    expect(found.map((item) => item.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
  });
});
