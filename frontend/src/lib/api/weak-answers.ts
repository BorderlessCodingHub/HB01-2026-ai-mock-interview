import type { ListWeakAnswersResponse } from "@/types/weak-answers";

import { apiRequest } from "./client";

export const weakAnswersApi = {
  list(token: string) {
    return apiRequest<ListWeakAnswersResponse>("/api/weak-answers", {
      token,
    });
  },

  delete(token: string, id: string) {
    return apiRequest<void>(`/api/weak-answers/${id}`, {
      method: "DELETE",
      token,
    });
  },
};
