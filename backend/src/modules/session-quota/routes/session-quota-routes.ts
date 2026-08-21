import { asyncHandler } from "@/shared";
import type { Router } from "express";

import { makeSessionQuotaController } from "@/factories/session-quota/session-quota-controller-factory";

export default function sessionQuotaRoutes(router: Router): void {
  const controller = makeSessionQuotaController();

  router.get("/", asyncHandler(controller.getQuota));
}
