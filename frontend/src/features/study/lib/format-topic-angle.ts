export function formatTopicAngleLabel(
  topic: string,
  angle?: string | null,
): string {
  const trimmedAngle = angle?.trim();
  if (!trimmedAngle) {
    return topic;
  }
  return `${topic} — ${trimmedAngle}`;
}
