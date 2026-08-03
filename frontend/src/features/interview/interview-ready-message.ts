import type { InterviewLocale } from "@/types/interview";

const READY_MESSAGE: Record<InterviewLocale, string> = {
  en: "Hi, I'm ready for the interview!",
  pt: "Olá, estou pronto para a entrevista!",
};

const WELCOME_TEXT: Record<InterviewLocale, string> = {
  en: "When you're ready, click to start the interview.",
  pt: "Quando estiver pronto, clique para iniciar a entrevista.",
};

export function getInterviewReadyMessage(locale: InterviewLocale): string {
  return READY_MESSAGE[locale];
}

export function getInterviewWelcomeText(locale: InterviewLocale): string {
  return WELCOME_TEXT[locale];
}
