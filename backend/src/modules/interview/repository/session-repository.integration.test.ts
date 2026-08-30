import { afterAll, afterEach, describe, expect, it } from "vitest";
import prisma from "@/infrastructure/database";
import { disconnectDatabase, resetDatabase } from "@/test/integration/helpers";
import { UserRepository } from "@/modules/auth/repository/user-repository";
import { ResumeRepository } from "@/modules/resumes/repository/resume-repository";
import { SessionRepository } from "./session-repository";

describe("SessionRepository (integration)", () => {
  const userRepository = new UserRepository();
  const resumeRepository = new ResumeRepository();
  const repository = new SessionRepository();

  async function seedUserAndResume() {
    const user = await userRepository.create({
      name: "Session Owner",
      email: `session-owner-${crypto.randomUUID()}@example.com`,
      password: "$2b$10$hashedpasswordplaceholderfortests",
    });
    const resumeId = crypto.randomUUID();
    await resumeRepository.createProcessing(
      user.id,
      "CV.pdf",
      "storage-key",
      "pdf",
      resumeId,
    );
    return { user, resumeId };
  }

  afterEach(() => resetDatabase());
  afterAll(() => disconnectDatabase());

  it.each(["entry", "mid", "senior"] as const)(
    "create sets maxTurns from the explicit turn count for level %s",
    async (level) => {
      const { user, resumeId } = await seedUserAndResume();

      const session = await repository.create({
        userId: user.id,
        resumeId,
        resumeName: "CV.pdf",
        level,
        interviewLocale: "en",
        maxTurns: 13,
      });

      expect(session).toMatchObject({
        userId: user.id,
        resumeId,
        resumeName: "CV.pdf",
        level,
        maxTurns: 13,
        turnCount: 0,
        isFinished: false,
      });
    },
  );

  it("create falls back to a default maxTurns when none is given", async () => {
    const { user, resumeId } = await seedUserAndResume();

    const session = await repository.create({
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "mid",
      interviewLocale: "en",
    });

    expect(session.maxTurns).toBe(9);
  });

  it("create inside a rolled-back transaction does not persist a session", async () => {
    const { user, resumeId } = await seedUserAndResume();
    await expect(
      prisma.$transaction(async (tx) => {
        await repository.create(
          { userId: user.id, resumeId, resumeName: "CV.pdf", level: "mid", interviewLocale: "en" },
          tx,
        );
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    const sessions = await repository.listByUserId(user.id);
    expect(sessions).toHaveLength(0);
  });

  it("create persists interviewLocale from params", async () => {
    const { user, resumeId } = await seedUserAndResume();

    const session = await repository.create({
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "mid",
      interviewLocale: "pt",
    });

    expect(session.interviewLocale).toBe("pt");

    const found = await repository.findByIdAndUserId(session.id, user.id);
    expect(found?.interviewLocale).toBe("pt");
  });

  it("listByUserId returns sessions for the user ordered by createdAt desc", async () => {
    const { user, resumeId } = await seedUserAndResume();

    const older = await repository.create({
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "entry",
      interviewLocale: "en",
    });
    await new Promise((resolve) => setTimeout(resolve, 15));
    const newer = await repository.create({
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "mid",
      interviewLocale: "pt",
    });

    const sessions = await repository.listByUserId(user.id);

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.id).toBe(newer.id);
    expect(sessions[1]?.id).toBe(older.id);
  });

  it("findByIdAndUserId returns session when owned by user", async () => {
    const { user, resumeId } = await seedUserAndResume();

    const created = await repository.create({
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "entry",
      interviewLocale: "en",
    });

    const found = await repository.findByIdAndUserId(created.id, user.id);

    expect(found).toMatchObject({
      id: created.id,
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "entry",
    });
  });

  it("findByIdAndUserId returns null for another user", async () => {
    const { user, resumeId } = await seedUserAndResume();
    const other = await userRepository.create({
      name: "Other User",
      email: `other-${crypto.randomUUID()}@example.com`,
      password: "$2b$10$hashedpasswordplaceholderfortests",
    });

    const created = await repository.create({
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "entry",
      interviewLocale: "en",
    });

    const found = await repository.findByIdAndUserId(created.id, other.id);

    expect(found).toBeNull();
  });

  it("findById returns session regardless of owner", async () => {
    const { user, resumeId } = await seedUserAndResume();

    const created = await repository.create({
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "entry",
      interviewLocale: "en",
    });

    const found = await repository.findById(created.id);

    expect(found).toMatchObject({
      id: created.id,
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "entry",
    });
  });

  it("findById returns null when session does not exist", async () => {
    const found = await repository.findById(crypto.randomUUID());

    expect(found).toBeNull();
  });

  it("incrementTurnCount", async () => {
    const { user, resumeId } = await seedUserAndResume();

    const created = await repository.create({
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "entry",
      interviewLocale: "en",
    });
    expect(created.turnCount).toBe(0);

    const updated = await repository.incrementTurnCount(created.id);

    expect(updated.turnCount).toBe(1);
  });

  it("markFinished sets isFinished and overwrites interviewLocale", async () => {
    const { user, resumeId } = await seedUserAndResume();

    const created = await repository.create({
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "entry",
      interviewLocale: "en",
    });
    expect(created.isFinished).toBe(false);
    expect(created.interviewLocale).toBe("en");
    expect(created.reviewGenerationStatus).toBe("idle");

    const updated = await repository.markFinished(created.id, "pt");

    expect(updated.isFinished).toBe(true);
    expect(updated.interviewLocale).toBe("pt");
    expect(updated.reviewGenerationStatus).toBe("pending");
    expect(updated.reviewGenerationError).toBeNull();

    const found = await repository.findByIdAndUserId(created.id, user.id);
    expect(found?.isFinished).toBe(true);
    expect(found?.interviewLocale).toBe("pt");
    expect(found?.reviewGenerationStatus).toBe("pending");
    expect(found?.reviewGenerationError).toBeNull();
  });

  it("markReviewGenerationFailed sets failed status and error without reopening chat", async () => {
    const { user, resumeId } = await seedUserAndResume();

    const created = await repository.create({
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "entry",
      interviewLocale: "en",
    });
    await repository.markFinished(created.id, "en");

    const failed = await repository.markReviewGenerationFailed(
      created.id,
      "quota exceeded",
    );

    expect(failed.isFinished).toBe(true);
    expect(failed.reviewGenerationStatus).toBe("failed");
    expect(failed.reviewGenerationError).toBe("quota exceeded");

    const found = await repository.findByIdAndUserId(created.id, user.id);
    expect(found?.isFinished).toBe(true);
    expect(found?.reviewGenerationStatus).toBe("failed");
    expect(found?.reviewGenerationError).toBe("quota exceeded");
  });

  it("markReviewGenerationReady sets ready and clears error without changing isFinished", async () => {
    const { user, resumeId } = await seedUserAndResume();

    const created = await repository.create({
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "entry",
      interviewLocale: "en",
    });
    await repository.markFinished(created.id, "en");
    await repository.markReviewGenerationFailed(created.id, "transient error");

    const ready = await repository.markReviewGenerationReady(created.id);

    expect(ready.isFinished).toBe(true);
    expect(ready.reviewGenerationStatus).toBe("ready");
    expect(ready.reviewGenerationError).toBeNull();

    const found = await repository.findByIdAndUserId(created.id, user.id);
    expect(found?.isFinished).toBe(true);
    expect(found?.reviewGenerationStatus).toBe("ready");
    expect(found?.reviewGenerationError).toBeNull();
  });

  it("markReviewGenerationPending resets to pending for retry without toggling isFinished", async () => {
    const { user, resumeId } = await seedUserAndResume();

    const created = await repository.create({
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "entry",
      interviewLocale: "en",
    });
    await repository.markFinished(created.id, "en");
    await repository.markReviewGenerationFailed(created.id, "worker crashed");

    const pending = await repository.markReviewGenerationPending(created.id);

    expect(pending.isFinished).toBe(true);
    expect(pending.reviewGenerationStatus).toBe("pending");
    expect(pending.reviewGenerationError).toBeNull();

    const found = await repository.findByIdAndUserId(created.id, user.id);
    expect(found?.isFinished).toBe(true);
    expect(found?.reviewGenerationStatus).toBe("pending");
    expect(found?.reviewGenerationError).toBeNull();
  });

  it("deleteByIdAndUserId keeps review items, weak answers, and topic coverage", async () => {
    const { user, resumeId } = await seedUserAndResume();
    const session = await repository.create({
      userId: user.id,
      resumeId,
      resumeName: "CV.pdf",
      level: "entry",
      interviewLocale: "en",
    });

    await prisma.interviewMessage.create({
      data: {
        sessionId: session.id,
        userId: user.id,
        role: "ai",
        content: "Tell me about yourself.",
      },
    });
    const reviewItem = await prisma.reviewItem.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        topic: "system design",
        angle: "caching",
        description: "Practice caching trade-offs.",
        priority: "high",
      },
    });
    const weakAnswer = await prisma.weakAnswer.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        question: "How would you scale reads?",
        userAnswer: "Add more servers.",
        evaluation: "insufficient",
        feedback: "Mention caching.",
        topic: "system design",
        priority: "high",
      },
    });
    const coverage = await prisma.topicCoverage.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        topic: "system design",
        angle: "caching",
      },
    });

    const deleted = await repository.deleteByIdAndUserId(session.id, user.id);

    expect(deleted?.id).toBe(session.id);
    expect(
      await prisma.interviewSession.findUnique({ where: { id: session.id } }),
    ).toBeNull();
    expect(
      await prisma.interviewMessage.count({ where: { sessionId: session.id } }),
    ).toBe(0);

    expect(
      await prisma.reviewItem.findUnique({ where: { id: reviewItem.id } }),
    ).toMatchObject({ id: reviewItem.id, sessionId: null });
    expect(
      await prisma.weakAnswer.findUnique({ where: { id: weakAnswer.id } }),
    ).toMatchObject({ id: weakAnswer.id, sessionId: null });
    expect(
      await prisma.topicCoverage.findUnique({ where: { id: coverage.id } }),
    ).toMatchObject({ id: coverage.id, sessionId: null });
  });
});
