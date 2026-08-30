import { afterAll, afterEach, describe, expect, it } from "vitest";
import prisma from "@/infrastructure/database";
import { FeedbackRating } from "../../../../prisma/generated/client";
import { disconnectDatabase, resetDatabase } from "@/test/integration/helpers";
import { FeedbackRepository } from "./feedback-repository";

async function seedSession() {
  const user = await prisma.user.create({
    data: {
      name: "Feedback Test User",
      email: "feedback-test@example.com",
      password: "hashed-password",
    },
  });
  const resume = await prisma.resume.create({
    data: {
      userId: user.id,
      name: "Test Resume",
      sourceFormat: "pdf",
      storageKey: "resumes/feedback-test.pdf",
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

describe("FeedbackRepository (integration)", () => {
  const repository = new FeedbackRepository();

  afterEach(() => resetDatabase());
  afterAll(() => disconnectDatabase());

  it("upsert creates feedback for a session and user", async () => {
    const { user, session } = await seedSession();

    const created = await repository.upsert({
      sessionId: session.id,
      userId: user.id,
      rating: FeedbackRating.up,
      comment: "Great interview experience",
    });

    expect(created).toMatchObject({
      sessionId: session.id,
      userId: user.id,
      rating: FeedbackRating.up,
      comment: "Great interview experience",
    });
    expect(created.id).toBeTruthy();
  });

  it("upsert updates existing feedback for the same session and user", async () => {
    const { user, session } = await seedSession();

    const created = await repository.upsert({
      sessionId: session.id,
      userId: user.id,
      rating: FeedbackRating.up,
      comment: "Initial comment",
    });

    const updated = await repository.upsert({
      sessionId: session.id,
      userId: user.id,
      rating: FeedbackRating.down,
      comment: "Changed my mind",
    });

    expect(updated.id).toBe(created.id);
    expect(updated).toMatchObject({
      sessionId: session.id,
      userId: user.id,
      rating: FeedbackRating.down,
      comment: "Changed my mind",
    });

    const stored = await prisma.interviewFeedback.findMany({
      where: { sessionId: session.id, userId: user.id },
    });
    expect(stored).toHaveLength(1);
  });

  it("enforces unique constraint on sessionId and userId", async () => {
    const { user, session } = await seedSession();

    await repository.upsert({
      sessionId: session.id,
      userId: user.id,
      rating: FeedbackRating.up,
    });

    await expect(
      prisma.interviewFeedback.create({
        data: {
          sessionId: session.id,
          userId: user.id,
          rating: FeedbackRating.down,
        },
      }),
    ).rejects.toThrow();

    const stored = await prisma.interviewFeedback.findMany({
      where: { sessionId: session.id },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]!.rating).toBe(FeedbackRating.up);
  });
});
