import type {
  Prisma,
  SessionQuotaEvent,
  SessionQuotaKind,
} from "../../../../prisma/generated/client";

const KIND_LOCK_CODE = { practice: 1, study: 2 } as const;

export class SessionQuotaRepository {
  async lockBucket(
    tx: Prisma.TransactionClient,
    userId: number,
    kind: SessionQuotaKind,
  ): Promise<void> {
    const kindCode = KIND_LOCK_CODE[kind];
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${kindCode}::int, ${userId}::int)`;
  }

  async listInWindow(
    tx: Prisma.TransactionClient,
    userId: number,
    kind: SessionQuotaKind,
    windowStart: Date,
  ): Promise<SessionQuotaEvent[]> {
    return tx.sessionQuotaEvent.findMany({
      where: { userId, kind, createdAt: { gt: windowStart } },
      orderBy: { createdAt: "asc" },
    });
  }

  async insert(
    tx: Prisma.TransactionClient,
    userId: number,
    kind: SessionQuotaKind,
  ): Promise<void> {
    await tx.sessionQuotaEvent.create({ data: { userId, kind } });
  }
}
