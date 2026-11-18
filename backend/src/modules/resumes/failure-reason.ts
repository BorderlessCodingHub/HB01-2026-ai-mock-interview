import { TokenLimitExceededError } from "@/shared";

export const RESUME_FAILURE_REASONS = [
  "quota_exceeded",
  "storage_failed",
  "queue_unavailable",
  "unreadable_file",
  "extraction_failed",
  "unknown",
] as const;
export type ResumeFailureReason = (typeof RESUME_FAILURE_REASONS)[number];

// The reason is stored as a "[reason] " prefix on Resume.errorMessage so it can
// be surfaced to the client without a schema migration or leaking the raw error.
const REASON_PREFIX_PATTERN = /^\[([a-z_]+)\] /;

// Messages stored before reasons were prefixed.
const LEGACY_FAILURE_REASONS: Record<string, ResumeFailureReason> = {
  "Failed to upload resume to storage": "storage_failed",
  "Failed to enqueue resume processing": "queue_unavailable",
  [new TokenLimitExceededError().message]: "quota_exceeded",
  "Resume contains no extractable text": "unreadable_file",
  "Failed to convert TeX resume": "unreadable_file",
};

function isResumeFailureReason(value: string): value is ResumeFailureReason {
  return (RESUME_FAILURE_REASONS as readonly string[]).includes(value);
}

export function formatResumeFailure(
  reason: ResumeFailureReason,
  message: string,
): string {
  return `[${reason}] ${message}`;
}

export function resolveResumeFailureReason(
  errorMessage: string | null,
): ResumeFailureReason {
  if (!errorMessage) {
    return "unknown";
  }

  const prefix = REASON_PREFIX_PATTERN.exec(errorMessage)?.[1];
  if (prefix !== undefined && isResumeFailureReason(prefix)) {
    return prefix;
  }

  return LEGACY_FAILURE_REASONS[errorMessage] ?? "unknown";
}
