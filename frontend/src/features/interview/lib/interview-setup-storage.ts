import type { InterviewLevel } from "@/types/interview";

const LEVEL_KEY = "hone:interview-level";

const VALID_LEVELS: InterviewLevel[] = ["entry", "mid", "senior"];

export function getStoredInterviewLevel(): InterviewLevel | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = localStorage.getItem(LEVEL_KEY);
  return VALID_LEVELS.includes(value as InterviewLevel)
    ? (value as InterviewLevel)
    : null;
}

export function setStoredInterviewLevel(level: InterviewLevel): void {
  localStorage.setItem(LEVEL_KEY, level);
}
