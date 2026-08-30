export function isLastReviewAnswer(meta: {
  itemIndex: number;
  totalItems: number;
  turnsCompleted: number;
  questionsPerItem: number;
}): boolean {
  return (
    meta.itemIndex === meta.totalItems - 1 &&
    meta.turnsCompleted + 1 === meta.questionsPerItem
  );
}
