import { afterAll, afterEach, describe, expect, it } from "vitest";
import prisma from "@/infrastructure/database";
import { MessageRole } from "../../../../prisma/generated/client";
import { disconnectDatabase, resetDatabase } from "@/test/integration/helpers";
import { MessageRepository } from "./message-repository";

async function seedSession() {
  const user = await prisma.user.create({
    data: {
      name: "Message Test User",
      email: "message-test@example.com",
      password: "hashed-password",
    },
  });
  const resume = await prisma.resume.create({
    data: {
      userId: user.id,
      name: "Test Resume",
      sourceFormat: "pdf",
      storageKey: "resumes/message-test.pdf",
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

describe("MessageRepository (integration)", () => {
  const repository = new MessageRepository();

  afterEach(() => resetDatabase());
  afterAll(() => disconnectDatabase());

  it("createHuman and createAi persist messages with denormalized userId", async () => {
    const { user, session } = await seedSession();

    const human = await repository.createHuman({
      sessionId: session.id,
      userId: user.id,
      content: "Hello interviewer",
    });
    const ai = await repository.createAi({
      sessionId: session.id,
      userId: user.id,
      content: "Hello candidate",
    });

    expect(human).toMatchObject({
      sessionId: session.id,
      userId: user.id,
      role: MessageRole.human,
      content: "Hello interviewer",
    });
    expect(ai).toMatchObject({
      sessionId: session.id,
      userId: user.id,
      role: MessageRole.ai,
      content: "Hello candidate",
    });
    expect(human.id).toBeTruthy();
    expect(ai.id).toBeTruthy();
  });

  it("listBySessionId returns messages for the session ordered by createdAt asc", async () => {
    const { user, resume, session } = await seedSession();
    const otherSession = await prisma.interviewSession.create({
      data: {
        userId: user.id,
        resumeId: resume.id,
        level: "mid",
        interviewLocale: "en",
        maxTurns: 7,
      },
    });

    await repository.createHuman({
      sessionId: session.id,
      userId: user.id,
      content: "First",
    });
    await repository.createAi({
      sessionId: session.id,
      userId: user.id,
      content: "Second",
    });
    await repository.createHuman({
      sessionId: otherSession.id,
      userId: user.id,
      content: "Other session",
    });

    const messages = await repository.listBySessionId(session.id);

    expect(messages).toHaveLength(2);
    expect(messages.map((m) => m.content)).toEqual(["First", "Second"]);
    expect(messages[0]!.createdAt.getTime()).toBeLessThanOrEqual(
      messages[1]!.createdAt.getTime(),
    );
    expect(messages.every((m) => m.sessionId === session.id)).toBe(true);
  });

  it("listBySessionId returns an empty array when the session has no messages", async () => {
    const { session } = await seedSession();

    const messages = await repository.listBySessionId(session.id);

    expect(messages).toEqual([]);
  });

  it("listPageBySessionId returns the most recent messages, newest first", async () => {
    const { user, session } = await seedSession();

    await repository.createHuman({
      sessionId: session.id,
      userId: user.id,
      content: "First",
    });
    const second = await repository.createAi({
      sessionId: session.id,
      userId: user.id,
      content: "Second",
    });
    const third = await repository.createHuman({
      sessionId: session.id,
      userId: user.id,
      content: "Third",
    });

    const page = await repository.listPageBySessionId(session.id, {
      limit: 2,
    });

    expect(page.map((m) => m.id)).toEqual([third.id, second.id]);
  });

  it("listPageBySessionId returns messages before the given cursor, scoped to the session", async () => {
    const { user, resume, session } = await seedSession();
    const otherSession = await prisma.interviewSession.create({
      data: {
        userId: user.id,
        resumeId: resume.id,
        level: "mid",
        interviewLocale: "en",
        maxTurns: 7,
      },
    });

    const first = await repository.createHuman({
      sessionId: session.id,
      userId: user.id,
      content: "First",
    });
    const second = await repository.createAi({
      sessionId: session.id,
      userId: user.id,
      content: "Second",
    });
    const third = await repository.createHuman({
      sessionId: session.id,
      userId: user.id,
      content: "Third",
    });
    const otherSessionMessage = await repository.createHuman({
      sessionId: otherSession.id,
      userId: user.id,
      content: "Other session",
    });

    const page = await repository.listPageBySessionId(session.id, {
      limit: 10,
      beforeMessageId: third.id,
    });

    expect(page.map((m) => m.id)).toEqual([second.id, first.id]);
    expect(page.some((m) => m.id === otherSessionMessage.id)).toBe(false);
  });

  it("listPageBySessionId returns an empty array once every older message has been paged through", async () => {
    const { user, session } = await seedSession();

    const first = await repository.createHuman({
      sessionId: session.id,
      userId: user.id,
      content: "First",
    });

    const page = await repository.listPageBySessionId(session.id, {
      limit: 10,
      beforeMessageId: first.id,
    });

    expect(page).toEqual([]);
  });
});
