export type ReviewPriority = "low" | "medium" | "high";

export type ReviewItemStatus = "active" | "learned";

export type ReviewItem = {
  id: string;
  sessionId: string;
  topic: string;
  angle: string;
  description: string;
  priority: ReviewPriority;
  status: ReviewItemStatus;
  learnedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewItemsStatusFilter = "active" | "learned" | "all";

export type ListReviewItemsResponse = {
  reviewItems: ReviewItem[];
};
