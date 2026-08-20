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

  listSessions(token: string) {
    return apiRequest<ListSessionsResponse>("/api/interview/sessions", {
      token,
    });
  },

  getSession(sessionId: string, token: string) {
    return apiRequest<SessionSummary>(
      `/api/interview/sessions/${sessionId}`,
      { token },
    );
  },

  getMessages(
    sessionId: string,
    token: string,
    params?: { limit?: number; before?: string },
  ) {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.before) query.set("before", params.before);
    const queryString = query.toString();

    return apiRequest<ListMessagesResponse>(
      `/api/interview/sessions/${sessionId}/messages${queryString ? `?${queryString}` : ""}`,
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
