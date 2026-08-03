"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/session-provider";
import { ApiError } from "@/lib/api/client";
import { reviewItemsApi } from "@/lib/api/review-items";
import type { ReviewItemStatus } from "@/types/review-items";

import {
  cancelReviewItemsQueries,
  optimisticUpdateReviewItemStatus,
  restoreReviewItems,
  type ReviewItemsSnapshots,
} from "../optimistic-review-items";

type UpdateReviewItemStatusVars = {
  itemId: string;
  status: ReviewItemStatus;
};

export function useUpdateReviewItemStatus() {
  const queryClient = useQueryClient();
  const { fetchWithAuth } = useAuth();

  return useMutation({
    mutationFn: ({ itemId, status }: UpdateReviewItemStatusVars) =>
      fetchWithAuth((token) =>
        reviewItemsApi.patchStatus(token, itemId, status),
      ),
    onMutate: async ({
      itemId,
      status,
    }): Promise<{ previous: ReviewItemsSnapshots }> => {
      await cancelReviewItemsQueries(queryClient);
      const previous = optimisticUpdateReviewItemStatus(
        queryClient,
        itemId,
        status,
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) {
        restoreReviewItems(queryClient, context.previous);
      }
      toast.error(
        err instanceof ApiError
          ? err.message
          : vars.status === "learned"
            ? "Failed to mark topic as learned"
            : "Failed to reactivate topic",
      );
    },
    onSuccess: (_data, vars) => {
      toast.success(
        vars.status === "learned"
          ? "Topic marked as learned"
          : "Topic reactivated",
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["review-items"] });
    },
  });
}
