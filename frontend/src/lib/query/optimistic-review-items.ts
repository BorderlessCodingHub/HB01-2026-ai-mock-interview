import type { QueryClient } from "@tanstack/react-query";

import type {
  ListReviewItemsResponse,
  ReviewItem,
  ReviewItemStatus,
  ReviewItemsStatusFilter,
} from "@/types/review-items";

import { queryKeys } from "./keys";

const STATUS_FILTERS: ReviewItemsStatusFilter[] = ["active", "learned", "all"];

export type ReviewItemsSnapshots = Partial<
  Record<ReviewItemsStatusFilter, ListReviewItemsResponse | undefined>
>;

export async function cancelReviewItemsQueries(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: ["review-items"] });
}

export function snapshotReviewItems(
  queryClient: QueryClient,
): ReviewItemsSnapshots {
  const snapshots: ReviewItemsSnapshots = {};
  for (const status of STATUS_FILTERS) {
    snapshots[status] = queryClient.getQueryData<ListReviewItemsResponse>(
      queryKeys.reviewItems(status),
    );
  }
  return snapshots;
}

export function restoreReviewItems(
  queryClient: QueryClient,
  snapshots: ReviewItemsSnapshots,
) {
  for (const status of STATUS_FILTERS) {
    if (Object.prototype.hasOwnProperty.call(snapshots, status)) {
      queryClient.setQueryData(
        queryKeys.reviewItems(status),
        snapshots[status],
      );
    }
  }
}

function findReviewItem(
  snapshots: ReviewItemsSnapshots,
  itemId: string,
): ReviewItem | undefined {
  for (const status of STATUS_FILTERS) {
    const item = snapshots[status]?.reviewItems.find((i) => i.id === itemId);
    if (item) return item;
  }
  return undefined;
}

export function optimisticUpdateReviewItemStatus(
  queryClient: QueryClient,
  itemId: string,
  nextStatus: ReviewItemStatus,
): ReviewItemsSnapshots {
  const snapshots = snapshotReviewItems(queryClient);
  const existing = findReviewItem(snapshots, itemId);
  if (!existing) return snapshots;

  const updated: ReviewItem = {
    ...existing,
    status: nextStatus,
    learnedAt: nextStatus === "learned" ? new Date().toISOString() : null,
  };

  for (const filter of STATUS_FILTERS) {
    const data = snapshots[filter];
    if (!data) continue;

    let nextItems: ReviewItem[];
    if (filter === "all") {
      nextItems = data.reviewItems.map((item) =>
        item.id === itemId ? updated : item,
      );
    } else if (filter === nextStatus) {
      const without = data.reviewItems.filter((item) => item.id !== itemId);
      nextItems = [...without, updated];
    } else {
      nextItems = data.reviewItems.filter((item) => item.id !== itemId);
    }

    queryClient.setQueryData(queryKeys.reviewItems(filter), {
      reviewItems: nextItems,
    });
  }

  return snapshots;
}

export function optimisticRemoveReviewItem(
  queryClient: QueryClient,
  itemId: string,
): ReviewItemsSnapshots {
  const snapshots = snapshotReviewItems(queryClient);

  for (const filter of STATUS_FILTERS) {
    const data = snapshots[filter];
    if (!data) continue;
    queryClient.setQueryData(queryKeys.reviewItems(filter), {
      reviewItems: data.reviewItems.filter((item) => item.id !== itemId),
    });
  }

  return snapshots;
}
