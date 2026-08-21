import type { SessionQuotaResponse } from "@/types/session-quota";

import { apiRequest } from "./client";

export const sessionQuotaApi = {
  get(token: string) {
    return apiRequest<SessionQuotaResponse>("/api/session-quota", { token });
  },
};
