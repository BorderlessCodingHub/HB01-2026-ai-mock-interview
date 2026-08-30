import { createUsageCaptureCallback } from "@/modules/token-usage/callbacks/token-usage-callback";
import type { TokenUsageService } from "@/modules/token-usage/service/token-usage-service";
import type { IWeakAnswersGenerator } from "@/modules/interview/protocols/weak-answers-generator";
import type { MessageRepository } from "@/modules/interview/repository/message-repository";
import type { SessionRepository } from "@/modules/interview/repository/session-repository";
import type { WeakAnswerService } from "@/modules/interview/service/weak-answer-service";
import type { ResumeRepository } from "@/modules/resumes/repository/resume-repository";
import type { StructuredSummary } from "@/modules/resumes/validations/resume-schemas";

export type WeakAnswerGenerationResult =
  | { status: "ready"; sessionId: string }
  | { status: "skipped"; sessionId: string; reason: string };

export class WeakAnswerGenerationService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly messageRepository: MessageRepository,
    private readonly resumeRepository: ResumeRepository,
    private readonly weakAnswersGenerator: IWeakAnswersGenerator,
    private readonly weakAnswerService: WeakAnswerService,
    private readonly tokenUsageService: TokenUsageService,
  ) {}

  async process(sessionId: string): Promise<WeakAnswerGenerationResult> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      return { status: "skipped", sessionId, reason: "not_found" };
    }

    if (!session.isFinished) {
      return { status: "skipped", sessionId, reason: "not_finished" };
    }

    await this.tokenUsageService.assertWithinLimit(session.userId);

    const messages = await this.messageRepository.listBySessionId(sessionId);
    const transcript = messages
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");

    if (!session.resumeId) {
      return { status: "skipped", sessionId, reason: "resume_not_found" };
    }

    const resume = await this.resumeRepository.findById(session.resumeId);
    if (!resume?.structuredSummary) {
      return { status: "skipped", sessionId, reason: "resume_not_found" };
    }

    const structuredSummary = resume.structuredSummary as StructuredSummary;
    const usageCapture = createUsageCaptureCallback();
    const weakAnswers = await this.weakAnswersGenerator.generate(
      {
        userId: session.userId,
        sessionId,
        transcript,
        structuredSummary,
        jobDescription: session.jobDescription,
      },
      { callbacks: [usageCapture.callback] },
    );

    await this.tokenUsageService.recordUsage(
      session.userId,
      usageCapture.getUsage(),
    );

    await this.weakAnswerService.saveWeakAnswers(
      session.userId,
      sessionId,
      weakAnswers.items,
    );

    return { status: "ready", sessionId };
  }
}
