import { makeSessionQuotaService } from "@/factories/session-quota/session-quota-service-factory";
import { MessageRepository } from "@/modules/interview/repository/message-repository";
import { SessionRepository } from "@/modules/interview/repository/session-repository";
import { SessionService } from "@/modules/interview/service/session-service";
import { ResumeRepository } from "@/modules/resumes/repository/resume-repository";

export function makeSessionService(): SessionService {
  return new SessionService(
    new SessionRepository(),
    new MessageRepository(),
    new ResumeRepository(),
    makeSessionQuotaService(),
  );
}
