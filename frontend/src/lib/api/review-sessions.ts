import { env } from "@/config/env";
import type {
  ApplyReviewSessionRequest,
  CreateReviewSessionInput,
  CreateReviewSessionResponse,
  ListReviewSessionsResponse,
  ReviewSession,
} from "@/types/review-sessions";

import { apiRequest } from "./client";

export const reviewSessionsApi = {
  create(token: string, body: CreateReviewSessionInput) {
    return apiRequest<CreateReviewSessionResponse>("/api/review-sessions", {
      method: "POST",
      body,
      token,
    });
  },

  list(
    token: string,
    params: { status: string; page?: number; limit?: number },
  ): Promise<ListReviewSessionsResponse> {
    const searchParams = new URLSearchParams({ status: params.status });
    if (params.page !== undefined) {
      searchParams.set("page", String(params.page));
    }
    if (params.limit !== undefined) {
      searchParams.set("limit", String(params.limit));
    }
    return apiRequest<ListReviewSessionsResponse>(
      `/api/review-sessions?${searchParams}`,
      { token },
    );
  },

  getById(token: string, sessionId: string) {
    return apiRequest<ReviewSession>(`/api/review-sessions/${sessionId}`, {
      token,
    });
  },

  apply(token: string, sessionId: string, body: ApplyReviewSessionRequest) {
    return apiRequest<ReviewSession>(
      `/api/review-sessions/${sessionId}/apply`,
      {
        method: "POST",
        body,
        token,
      },
    );
  },

  delete(token: string, sessionId: string) {
    return apiRequest<void>(`/api/review-sessions/${sessionId}`, {
      method: "DELETE",
      token,
    });
  },

  applyKeepalive(
    token: string,
    sessionId: string,
    body: ApplyReviewSessionRequest,
  ): void {
    void fetch(
      `${env.NEXT_PUBLIC_SERVER_URL}/api/review-sessions/${sessionId}/apply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        keepalive: true,
      },
    );
  },
};
