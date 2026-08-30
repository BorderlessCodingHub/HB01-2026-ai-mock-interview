import type { ReviewPriority } from "@/modules/interview/validations/interview-schemas";
import type { ReviewItemStatus } from "../../../../prisma/generated/client";

export type ReviewItemRecord = {
  id: string;
  userId: number;
  sessionId: string | null;
  topic: string;
  angle: string;
  description: string;
  priority: ReviewPriority;
  status: ReviewItemStatus;
  learnedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
