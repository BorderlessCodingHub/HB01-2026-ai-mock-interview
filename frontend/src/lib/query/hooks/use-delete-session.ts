"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/session-provider";
import { ApiError } from "@/lib/api/client";
import { interviewApi } from "@/lib/api/interview";
import type { ListSessionsResponse } from "@/types/interview";

import { queryKeys } from "../keys";

export function useDeleteSession() {
  const queryClient = useQueryClient();
  const { fetchWithAuth } = useAuth();

  return useMutation({
    mutationFn: (sessionId: string) =>
      fetchWithAuth((token) => interviewApi.deleteSession(sessionId, token)),
    onMutate: async (sessionId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.sessions });
      const previous =
        queryClient.getQueryData<ListSessionsResponse>(queryKeys.sessions);

      if (previous) {
        queryClient.setQueryData<ListSessionsResponse>(queryKeys.sessions, {
          sessions: previous.sessions.filter(
            (session) => session.id !== sessionId,
          ),
        });
      }

      return { previous };
    },
    onError: (err, _sessionId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.sessions, context.previous);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete session",
      );
    },
    onSuccess: () => {
      toast.success("Session deleted");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      void queryClient.invalidateQueries({ queryKey: ["review-items"] });
    },
  });
}
