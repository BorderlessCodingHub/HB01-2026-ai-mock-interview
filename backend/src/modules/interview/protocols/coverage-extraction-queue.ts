export interface ICoverageExtractionQueue {
  add(params: { sessionId: string }): Promise<void>;
}
