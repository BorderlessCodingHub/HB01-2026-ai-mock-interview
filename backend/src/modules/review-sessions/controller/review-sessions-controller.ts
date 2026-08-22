import type { ReviewSessionStreamService } from "@/modules/review-sessions/service/review-session-stream-service";
import type { ReviewSessionsService } from "@/modules/review-sessions/service/review-sessions-service";
import type {
  ApplyReviewSessionInput,
  CreateReviewSessionInput,
  ReviewSessionStreamBodyInput,
} from "@/modules/review-sessions/validations/review-session-schemas";
import { listReviewSessionsQuerySchema } from "@/modules/review-sessions/validations/review-session-schemas";
import type { Request, Response } from "express";
import { z } from "zod";

export class ReviewSessionsController {
  constructor(
    private readonly reviewSessionsService: ReviewSessionsService,
    private readonly reviewSessionStreamService: ReviewSessionStreamService,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const queryResult = listReviewSessionsQuerySchema.safeParse(req.query);

    if (!queryResult.success) {
      res.status(422).json({
        message: "Validation failed",
        errors: z.treeifyError(queryResult.error),
      });
      return;
    }

    const { status, page, limit } = queryResult.data;
    const result = await this.reviewSessionsService.list(req.userId!, {
      statuses: status,
      page,
      limit,
    });
    res.status(200).json(result);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateReviewSessionInput;
    const result = await this.reviewSessionsService.create(req.userId!, body);
    res.status(201).json(result);
  };

  stream = async (req: Request, res: Response): Promise<void> => {
    const sessionId = String(req.params.id);
    const { answer, interviewLocale } = req.body as ReviewSessionStreamBodyInput;

    await this.reviewSessionStreamService.streamTurn(
      req.userId!,
      sessionId,
      { answer, interviewLocale },
      res,
    );
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const sessionId = String(req.params.id);
    const result = await this.reviewSessionsService.getById(
      req.userId!,
      sessionId,
    );
    res.status(200).json(result);
  };

  apply = async (req: Request, res: Response): Promise<void> => {
    const sessionId = String(req.params.id);
    const { items } = req.body as ApplyReviewSessionInput;
    const result = await this.reviewSessionsService.apply(
      req.userId!,
      sessionId,
      items,
    );
    res.status(200).json(result);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const sessionId = String(req.params.id);
    await this.reviewSessionsService.delete(req.userId!, sessionId);
    res.status(204).send();
  };
}
