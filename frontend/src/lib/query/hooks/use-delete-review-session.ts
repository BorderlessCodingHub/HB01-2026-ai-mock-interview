"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/session-provider";
import { ApiError } from "@/lib/api/client";
import { reviewSessionsApi } from "@/lib/api/review-sessions";

export function useDeleteReviewSession() {
  const queryClient = useQueryClient();
  const { fetchWithAuth } = useAuth();

  return useMutation({
    mutationFn: (sessionId: string) =>
      fetchWithAuth((token) => reviewSessionsApi.delete(token, sessionId)),
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete session",
      );
    },
    onSuccess: () => {
      toast.success("Session deleted");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["review-sessions"] });
    },
  });
}
