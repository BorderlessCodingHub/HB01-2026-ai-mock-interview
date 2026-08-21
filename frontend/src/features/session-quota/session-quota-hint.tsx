"use client";

import type { QuotaBucket } from "@/types/session-quota";

import { formatRetryAfter } from "./format-retry-after";

type SessionQuotaHintProps = {
  bucket?: QuotaBucket | null;
  isError?: boolean;
  isLoading?: boolean;
  dataUpdatedAt?: number;
};

export function SessionQuotaHint({
  bucket,
  isError,
  isLoading,
  dataUpdatedAt,
}: SessionQuotaHintProps) {
  if (isError || isLoading || !bucket) {
    return null;
  }

  if (bucket.remaining > 0) {
    return (
      <p className="text-xs text-text-base">
        {`${bucket.remaining} of ${bucket.limit} sessions remaining`}
      </p>
    );
  }

  const elapsedSeconds =
    dataUpdatedAt != null
      ? Math.max(
          0,
          Math.floor(
            // eslint-disable-next-line react-hooks/purity -- elapsed vs last GET; T14 refetches
            (Date.now() - dataUpdatedAt) / 1000,
          ),
        )
      : 0;
  const effectiveSeconds = Math.max(
    0,
    (bucket.retryAfterSeconds ?? 0) - elapsedSeconds,
  );
  const displaySeconds = Math.max(1, effectiveSeconds);

  return (
    <p className="text-xs text-text-base">
      {`Next session in ${formatRetryAfter(displaySeconds)}`}
    </p>
  );
}
