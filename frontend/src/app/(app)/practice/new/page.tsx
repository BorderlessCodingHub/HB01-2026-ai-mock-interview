"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { AppShell } from "@/features/dashboard/app-shell";
import { useAuth } from "@/features/auth/session-provider";
import { getStoredResumeId } from "@/features/auth/session-storage";
import { useInterviewLocale } from "@/features/interview-locale/use-interview-locale";
import { interviewApi } from "@/lib/api/interview";
import { useResume } from "@/lib/query/hooks/use-resume";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { CreateSessionInput, InterviewLevel } from "@/types/interview";
import { MAX_JOB_DESCRIPTION_LENGTH } from "@/types/interview";
import { AppCard } from "@/components/app/app-card";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { AppPageHeader } from "@/components/app/app-page-header";
import Link from "next/link";

const LEVELS: { value: InterviewLevel; label: string; description: string }[] =
  [
    { value: "entry", label: "Entry", description: "5 turns" },
    { value: "mid", label: "Mid", description: "7 turns" },
    { value: "senior", label: "Senior", description: "8 turns" },
  ];

function NewSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resumeId") ?? getStoredResumeId() ?? "";
  const { fetchWithAuth } = useAuth();
  const { locale } = useInterviewLocale();
  const [level, setLevel] = useState<InterviewLevel>("mid");
  const [jobDescription, setJobDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resumeQuery = useResume(resumeId || null);

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
      };
      if (trimmedJobDescription) {
        body.jobDescription = trimmedJobDescription;
      }

      const { id } = await fetchWithAuth((token) =>
        interviewApi.createSession(body, token),
      );
      router.push(`/interview/${id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to create session",
      );
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
          <Link
            href="/practice"
            className="inline-flex rounded-full bg-jade-deep px-4 py-2 text-sm font-semibold text-white hover:bg-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
          >
            Choose a resume
          </Link>
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
              onClick={() => setLevel(opt.value)}
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

      <button
        type="button"
        onClick={handleStart}
        disabled={
          isSubmitting ||
          resumeQuery.isLoading ||
          Boolean(resumeQuery.error) ||
          resumeQuery.data?.status !== "ready"
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
