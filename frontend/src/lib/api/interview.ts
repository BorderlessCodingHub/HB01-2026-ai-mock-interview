import type {
  CreateSessionInput,
  CreateSessionResponse,
  InterviewFeedback,
  ListMessagesResponse,
  ListSessionsResponse,
  SessionSummary,
  SubmitFeedbackInput,
} from "@/types/interview";

import { apiRequest } from "./client";

export const interviewApi = {
  createSession(body: CreateSessionInput, token: string) {
    return apiRequest<CreateSessionResponse>("/api/interview/sessions", {
      method: "POST",
      body,
      token,
    });
  },

  listSessions(
    token: string,
    params?: { page?: number; limit?: number },
  ) {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) {
      searchParams.set("page", String(params.page));
    }
    if (params?.limit !== undefined) {
      searchParams.set("limit", String(params.limit));
    }
    const query = searchParams.toString();

    return apiRequest<ListSessionsResponse>(
      `/api/interview/sessions${query ? `?${query}` : ""}`,
      { token },
    );
  },

  getSession(sessionId: string, token: string) {
    return apiRequest<SessionSummary>(
      `/api/interview/sessions/${sessionId}`,
      { token },
    );
  },

  getMessages(sessionId: string, token: string) {
    return apiRequest<ListMessagesResponse>(
      `/api/interview/sessions/${sessionId}/messages`,
      { token },
    );
  },

  deleteSession(sessionId: string, token: string) {
    return apiRequest<void>(`/api/interview/sessions/${sessionId}`, {
      method: "DELETE",
      token,
    });
  },

  retryReviewGeneration(sessionId: string, token: string) {
    return apiRequest<SessionSummary>(
      `/api/interview/sessions/${sessionId}/review-generation/retry`,
      { method: "POST", token },
    );
  },

  submitFeedback(
    sessionId: string,
    body: SubmitFeedbackInput,
    token: string,
  ) {
    const payload: SubmitFeedbackInput = { rating: body.rating };
    const trimmed = body.comment?.trim();
    if (trimmed) {
      payload.comment = trimmed;
    }

    return apiRequest<InterviewFeedback>(
      `/api/interview/sessions/${sessionId}/feedback`,
      { method: "POST", body: payload, token },
    );
  },
};
