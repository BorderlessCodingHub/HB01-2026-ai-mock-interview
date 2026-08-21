import type { SessionQuotaService } from "@/modules/session-quota/service/session-quota-service";
import type { Request, Response } from "express";

export class SessionQuotaController {
  constructor(private readonly sessionQuotaService: SessionQuotaService) {}

  getQuota = async (req: Request, res: Response): Promise<void> => {
    const result = await this.sessionQuotaService.getSnapshot(req.userId!);
    res.status(200).json(result);
  };
}
