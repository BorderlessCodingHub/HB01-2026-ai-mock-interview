import { env } from "@/config/env";
import { SessionQuotaRepository } from "@/modules/session-quota/repository/session-quota-repository";
import { SessionQuotaService } from "@/modules/session-quota/service/session-quota-service";

let sessionQuotaService: SessionQuotaService | undefined;

export function makeSessionQuotaService(): SessionQuotaService {
  if (!sessionQuotaService) {
    sessionQuotaService = new SessionQuotaService(new SessionQuotaRepository(), {
      practiceMax: env.SESSION_QUOTA_PRACTICE_MAX,
      studyMax: env.SESSION_QUOTA_STUDY_MAX,
      windowMs: env.SESSION_QUOTA_WINDOW_MS,
    });
  }

  return sessionQuotaService;
}
