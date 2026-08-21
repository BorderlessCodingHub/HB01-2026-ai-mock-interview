import { SessionQuotaController } from "@/modules/session-quota/controller/session-quota-controller";

import { makeSessionQuotaService } from "./session-quota-service-factory";

export function makeSessionQuotaController(): SessionQuotaController {
  return new SessionQuotaController(makeSessionQuotaService());
}
