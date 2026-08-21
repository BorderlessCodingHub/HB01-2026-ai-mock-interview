export function formatRetryAfter(seconds: number): string {
  const total = Math.max(0, seconds);
  let hours = Math.floor(total / 3600);
  let minutes = Math.ceil((total % 3600) / 60);

  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
