export type QuotaBucket = {
  used: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number | null;
};

export type SessionQuotaResponse = {
  practice: QuotaBucket;
  study: QuotaBucket;
};
