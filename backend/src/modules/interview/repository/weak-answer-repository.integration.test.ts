import { afterAll, afterEach, describe, expect, it } from "vitest";
import prisma from "@/infrastructure/database";
import { ReviewPriority } from "../../../../prisma/generated/client";
import { disconnectDatabase, resetDatabase } from "@/test/integration/helpers";
import { WeakAnswerRepository } from "./weak-answer-repository";

async function seedSession() {
  const user = await prisma.user.create({
    data: {
      name: "Weak Answer Test User",
      email: "weak-answer-test@example.com",
      password: "hashed-password",
    },
  });
  const resume = await prisma.resume.create({
    data: {
      userId: user.id,
      name: "Test Resume",
      sourceFormat: "pdf",
      storageKey: "resumes/weak-answer-test.pdf",
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

describe("WeakAnswerRepository (integration)", () => {
  const repository = new WeakAnswerRepository();

  afterEach(() => resetDatabase());
  afterAll(() => disconnectDatabase());

  it("createMany persists weak answer items for a session", async () => {
    const { user, session } = await seedSession();

    await repository.createMany([
      {
        userId: user.id,
        sessionId: session.id,
        question: "How would you scale a read-heavy API?",
        userAnswer: "I'd just add more servers.",
        evaluation: "insufficient",
        feedback: "Mention caching, read replicas, and CDN strategies.",
        topic: "System design",
        priority: ReviewPriority.high,
      },
    ]);

    const stored = await prisma.weakAnswer.findMany({
      where: { userId: user.id },
    });

    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      sessionId: session.id,
      question: "How would you scale a read-heavy API?",
      evaluation: "insufficient",
      topic: "System design",
      priority: ReviewPriority.high,
    });
  });

  it("createMany does nothing when given an empty list", async () => {
    const { user } = await seedSession();

    await repository.createMany([]);

    const stored = await prisma.weakAnswer.findMany({
      where: { userId: user.id },
    });
    expect(stored).toHaveLength(0);
  });

  it("listByUserId returns weak answers for the user ordered by createdAt desc", async () => {
    const { user, session } = await seedSession();

    await repository.createMany([
      {
        userId: user.id,
        sessionId: session.id,
        question: "Q1",
        userAnswer: "A1",
        evaluation: "incorrect",
        feedback: "Feedback 1",
        topic: "Algorithms",
        priority: ReviewPriority.low,
      },
    ]);
    await repository.createMany([
      {
        userId: user.id,
        sessionId: session.id,
        question: "Q2",
        userAnswer: "A2",
        evaluation: "incomplete",
        feedback: "Feedback 2",
        topic: "Databases",
        priority: ReviewPriority.medium,
      },
    ]);

    const listed = await repository.listByUserId(user.id);

    expect(listed).toHaveLength(2);
    expect(listed[0]!.topic).toBe("Databases");
    expect(listed[1]!.topic).toBe("Algorithms");
  });

  it("listByUserId does not return items belonging to another user", async () => {
    const { session } = await seedSession();
    const otherUser = await prisma.user.create({
      data: {
        name: "Other User",
        email: "weak-answer-other@example.com",
        password: "hashed-password",
      },
    });

    await repository.createMany([
      {
        userId: session.userId,
        sessionId: session.id,
        question: "Q1",
        userAnswer: "A1",
        evaluation: "incorrect",
        feedback: "Feedback 1",
        topic: "Algorithms",
        priority: ReviewPriority.low,
      },
    ]);

    const listed = await repository.listByUserId(otherUser.id);
    expect(listed).toHaveLength(0);
  });

  it("deleteByIdAndUserId removes the item and returns true when owned by the user", async () => {
    const { user, session } = await seedSession();

    await repository.createMany([
      {
        userId: user.id,
        sessionId: session.id,
        question: "Q1",
        userAnswer: "A1",
        evaluation: "incorrect",
        feedback: "Feedback 1",
        topic: "Algorithms",
        priority: ReviewPriority.low,
      },
    ]);
    const [created] = await repository.listByUserId(user.id);

    const deleted = await repository.deleteByIdAndUserId(
      created!.id,
      user.id,
    );

    expect(deleted).toBe(true);
    expect(await repository.listByUserId(user.id)).toHaveLength(0);
  });

  it("deleteByIdAndUserId returns false when the item belongs to another user", async () => {
    const { user, session } = await seedSession();
    const otherUser = await prisma.user.create({
      data: {
        name: "Other User",
        email: "weak-answer-other-delete@example.com",
        password: "hashed-password",
      },
    });

    await repository.createMany([
      {
        userId: user.id,
        sessionId: session.id,
        question: "Q1",
        userAnswer: "A1",
        evaluation: "incorrect",
        feedback: "Feedback 1",
        topic: "Algorithms",
        priority: ReviewPriority.low,
      },
    ]);
    const [created] = await repository.listByUserId(user.id);

    const deleted = await repository.deleteByIdAndUserId(
      created!.id,
      otherUser.id,
    );

    expect(deleted).toBe(false);
    expect(await repository.listByUserId(user.id)).toHaveLength(1);
  });
});
