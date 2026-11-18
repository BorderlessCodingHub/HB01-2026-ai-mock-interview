import type { ResumeFailureReason } from "@/lib/api/resumes";

const RESUME_FAILURE_MESSAGES: Record<ResumeFailureReason, string> = {
  quota_exceeded: "Monthly usage limit reached — resets next month.",
  storage_failed: "Couldn't store the file — please upload it again.",
  queue_unavailable:
    "Processing is temporarily unavailable — please upload it again.",
  unreadable_file: "Couldn't read this resume — try another format.",
  extraction_failed: "Couldn't analyze this resume — please try again.",
  unknown: "Something went wrong — please upload it again.",
};

export function getResumeFailureMessage(
  reason: ResumeFailureReason | undefined,
): string {
  // Fall back for reasons added server-side that this client doesn't know yet.
  return (
    (reason && RESUME_FAILURE_MESSAGES[reason]) ??
    RESUME_FAILURE_MESSAGES.unknown
  );
}
