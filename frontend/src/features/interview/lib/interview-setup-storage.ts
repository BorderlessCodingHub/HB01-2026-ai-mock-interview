import {
  MAX_INTERVIEW_TURNS,
  MIN_INTERVIEW_TURNS,
  type InterviewLevel,
} from "@/types/interview";

const LEVEL_KEY = "hone:interview-level";
const TURNS_KEY = "hone:interview-turns";

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

export function getStoredInterviewTurns(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = localStorage.getItem(TURNS_KEY);
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_INTERVIEW_TURNS ||
    parsed > MAX_INTERVIEW_TURNS
  ) {
    return null;
  }

  return parsed;
}

export function setStoredInterviewTurns(turns: number): void {
  localStorage.setItem(TURNS_KEY, String(turns));
}
