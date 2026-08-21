import prisma from "@/infrastructure/database";
import { MAX_TURNS_BY_LEVEL } from "@/modules/interview/validations/interview-schemas";
import type { InterviewLocale } from "@/shared";
import type {
  InterviewLevel,
  InterviewSession,
  Prisma,
  PrismaClient,
} from "../../../../prisma/generated/client";

export { MAX_TURNS_BY_LEVEL };

export type CreateSessionParams = {
  userId: number;
  resumeId: string;
  level: InterviewLevel;
  interviewLocale: InterviewLocale;
  jobDescription?: string | null;
  /** Raw DB value (includes +1 for the automatic ready message). Defaults to MAX_TURNS_BY_LEVEL[level]. */
  maxTurns?: number;
};

export class SessionRepository {
  async create(
    params: CreateSessionParams,
    db: Prisma.TransactionClient | PrismaClient = prisma,
  ): Promise<InterviewSession> {
    const { userId, resumeId, level, interviewLocale, jobDescription } = params;
    return db.interviewSession.create({
      data: {
        userId,
        resumeId,
        level,
        jobDescription: jobDescription ?? null,
        interviewLocale,
        maxTurns: params.maxTurns ?? MAX_TURNS_BY_LEVEL[level],
      },
    });
  }

  async listByUserId(userId: number): Promise<InterviewSession[]> {
    return prisma.interviewSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string): Promise<InterviewSession | null> {
    return prisma.interviewSession.findUnique({
      where: { id },
    });
  }

  async findByIdAndUserId(
    id: string,
    userId: number,
  ): Promise<InterviewSession | null> {
    return prisma.interviewSession.findFirst({
      where: { id, userId },
    });
  }

  async incrementTurnCount(id: string): Promise<InterviewSession> {
    return prisma.interviewSession.update({
      where: { id },
      data: { turnCount: { increment: 1 } },
    });
  }

  async markFinished(
    id: string,
    interviewLocale: InterviewLocale,
  ): Promise<InterviewSession> {
    return prisma.interviewSession.update({
      where: { id },
      data: {
        isFinished: true,
        interviewLocale,
        reviewGenerationStatus: "pending",
        reviewGenerationError: null,
      },
    });
  }

  async markReviewGenerationFailed(
    id: string,
    error: string,
  ): Promise<InterviewSession> {
    return prisma.interviewSession.update({
      where: { id },
      data: {
        reviewGenerationStatus: "failed",
        reviewGenerationError: error,
      },
    });
  }

  async markReviewGenerationReady(id: string): Promise<InterviewSession> {
    return prisma.interviewSession.update({
      where: { id },
      data: {
        reviewGenerationStatus: "ready",
        reviewGenerationError: null,
      },
    });
  }

  async markReviewGenerationPending(id: string): Promise<InterviewSession> {
    return prisma.interviewSession.update({
      where: { id },
      data: {
        reviewGenerationStatus: "pending",
        reviewGenerationError: null,
      },
    });
  }

  async deleteByIdAndUserId(
    id: string,
    userId: number,
  ): Promise<InterviewSession | null> {
    const row = await prisma.interviewSession.findFirst({
      where: { id, userId },
    });
    if (!row) return null;

    await prisma.interviewSession.delete({
      where: { id },
    });
    return row;
  }
}
