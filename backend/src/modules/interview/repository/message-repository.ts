import prisma from "@/infrastructure/database";
import {
  MessageRole,
  type InterviewMessage,
  type MessageRole as MessageRoleType,
} from "../../../../prisma/generated/client";

export type CreateMessageParams = {
  sessionId: string;
  userId: number;
  content: string;
};

export class MessageRepository {
  async createHuman(params: CreateMessageParams): Promise<InterviewMessage> {
    return this.create(MessageRole.human, params);
  }

  async createAi(params: CreateMessageParams): Promise<InterviewMessage> {
    return this.create(MessageRole.ai, params);
  }

  async listBySessionId(sessionId: string): Promise<InterviewMessage[]> {
    return prisma.interviewMessage.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  /** Returns up to `limit` messages immediately before `beforeMessageId`, newest first. */
  async listPageBySessionId(
    sessionId: string,
    options: { limit: number; beforeMessageId?: string },
  ): Promise<InterviewMessage[]> {
    const { limit, beforeMessageId } = options;
    const cursor = beforeMessageId
      ? await prisma.interviewMessage.findFirst({
          where: { id: beforeMessageId, sessionId },
          select: { id: true, createdAt: true },
        })
      : null;

    // Keyset on (createdAt, id): messages written in the same millisecond
    // share createdAt, so id breaks the tie instead of dropping them.
    return prisma.interviewMessage.findMany({
      where: {
        sessionId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });
  }

  private async create(
    role: MessageRoleType,
    params: CreateMessageParams,
  ): Promise<InterviewMessage> {
    const { sessionId, userId, content } = params;
    return prisma.interviewMessage.create({
      data: { sessionId, userId, role, content },
    });
  }
}
