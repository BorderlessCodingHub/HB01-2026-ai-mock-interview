"use client";

import { clearLastReviewSessionId } from "@/features/study/lib/review-session-storage";

import { useOpenReviewSessions } from "./use-open-review-sessions";

/**
 * Newest open review session for the resume banner.
 * Source of truth: API list (`in_progress` / `pending_review`).
 * sessionStorage is non-authoritative (clear remains for optional write-through).
 */
export function useOpenReviewSession() {
  const query = useOpenReviewSessions();

  const session = query.data?.sessions[0] ?? null;

  return {
    session,
    isLoading: query.isLoading,
    clear: clearLastReviewSessionId,
  };
}
