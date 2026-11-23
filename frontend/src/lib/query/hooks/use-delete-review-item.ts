"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/session-provider";
import { reviewItemsApi } from "@/lib/api/review-items";

import {
  cancelReviewItemsQueries,
  optimisticRemoveReviewItem,
  restoreReviewItems,
  type ReviewItemsSnapshots,
} from "../optimistic-review-items";
import { getErrorMessage } from "@/components/app/app-error-state";

export function useDeleteReviewItem() {
  const queryClient = useQueryClient();
  const { fetchWithAuth } = useAuth();

  return useMutation({
    mutationFn: (itemId: string) =>
      fetchWithAuth((token) => reviewItemsApi.delete(token, itemId)),
    onMutate: async (
      itemId,
    ): Promise<{ previous: ReviewItemsSnapshots }> => {
      await cancelReviewItemsQueries(queryClient);
      const previous = optimisticRemoveReviewItem(queryClient, itemId);
      return { previous };
    },
    onError: (err, _itemId, context) => {
      if (context?.previous) {
        restoreReviewItems(queryClient, context.previous);
      }
      toast.error(
        getErrorMessage(err, "Failed to delete topic"),
      );
    },
    onSuccess: () => {
      toast.success("Topic deleted");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["review-items"] });
    },
  });
}
