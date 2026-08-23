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
      orderBy: { createdAt: "asc" },
    });
  }

  /** Returns up to `limit` messages immediately before `beforeMessageId`, newest first. */
  async listPageBySessionId(
    sessionId: string,
    options: { limit: number; beforeMessageId?: string },
  ): Promise<InterviewMessage[]> {
    const { limit, beforeMessageId } = options;
    let cursorCreatedAt: Date | undefined;

    if (beforeMessageId) {
      const cursorMessage = await prisma.interviewMessage.findFirst({
        where: { id: beforeMessageId, sessionId },
        select: { createdAt: true },
      });
      cursorCreatedAt = cursorMessage?.createdAt;
    }

    return prisma.interviewMessage.findMany({
      where: {
        sessionId,
        ...(cursorCreatedAt ? { createdAt: { lt: cursorCreatedAt } } : {}),
      },
      orderBy: { createdAt: "desc" },
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
