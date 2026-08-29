export const RESUME_STATUSES = ["processing", "ready", "failed"] as const;
export type ResumeStatus = (typeof RESUME_STATUSES)[number];

export const RESUME_STATUS = {
  processing: "processing",
  ready: "ready",
  failed: "failed",
} as const satisfies Record<string, ResumeStatus>;

export const RESUME_SOURCE_FORMATS = ["pdf", "tex"] as const;
export type ResumeSourceFormat = (typeof RESUME_SOURCE_FORMATS)[number];

export type ResumeRecord = {
  id: string;
  userId: number;
  name: string;
  status: ResumeStatus;
  storageKey: string;
  sourceFormat: ResumeSourceFormat;
  structuredSummary: unknown | null;
  rawText: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};
