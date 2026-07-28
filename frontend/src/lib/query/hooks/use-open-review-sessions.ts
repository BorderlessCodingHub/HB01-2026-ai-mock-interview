"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/session-provider";
import { reviewSessionsApi } from "@/lib/api/review-sessions";
import type { ReviewSessionSummary } from "@/types/review-sessions";

import { queryKeys } from "../keys";

const OPEN_STATUS = "in_progress,pending_review";

function sortByCreatedAtDesc(
  sessions: ReviewSessionSummary[],
): ReviewSessionSummary[] {
  return [...sessions].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export function useOpenReviewSessions() {
  const { fetchWithAuth, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.reviewSessionsList("open"),
    queryFn: async () => {
      const response = await fetchWithAuth((token) =>
        reviewSessionsApi.list(token, {
          status: OPEN_STATUS,
          page: 1,
          limit: 10,
        }),
      );

      return {
        ...response,
        sessions: sortByCreatedAtDesc(response.sessions),
      };
    },
    enabled: isAuthenticated,
  });
}
