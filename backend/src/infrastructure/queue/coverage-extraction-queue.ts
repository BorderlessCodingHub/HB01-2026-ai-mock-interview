import { Queue } from "bullmq";

import { redisConnection } from "./resume-queue";

export type CoverageExtractionJobData = {
  sessionId: string;
};

export const COVERAGE_EXTRACTION_QUEUE_NAME = "coverage-extraction";
const COVERAGE_EXTRACTION_JOB_NAME = "extract";

const connection = redisConnection;

const coverageExtractionQueue = new Queue<
  CoverageExtractionJobData,
  void,
  typeof COVERAGE_EXTRACTION_JOB_NAME
>(COVERAGE_EXTRACTION_QUEUE_NAME, { connection });

export async function add({
  sessionId,
}: {
  sessionId: string;
}): Promise<void> {
  await coverageExtractionQueue.add(
    COVERAGE_EXTRACTION_JOB_NAME,
    { sessionId },
    {
      jobId: sessionId,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
}
