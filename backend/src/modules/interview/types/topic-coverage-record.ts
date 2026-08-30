export type TopicCoverageRecord = {
  id: string;
  userId: number;
  sessionId: string | null;
  topic: string;
  angle: string;
  createdAt: Date;
};
