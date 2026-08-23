"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/session-provider";
import { interviewApi } from "@/lib/api/interview";

import { queryKeys } from "../keys";

export const SESSION_MESSAGES_PAGE_SIZE = 20;

export function useSessionMessages(sessionId: string) {
  const { fetchWithAuth, isAuthenticated } = useAuth();

  return useInfiniteQuery({
    queryKey: queryKeys.sessionMessages(sessionId),
    queryFn: ({ pageParam }) =>
      fetchWithAuth((token) =>
        interviewApi.getMessages(sessionId, token, {
          limit: SESSION_MESSAGES_PAGE_SIZE,
          before: pageParam,
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.messages[0]?.id : undefined,
    enabled: isAuthenticated && Boolean(sessionId),
  });
}
