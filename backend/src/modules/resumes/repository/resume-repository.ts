import type { Resume as PrismaResume } from "../../../../prisma/generated/client";
import { ResumeStatus as PrismaResumeStatus } from "../../../../prisma/generated/client";
import prisma from "@/infrastructure/database";
import type {
  ResumeRecord,
  ResumeSourceFormat,
  ResumeStatus,
} from "@/modules/resumes/types/resume-record";
import { structuredSummarySchema } from "@/modules/resumes/validations/resume-schemas";

function toResumeStatus(status: PrismaResume["status"]): ResumeStatus {
  return status as ResumeStatus;
}

function toResumeSourceFormat(
  sourceFormat: PrismaResume["sourceFormat"],
): ResumeSourceFormat {
  return sourceFormat as ResumeSourceFormat;
}

function toResumeRecord(row: PrismaResume): ResumeRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    status: toResumeStatus(row.status),
    storageKey: row.storageKey,
    sourceFormat: toResumeSourceFormat(row.sourceFormat),
    structuredSummary: row.structuredSummary,
    rawText: row.rawText,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
  };
}

export class ResumeRepository {
  async createProcessing(
    userId: number,
    name: string,
    storageKey: string,
    sourceFormat: ResumeSourceFormat,
    id?: string,
  ): Promise<ResumeRecord> {
    const row = await prisma.resume.create({
      data: {
        ...(id !== undefined ? { id } : {}),
        userId,
        name,
        storageKey,
        sourceFormat,
        status: PrismaResumeStatus.processing,
      },
    });
    return toResumeRecord(row);
  }

  async updateReady(
    id: string,
    structuredSummary: unknown,
    rawText: string,
  ): Promise<ResumeRecord> {
    const parsed = structuredSummarySchema.parse(structuredSummary);

    const row = await prisma.resume.update({
      where: { id },
      data: {
        structuredSummary: parsed,
        rawText,
        status: PrismaResumeStatus.ready,
        errorMessage: null,
      },
    });
    return toResumeRecord(row);
  }

  async updateFailed(id: string, errorMessage: string): Promise<ResumeRecord> {
    const row = await prisma.resume.update({
      where: { id },
      data: {
        status: PrismaResumeStatus.failed,
        errorMessage,
      },
    });
    return toResumeRecord(row);
  }

  async findById(id: string): Promise<ResumeRecord | null> {
    const row = await prisma.resume.findUnique({
      where: { id },
    });
    return row ? toResumeRecord(row) : null;
  }

  async findByIdAndUserId(
    id: string,
    userId: number,
  ): Promise<ResumeRecord | null> {
    const row = await prisma.resume.findFirst({
      where: { id, userId },
    });
    return row ? toResumeRecord(row) : null;
  }

  async findAllByUserId(userId: number): Promise<ResumeRecord[]> {
    const rows = await prisma.resume.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toResumeRecord);
  }

  async deleteByIdAndUserId(
    id: string,
    userId: number,
  ): Promise<ResumeRecord | null> {
    const row = await prisma.resume.findFirst({
      where: { id, userId },
    });
    if (!row) return null;

    await prisma.resume.delete({
      where: { id },
    });
    return toResumeRecord(row);
  }
}
