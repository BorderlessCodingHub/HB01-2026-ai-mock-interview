/**
 * Backend stores maxTurns as userTurns + 1 (automatic ready message).
 * Display progress in the turns the candidate actually answers.
 */
export function toDisplayTurns(turnCount: number, maxTurns: number) {
  return {
    turnCount: Math.max(0, turnCount - 1),
    maxTurns: Math.max(0, maxTurns - 1),
  };
}
