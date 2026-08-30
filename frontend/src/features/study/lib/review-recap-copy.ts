import type { InterviewLocale } from "@/types/interview";

const REVIEW_RECAP_HEADINGS: Record<
  InterviewLocale,
  { wentWell: string; workOn: string }
> = {
  en: {
    wentWell: "What went well",
    workOn: "What to work on",
  },
  pt: {
    wentWell: "O que você fez bem",
    workOn: "O que precisa trabalhar",
  },
};

export function getReviewRecapHeadings(locale: InterviewLocale): {
  wentWell: string;
  workOn: string;
} {
  return REVIEW_RECAP_HEADINGS[locale];
}
