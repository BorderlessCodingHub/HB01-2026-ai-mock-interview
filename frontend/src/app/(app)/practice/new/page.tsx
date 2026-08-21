"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/features/dashboard/app-shell";
import { useAuth } from "@/features/auth/session-provider";
import { getStoredResumeId } from "@/features/auth/session-storage";
import { useInterviewLocale } from "@/features/interview-locale/use-interview-locale";
import {
  getStoredInterviewLevel,
  setStoredInterviewLevel,
} from "@/features/interview/lib/interview-setup-storage";
import { SessionQuotaHint } from "@/features/session-quota/session-quota-hint";
import { interviewApi } from "@/lib/api/interview";
import { useResume } from "@/lib/query/hooks/use-resume";
import { useSessionQuota } from "@/lib/query/hooks/use-session-quota";
import { ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import type { CreateSessionInput, InterviewLevel } from "@/types/interview";
import {
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_TURNS_BY_LEVEL,
  MIN_INTERVIEW_TURNS,
} from "@/types/interview";
import { AppCard } from "@/components/app/app-card";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { AppPageHeader } from "@/components/app/app-page-header";

const LEVELS: { value: InterviewLevel; label: string; description: string }[] =
  [
    { value: "entry", label: "Entry", description: "5 turns" },
    { value: "mid", label: "Mid", description: "7 turns" },
    { value: "senior", label: "Senior", description: "8 turns" },
  ];

function turnOptions(level: InterviewLevel): number[] {
  const max = MAX_TURNS_BY_LEVEL[level];
  const options: number[] = [];
  for (let n = MIN_INTERVIEW_TURNS; n <= max; n++) {
    options.push(n);
  }
  return options;
}

function NewSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resumeId") ?? getStoredResumeId() ?? "";
  const { fetchWithAuth } = useAuth();
  const { locale } = useInterviewLocale();
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<InterviewLevel>(
    () => getStoredInterviewLevel() ?? "mid",
  );
  const [turns, setTurns] = useState<number>(() => MAX_TURNS_BY_LEVEL[level]);
  const [jobDescription, setJobDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resumeQuery = useResume(resumeId || null);
  const {
    data: quota,
    isError: isQuotaError,
    isLoading: isQuotaLoading,
    isSuccess: isQuotaSuccess,
    dataUpdatedAt: quotaUpdatedAt,
  } = useSessionQuota();
  const quotaExhausted = isQuotaSuccess && quota?.practice.remaining === 0;

  function handleLevelChange(nextLevel: InterviewLevel) {
    setLevel(nextLevel);
    setStoredInterviewLevel(nextLevel);
    setTurns(MAX_TURNS_BY_LEVEL[nextLevel]);
  }

  async function handleStart() {
    if (!resumeId) {
      toast.error("Missing resume. Upload a PDF first.");
      router.push("/practice");
      return;
    }
    if (resumeQuery.data?.status !== "ready") {
      toast.error("Resume is not ready yet.");
      return;
    }

    const trimmedJobDescription = jobDescription.trim();
    if (trimmedJobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
      toast.error(
        `Job description must be at most ${MAX_JOB_DESCRIPTION_LENGTH} characters.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const body: CreateSessionInput = {
        resumeId,
        level,
        interviewLocale: locale,
        turns,
      };
      if (trimmedJobDescription) {
        body.jobDescription = trimmedJobDescription;
      }

      const { id } = await fetchWithAuth((token) =>
        interviewApi.createSession(body, token),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessionQuota });
      router.push(`/interview/${id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to create session",
      );
      if (err instanceof ApiError && err.status === 429) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sessionQuota });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!resumeId) {
    return (
      <AppEmptyState
        headingLevel={1}
        title="No resume selected"
        description="Choose or upload a resume before starting an interview."
        action={
          <a
            href="/practice"
            className="inline-flex rounded-full bg-jade-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
          >
            Choose a resume
          </a>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <AppPageHeader
        title="Choose interview level"
        description={
          resumeQuery.data ? (
            <>
              Resume: {resumeQuery.data.name}
              {resumeQuery.data.status !== "ready" &&
                ` (${resumeQuery.data.status})`}
            </>
          ) : undefined
        }
      />

      {resumeQuery.error && (
        <p
          className="rounded-2xl bg-(--status-critical-surface) px-4 py-3 text-sm text-text-base"
          role="alert"
        >
          {resumeQuery.error instanceof Error
            ? resumeQuery.error.message
            : "Failed to load the selected resume"}
        </p>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-black">
          Difficulty
        </legend>
        <AppCard variant="mist" className="space-y-2 p-5">
          {LEVELS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleLevelChange(opt.value)}
              aria-pressed={level === opt.value}
              className={cn(
                "flex min-h-11 w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
                level === opt.value
                  ? "border-jade bg-jade-pale"
                  : "border-border-hairline bg-paper-white hover:bg-fog-white",
              )}
            >
              <span className="font-medium text-ink-black">{opt.label}</span>
              <span className="text-xs text-text-base">{opt.description}</span>
            </button>
          ))}
        </AppCard>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-black">
          Number of turns
        </legend>
        <AppCard variant="mist" className="flex flex-wrap gap-2 p-5">
          {turnOptions(level).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTurns(option)}
              aria-pressed={turns === option}
              className={cn(
                "min-h-11 min-w-11 cursor-pointer rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
                turns === option
                  ? "border-jade bg-jade-pale text-jade-deep"
                  : "border-border-hairline bg-paper-white text-ink-black hover:bg-fog-white",
              )}
            >
              {option}
            </button>
          ))}
        </AppCard>
      </fieldset>

      <div className="space-y-1.5">
        <label
          htmlFor="job-description"
          className="text-sm font-medium text-ink-black"
        >
          Job description (optional)
        </label>
        <textarea
          id="job-description"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste a job posting to tailor questions to a specific role…"
          rows={5}
          maxLength={MAX_JOB_DESCRIPTION_LENGTH}
          className="w-full resize-y rounded-2xl border border-border-hairline bg-paper-white px-4 py-3 text-sm text-ink-black placeholder:text-text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
        />
        <p className="text-right text-xs text-text-base">
          {jobDescription.length}/{MAX_JOB_DESCRIPTION_LENGTH}
        </p>
      </div>

      <SessionQuotaHint
        bucket={quota?.practice}
        isError={isQuotaError}
        isLoading={isQuotaLoading}
        dataUpdatedAt={quotaUpdatedAt}
      />
      <button
        type="button"
        onClick={handleStart}
        disabled={
          isSubmitting ||
          resumeQuery.isLoading ||
          Boolean(resumeQuery.error) ||
          resumeQuery.data?.status !== "ready" ||
          quotaExhausted
        }
        className="w-full rounded-full bg-jade-deep py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-black disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
      >
        {isSubmitting ? "Starting…" : "Start interview"}
      </button>
    </div>
  );
}

export default function NewSessionPage() {
  return (
    <AppShell>
      <Suspense fallback={<p className="text-sm text-text-base">Loading…</p>}>
        <NewSessionContent />
      </Suspense>
    </AppShell>
  );
}
