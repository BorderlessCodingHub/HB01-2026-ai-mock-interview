import type { SessionService } from "@/modules/interview/service/session-service";
import type { FeedbackService } from "@/modules/interview/service/feedback-service";
import type { ReviewGenerationService } from "@/modules/interview/service/review-generation-service";
import type { InterviewStreamService } from "@/modules/interview/service/stream-service";
import {
  listSessionsQuerySchema,
  type CreateSessionInput,
  type StreamMessageInput,
  type SubmitFeedbackInput,
} from "@/modules/interview/validations/interview-schemas";
import type { Request, Response } from "express";
import { z } from "zod";

export class InterviewController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly streamService: InterviewStreamService,
    private readonly feedbackService: FeedbackService,
    private readonly reviewGenerationService: ReviewGenerationService,
  ) {}

  createSession = async (req: Request, res: Response): Promise<void> => {
    const result = await this.sessionService.createSession(
      req.userId!,
      req.body as CreateSessionInput,
    );
    res.status(201).json(result);
  };

  listSessions = async (req: Request, res: Response): Promise<void> => {
    const queryResult = listSessionsQuerySchema.safeParse(req.query);

    if (!queryResult.success) {
      res.status(422).json({
        message: "Validation failed",
        errors: z.treeifyError(queryResult.error),
      });
      return;
    }

    const { page, limit } = queryResult.data;
    const result = await this.sessionService.listSessions(req.userId!, {
      page,
      limit,
    });
    res.status(200).json(result);
  };

  getSession = async (req: Request, res: Response): Promise<void> => {
    const session = await this.sessionService.getSession(
      req.userId!,
      String(req.params.sessionId),
    );
    res.status(200).json(session);
  };

  stream = async (req: Request, res: Response): Promise<void> => {
    const sessionId = String(req.params.sessionId);
    const { content, interviewLocale } = req.body as StreamMessageInput;

    await this.streamService.streamTurn(
      req.userId!,
      sessionId,
      { content, interviewLocale },
      res,
    );
  };

  getMessages = async (req: Request, res: Response): Promise<void> => {
    const sessionId = String(req.params.sessionId);
    const messages = await this.sessionService.getMessages(
      req.userId!,
      sessionId,
    );
    res.status(200).json({ messages });
  };

  deleteSession = async (req: Request, res: Response): Promise<void> => {
    const sessionId = String(req.params.sessionId);
    await this.sessionService.deleteSession(req.userId!, sessionId);
    res.status(204).send();
  };

  submitFeedback = async (req: Request, res: Response): Promise<void> => {
    const sessionId = String(req.params.sessionId);
    const feedback = await this.feedbackService.submit(
      req.userId!,
      sessionId,
      req.body as SubmitFeedbackInput,
    );
    res.status(201).json(feedback);
  };

  retryReviewGeneration = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const session = await this.reviewGenerationService.retry(
      req.userId!,
      String(req.params.sessionId),
    );
    res.status(200).json(session);
  };
}
