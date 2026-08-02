"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/session-provider";
import { ApiError } from "@/lib/api/client";
import { deleteResume, type ResumePreview } from "@/lib/api/resumes";

import { queryKeys } from "../keys";

type ListResumesResponse = { resumes: ResumePreview[] };

export function useDeleteResume() {
  const queryClient = useQueryClient();
  const { fetchWithAuth } = useAuth();

  return useMutation({
    mutationFn: (resumeId: string) =>
      fetchWithAuth((token) => deleteResume(resumeId, token)),
    onMutate: async (resumeId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.resumes });
      const previous =
        queryClient.getQueryData<ListResumesResponse>(queryKeys.resumes);

      if (previous) {
        queryClient.setQueryData<ListResumesResponse>(queryKeys.resumes, {
          resumes: previous.resumes.filter((resume) => resume.id !== resumeId),
        });
      }

      return { previous };
    },
    onError: (err, _resumeId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.resumes, context.previous);
      }
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete resume",
      );
    },
    onSuccess: () => {
      toast.success("Resume deleted successfully");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.resumes });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      void queryClient.invalidateQueries({ queryKey: ["review-items"] });
    },
  });
}
