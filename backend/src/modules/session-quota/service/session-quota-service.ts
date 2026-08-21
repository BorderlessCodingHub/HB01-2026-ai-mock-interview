import prisma from "@/infrastructure/database";
import type { SessionQuotaRepository } from "@/modules/session-quota/repository/session-quota-repository";
import { SessionQuotaExceededError } from "@/shared";
import type {
  Prisma,
  SessionQuotaEvent,
  SessionQuotaKind,
} from "../../../../prisma/generated/client";

export type SessionQuotaServiceConfig = {
  practiceMax: number;
  studyMax: number;
  windowMs: number;
};

export type QuotaBucket = {
  used: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number | null;
};

export type SessionQuotaSnapshot = {
  practice: QuotaBucket;
  study: QuotaBucket;
};

export class SessionQuotaService {
  constructor(
    private readonly repository: SessionQuotaRepository,
    private readonly config: SessionQuotaServiceConfig,
  ) {}

  async getSnapshot(userId: number): Promise<SessionQuotaSnapshot> {
    return prisma.$transaction(async (tx) => {
      const now = Date.now();
      const windowStart = new Date(now - this.config.windowMs);

      const practiceEvents = await this.repository.listInWindow(
        tx,
        userId,
        "practice",
        windowStart,
      );
      const studyEvents = await this.repository.listInWindow(
        tx,
        userId,
        "study",
        windowStart,
      );

      return {
        practice: this.toBucket(practiceEvents, this.config.practiceMax, now),
        study: this.toBucket(studyEvents, this.config.studyMax, now),
      };
    });
  }

  async runWithSlot<T>(
    userId: number,
    kind: SessionQuotaKind,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      const now = Date.now();
      const windowStart = new Date(now - this.config.windowMs);
      const max = this.maxFor(kind);

      await this.repository.lockBucket(tx, userId, kind);
      const events = await this.repository.listInWindow(
        tx,
        userId,
        kind,
        windowStart,
      );

      if (events.length >= max) {
        throw new SessionQuotaExceededError({
          quota: kind,
          retryAfterSeconds: this.retryAfterSeconds(events, now),
        });
      }

      const result = await work(tx);
      await this.repository.insert(tx, userId, kind);
      return result;
    });
  }

  private maxFor(kind: SessionQuotaKind): number {
    return kind === "practice"
      ? this.config.practiceMax
      : this.config.studyMax;
  }

  private toBucket(
    events: SessionQuotaEvent[],
    limit: number,
    now: number,
  ): QuotaBucket {
    const used = events.length;
    const remaining = Math.max(0, limit - used);

    return {
      used,
      limit,
      remaining,
      retryAfterSeconds:
        remaining > 0 ? null : this.retryAfterSeconds(events, now),
    };
  }

  private retryAfterSeconds(events: SessionQuotaEvent[], now: number): number {
    const oldest = events[0];
    if (!oldest) {
      return Math.max(1, Math.ceil(this.config.windowMs / 1000));
    }

    return Math.max(
      1,
      Math.ceil(
        (oldest.createdAt.getTime() + this.config.windowMs - now) / 1000,
      ),
    );
  }
}
