import { afterAll, afterEach, describe, expect, it } from "vitest";
import { disconnectDatabase, resetDatabase } from "@/test/integration/helpers";
import { UserRepository } from "@/modules/auth/repository/user-repository";
import { ResumeRepository } from "@/modules/resumes/repository/resume-repository";
import { MAX_TURNS_BY_LEVEL, SessionRepository } from "./session-repository";

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
      "pdf-url",
      "storage-key",
      resumeId,
    );
    return { user, resumeId };
  }

  afterEach(() => resetDatabase());
  afterAll(() => disconnectDatabase());

  it.each([
    ["entry", 6],
    ["mid", 8],
    ["senior", 9],
  ] as const)(
    "create sets maxTurns to %i for level %s",
    async (level, maxTurns) => {
      const { user, resumeId } = await seedUserAndResume();

      const session = await repository.create({
        userId: user.id,
        resumeId,
        level,
        interviewLocale: "en",
      });

      expect(session).toMatchObject({
        userId: user.id,
        resumeId,
        level,
        maxTurns,
        turnCount: 0,
        isFinished: false,
      });
      expect(session.maxTurns).toBe(MAX_TURNS_BY_LEVEL[level]);
    },
  );

  it("create persists interviewLocale from params", async () => {
    const { user, resumeId } = await seedUserAndResume();

    const session = await repository.create({
      userId: user.id,
      resumeId,
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
      level: "entry",
      interviewLocale: "en",
    });
    await new Promise((resolve) => setTimeout(resolve, 15));
    const newer = await repository.create({
      userId: user.id,
      resumeId,
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
      level: "entry",
      interviewLocale: "en",
    });

    const found = await repository.findByIdAndUserId(created.id, user.id);

    expect(found).toMatchObject({
      id: created.id,
      userId: user.id,
      resumeId,
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
      level: "entry",
      interviewLocale: "en",
    });

    const found = await repository.findById(created.id);

    expect(found).toMatchObject({
      id: created.id,
      userId: user.id,
      resumeId,
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
});
