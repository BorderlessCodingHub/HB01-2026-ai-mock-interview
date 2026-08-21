"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/session-provider";
import { sessionQuotaApi } from "@/lib/api/session-quota";

import { queryKeys } from "../keys";

export function useSessionQuota() {
  const { fetchWithAuth, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.sessionQuota,
    queryFn: () => fetchWithAuth((token) => sessionQuotaApi.get(token)),
    enabled: isAuthenticated,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      if (data.practice.remaining === 0 || data.study.remaining === 0)
        return 60_000;
      return false;
    },
  });
}
