import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionQuotaRepository } from "@/modules/session-quota/repository/session-quota-repository";
import { SessionQuotaExceededError } from "@/shared";
import type { SessionQuotaEvent } from "../../../../prisma/generated/client";

const { fakeTx } = vi.hoisted(() => ({ fakeTx: {} }));

vi.mock("@/infrastructure/database", () => {
  const prisma = {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(fakeTx),
    ),
  };
  return { default: prisma, prisma };
});

import { SessionQuotaService } from "@/modules/session-quota/service/session-quota-service";

const USER_ID = 1;
const WINDOW_MS = 14400000;
const CONFIG = {
  practiceMax: 3,
  studyMax: 3,
  windowMs: WINDOW_MS,
};

function quotaEvent(
  createdAt: Date,
  kind: SessionQuotaEvent["kind"] = "practice",
): SessionQuotaEvent {
  return {
    id: crypto.randomUUID(),
    userId: USER_ID,
    kind,
    createdAt,
  };
}

describe("SessionQuotaService", () => {
  let repository: SessionQuotaRepository;
  let service: SessionQuotaService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));

    repository = {
      lockBucket: vi.fn().mockResolvedValue(undefined),
      listInWindow: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue(undefined),
    } as unknown as SessionQuotaRepository;

    service = new SessionQuotaService(repository, CONFIG);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function mockWindows(events: {
    practice?: SessionQuotaEvent[];
    study?: SessionQuotaEvent[];
  }) {
    vi.mocked(repository.listInWindow).mockImplementation(
      async (_tx, _userId, kind) => {
        if (kind === "practice") {
          return events.practice ?? [];
        }
        return events.study ?? [];
      },
    );
  }

  it("computes snapshot used, limit, and remaining from in-window counts", async () => {
    mockWindows({
      practice: [quotaEvent(new Date())],
      study: [],
    });

    const snapshot = await service.getSnapshot(USER_ID);

    expect(snapshot.practice).toMatchObject({
      used: 1,
      limit: 3,
      remaining: 2,
    });
    expect(snapshot.study).toMatchObject({
      used: 0,
      limit: 3,
      remaining: 3,
    });
    expect(repository.lockBucket).not.toHaveBeenCalled();
  });

  it("sets retryAfterSeconds to null when remaining is greater than 0", async () => {
    mockWindows({
      practice: [quotaEvent(new Date()), quotaEvent(new Date())],
      study: [quotaEvent(new Date(), "study")],
    });

    const snapshot = await service.getSnapshot(USER_ID);

    expect(snapshot.practice.remaining).toBe(1);
    expect(snapshot.practice.retryAfterSeconds).toBeNull();
    expect(snapshot.study.remaining).toBe(2);
    expect(snapshot.study.retryAfterSeconds).toBeNull();
  });

  it("ceils retryAfterSeconds from the oldest event when remaining is 0", async () => {
    const now = Date.now();
    const oldest = new Date(now - WINDOW_MS + 1500);
    mockWindows({
      practice: [
        quotaEvent(oldest),
        quotaEvent(new Date(now - 1000)),
        quotaEvent(new Date(now - 500)),
      ],
    });

    const snapshot = await service.getSnapshot(USER_ID);

    expect(snapshot.practice.remaining).toBe(0);
    expect(snapshot.practice.retryAfterSeconds).toBe(2);
  });

  it("passes exclusive windowStart (now - windowMs) to listInWindow", async () => {
    const now = Date.now();
    mockWindows({ practice: [], study: [] });

    await service.getSnapshot(USER_ID);

    const windowStart = new Date(now - WINDOW_MS);
    expect(repository.listInWindow).toHaveBeenCalledWith(
      fakeTx,
      USER_ID,
      "practice",
      windowStart,
    );
    expect(repository.listInWindow).toHaveBeenCalledWith(
      fakeTx,
      USER_ID,
      "study",
      windowStart,
    );
  });

  it("throws SessionQuotaExceededError without calling work or insert when at max", async () => {
    const now = Date.now();
    mockWindows({
      practice: [
        quotaEvent(new Date(now - 3000)),
        quotaEvent(new Date(now - 2000)),
        quotaEvent(new Date(now - 1000)),
      ],
    });
    const work = vi.fn(async () => ({ id: "should-not-run" }));

    await expect(
      service.runWithSlot(USER_ID, "practice", work),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(SessionQuotaExceededError);
      expect(error).toMatchObject({
        quota: "practice",
        statusCode: 429,
        retryAfterSeconds: expect.any(Number),
      });
      return true;
    });

    expect(repository.lockBucket).toHaveBeenCalledWith(
      fakeTx,
      USER_ID,
      "practice",
    );
    expect(work).not.toHaveBeenCalled();
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("calls work(tx) then insert on success and returns the work result", async () => {
    mockWindows({ practice: [quotaEvent(new Date()), quotaEvent(new Date())] });
    const callOrder: string[] = [];
    vi.mocked(repository.insert).mockImplementation(async () => {
      callOrder.push("insert");
    });
    const work = vi.fn(async (tx) => {
      callOrder.push("work");
      expect(tx).toBe(fakeTx);
      return { id: "session-1" };
    });

    const result = await service.runWithSlot(USER_ID, "practice", work);

    expect(result).toEqual({ id: "session-1" });
    expect(work).toHaveBeenCalledOnce();
    expect(repository.insert).toHaveBeenCalledWith(
      fakeTx,
      USER_ID,
      "practice",
    );
    expect(callOrder).toEqual(["work", "insert"]);
  });

  it("treats MAX=0 as exhausted: remaining 0 and runWithSlot always throws", async () => {
    service = new SessionQuotaService(repository, {
      practiceMax: 0,
      studyMax: 3,
      windowMs: WINDOW_MS,
    });
    mockWindows({ practice: [], study: [] });

    const snapshot = await service.getSnapshot(USER_ID);

    expect(snapshot.practice).toMatchObject({
      used: 0,
      limit: 0,
      remaining: 0,
    });
    expect(snapshot.practice.retryAfterSeconds).toBe(
      Math.max(1, Math.ceil(WINDOW_MS / 1000)),
    );

    const work = vi.fn(async () => ({ id: "blocked" }));

    await expect(
      service.runWithSlot(USER_ID, "practice", work),
    ).rejects.toBeInstanceOf(SessionQuotaExceededError);
    expect(work).not.toHaveBeenCalled();
    expect(repository.insert).not.toHaveBeenCalled();
  });
});
