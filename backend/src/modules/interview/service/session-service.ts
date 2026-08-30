import type { MessageRepository } from "@/modules/interview/repository/message-repository";
import type { SessionRepository } from "@/modules/interview/repository/session-repository";
import { sanitizeJobDescription } from "@/modules/interview/security/sanitize-job-description";
import type {
  CreateSessionInput,
  InterviewLevel,
} from "@/modules/interview/validations/interview-schemas";
import type { ResumeRepository } from "@/modules/resumes/repository/resume-repository";
import type { SessionQuotaService } from "@/modules/session-quota/service/session-quota-service";
import { BadRequestError, NotFoundError } from "@/shared";
import type { InterviewSession } from "../../../../prisma/generated/client";

export type SessionSummary = {
  id: string;
  resumeId: string | null;
  level: InterviewLevel;
  turnCount: number;
  maxTurns: number;
  isFinished: boolean;
  hasJobDescription: boolean;
  createdAt: Date;
  reviewGenerationStatus: "idle" | "pending" | "ready" | "failed";
  reviewGenerationError: string | null;
};

export type SessionMessage = {
  id: string;
  role: "human" | "ai";
  content: string;
  createdAt: Date;
};

export type ListSessionsResult = {
  sessions: SessionSummary[];
  page: number;
  limit: number;
  hasMore: boolean;
};

export type ListMessagesResult = {
  messages: SessionMessage[];
  hasMore: boolean;
};

export class SessionService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly messageRepository: MessageRepository,
    private readonly resumeRepository: ResumeRepository,
    private readonly sessionQuotaService: SessionQuotaService,
  ) {}

  async createSession(
    userId: number,
    input: CreateSessionInput,
  ): Promise<{ id: string }> {
    const resume = await this.resumeRepository.findByIdAndUserId(
      input.resumeId,
      userId,
    );

    if (!resume) {
      throw new NotFoundError();
    }

    if (resume.status !== "ready") {
      const message =
        resume.status === "processing"
          ? "Resume is still being processed"
          : resume.status === "failed"
            ? "Resume processing failed"
            : "Resume is not ready for interview";
      throw new BadRequestError(message);
    }

    const session = await this.sessionQuotaService.runWithSlot(
      userId,
      "practice",
      (tx) =>
        this.sessionRepository.create(
          {
            userId,
            resumeId: input.resumeId,
            level: input.level,
            interviewLocale: input.interviewLocale,
            jobDescription: input.jobDescription
              ? sanitizeJobDescription(input.jobDescription)
              : null,
            maxTurns: input.turns + 1,
          },
          tx,
        ),
    );

    return { id: session.id };
  }

  async listSessions(
    userId: number,
    params: { page: number; limit: number },
  ): Promise<ListSessionsResult> {
    const { page, limit } = params;
    const skip = (page - 1) * limit;
    const rows = await this.sessionRepository.listByUserId(userId, {
      skip,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const sessions = rows.slice(0, limit).map((session) => this.toSummary(session));

    return { sessions, page, limit, hasMore };
  }

  async getSession(userId: number, sessionId: string): Promise<SessionSummary> {
    const session = await this.sessionRepository.findByIdAndUserId(
      sessionId,
      userId,
    );
    if (!session) throw new NotFoundError();
    return this.toSummary(session);
  }

  async getMessages(
    userId: number,
    sessionId: string,
    options: { limit: number; before?: string },
  ): Promise<ListMessagesResult> {
    const session = await this.sessionRepository.findByIdAndUserId(
      sessionId,
      userId,
    );

    if (!session) {
      throw new NotFoundError();
    }

    const rows = await this.messageRepository.listPageBySessionId(sessionId, {
      limit: options.limit + 1,
      beforeMessageId: options.before,
    });

    const hasMore = rows.length > options.limit;
    const page = hasMore ? rows.slice(0, options.limit) : rows;

    const messages = page.reverse().map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    }));

    return { messages, hasMore };
  }

  async deleteSession(userId: number, sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findByIdAndUserId(
      sessionId,
      userId,
    );

    if (!session) {
      throw new NotFoundError();
    }

    await this.sessionRepository.deleteByIdAndUserId(sessionId, userId);
  }

  private toSummary(session: InterviewSession): SessionSummary {
    return {
      id: session.id,
      resumeId: session.resumeId,
      level: session.level,
      turnCount: session.turnCount,
      maxTurns: session.maxTurns,
      isFinished: session.isFinished,
      hasJobDescription: session.jobDescription != null,
      createdAt: session.createdAt,
      reviewGenerationStatus: session.reviewGenerationStatus,
      reviewGenerationError: session.reviewGenerationError,
    };
  }
}
