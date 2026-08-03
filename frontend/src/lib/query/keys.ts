import type { ReviewItemsStatusFilter } from "@/types/review-items";

export const queryKeys = {
  sessions: ["interview", "sessions"] as const,
  session: (sessionId: string) => ["interview", "sessions", sessionId] as const,
  sessionMessages: (sessionId: string) =>
    ["interview", "sessions", sessionId, "messages"] as const,
  reviewItems: (status: ReviewItemsStatusFilter = "active") =>
    ["review-items", status] as const,
  reviewSession: (sessionId: string) => ["review-sessions", sessionId] as const,
  reviewSessionsList: (filter: string) =>
    ["review-sessions", "list", filter] as const,
  resume: (id: string) => ["resumes", id] as const,
  resumes: ["resumes"] as const,
  weakAnswers: ["weak-answers"] as const,
};
