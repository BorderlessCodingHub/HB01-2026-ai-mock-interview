"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/session-provider";
import { ApiError } from "@/lib/api/client";
import { weakAnswersApi } from "@/lib/api/weak-answers";

import { queryKeys } from "../keys";

export function useDeleteWeakAnswer() {
  const queryClient = useQueryClient();
  const { fetchWithAuth } = useAuth();

  return useMutation({
    mutationFn: (id: string) =>
      fetchWithAuth((token) => weakAnswersApi.delete(token, id)),
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete answer",
      );
    },
    onSuccess: () => {
      toast.success("Answer deleted");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.weakAnswers });
    },
  });
}
