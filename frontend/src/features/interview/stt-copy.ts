import type { InterviewLocale } from "@/features/interview-locale/use-interview-locale";

export type SttCopy = {
  record: string;
  stop: string;
  transcribe: string;
  discard: string;
  tooShort: string;
  permissionDenied: string;
  transcribing: string;
  success: string;
  genericError: string;
  rateLimited: string;
  unsupported: string;
  cancel: string;
  timeout: string;
  noSpeechDetected: string;
};

const sttCopy: Record<InterviewLocale, SttCopy> = {
  en: {
    record: "Record",
    stop: "Stop",
    transcribe: "Transcribe",
    discard: "Discard",
    tooShort: "Recording is too short. Please try again.",
    permissionDenied: "Microphone permission was denied.",
    transcribing: "Transcribing…",
    success: "Transcription complete.",
    genericError: "We couldn't transcribe your recording. Please try again.",
    rateLimited: "Too many transcription requests. Please try again later.",
    unsupported: "Your browser doesn't support audio recording.",
    cancel: "Cancel",
    timeout: "Transcription timed out. Please try again.",
    noSpeechDetected: "No speech detected in the recording. Please try again.",
  },
  pt: {
    record: "Gravar",
    stop: "Parar",
    transcribe: "Transcrever",
    discard: "Descartar",
    tooShort: "A gravação é muito curta. Tente novamente.",
    permissionDenied: "A permissão do microfone foi negada.",
    transcribing: "Transcrevendo…",
    success: "Transcrição concluída.",
    genericError: "Não foi possível transcrever a gravação. Tente novamente.",
    rateLimited: "Muitas solicitações de transcrição. Tente novamente mais tarde.",
    unsupported: "Seu navegador não oferece suporte à gravação de áudio.",
    cancel: "Cancelar",
    timeout: "A transcrição demorou demais. Tente novamente.",
    noSpeechDetected: "Nenhuma fala detectada na gravação. Tente novamente.",
  },
};

export function getSttCopy(locale: InterviewLocale | "en" | "pt"): SttCopy {
  return sttCopy[locale];
}
