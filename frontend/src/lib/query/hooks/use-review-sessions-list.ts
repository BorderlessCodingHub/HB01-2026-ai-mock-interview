"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/session-provider";
import { reviewSessionsApi } from "@/lib/api/review-sessions";

import { queryKeys } from "../keys";

type UseReviewSessionsInfiniteOptions = {
  status: "completed";
  limit?: number;
};

export function useReviewSessionsInfinite({
  status,
  limit = 10,
}: UseReviewSessionsInfiniteOptions) {
  const { fetchWithAuth, isAuthenticated } = useAuth();

  const query = useInfiniteQuery({
    queryKey: queryKeys.reviewSessionsList(status),
    queryFn: ({ pageParam }) =>
      fetchWithAuth((token) =>
        reviewSessionsApi.list(token, {
          status,
          page: pageParam,
          limit,
        }),
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: isAuthenticated,
  });

  const sessions = query.data?.pages.flatMap((page) => page.sessions) ?? [];

  return {
    ...query,
    sessions,
  };
}
