"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/session-provider";
import { weakAnswersApi } from "@/lib/api/weak-answers";

import { queryKeys } from "../keys";

export function useWeakAnswers() {
  const { fetchWithAuth, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.weakAnswers,
    queryFn: () => fetchWithAuth((token) => weakAnswersApi.list(token)),
    enabled: isAuthenticated,
  });
}
