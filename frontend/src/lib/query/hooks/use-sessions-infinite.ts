"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/session-provider";
import { interviewApi } from "@/lib/api/interview";

import { queryKeys } from "../keys";

export function useSessionsInfinite(limit = 10) {
  const { fetchWithAuth, isAuthenticated } = useAuth();

  const query = useInfiniteQuery({
    queryKey: queryKeys.sessionsList,
    queryFn: ({ pageParam }) =>
      fetchWithAuth((token) =>
        interviewApi.listSessions(token, { page: pageParam, limit }),
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
