"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Plus,
  Loader2,
  AlertCircle,
  Dumbbell,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Trash2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppShell } from "@/features/dashboard/app-shell";
import { useAuth } from "@/features/auth/session-provider";
import { InterviewLocaleSelector } from "@/features/interview-locale/interview-locale-selector";
import { useInterviewLocale } from "@/features/interview-locale/use-interview-locale";
import { useResumes } from "@/lib/query/hooks/use-resumes";
import { useSessionsInfinite } from "@/lib/query/hooks/use-sessions-infinite";
import { useSessionQuota } from "@/lib/query/hooks/use-session-quota";
import { useDeleteSession } from "@/lib/query/hooks/use-delete-session";
import { interviewApi } from "@/lib/api/interview";
import { ApiError } from "@/lib/api/client";
import { InterviewChat } from "@/features/interview/interview-chat";
import { SessionQuotaHint } from "@/features/session-quota/session-quota-hint";
import { toDisplayTurns } from "@/features/interview/lib/display-turns";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import type { CreateSessionInput, InterviewLevel } from "@/types/interview";
import {
  MAX_INTERVIEW_TURNS,
  MAX_JOB_DESCRIPTION_LENGTH,
  MIN_INTERVIEW_TURNS,
} from "@/types/interview";
import {
  getStoredResumeId,
  setStoredResumeId,
} from "@/features/auth/session-storage";
import {
  getStoredInterviewLevel,
  setStoredInterviewLevel,
} from "@/features/interview/lib/interview-setup-storage";
import { AppEmptyState } from "@/components/app/app-empty-state";

const LEVELS: { value: InterviewLevel; label: string }[] = [
  { value: "entry", label: "Entry Level" },
  { value: "mid", label: "Mid Level" },
  { value: "senior", label: "Senior Level" },
];

function PracticeContent() {
  const { getAccessToken } = useAuth();
  const { locale } = useInterviewLocale();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeResumeId, setActiveResumeId] = useState<string | null>(() =>
    getStoredResumeId(),
  );
  const [level, setLevel] = useState<InterviewLevel>(
    () => getStoredInterviewLevel() ?? "mid",
  );
  const [turns, setTurns] = useState<number>(10);

  function handleLevelChange(nextLevel: InterviewLevel) {
    setLevel(nextLevel);
    setStoredInterviewLevel(nextLevel);
  }

  function handleIncreaseTurns() {
    setTurns((t) => Math.min(MAX_INTERVIEW_TURNS, t + 1));
  }

  function handleDecreaseTurns() {
    setTurns((t) => Math.max(MIN_INTERVIEW_TURNS, t - 1));
  }
  const [jobDescription, setJobDescription] = useState("");
  const [showJobDescription, setShowJobDescription] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionPendingDelete, setSessionPendingDelete] = useState<
    string | null
  >(null);
  const deleteSession = useDeleteSession();

  const {
    data: resumesData,
    isLoading: isLoadingResumes,
    error: resumesError,
  } = useResumes();
  const resumes = resumesData?.resumes ?? [];
  const readyResumes = resumes.filter((r) => r.status === "ready");

  const {
    sessions,
    isLoading: isLoadingSessions,
    error: sessionsError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useSessionsInfinite();

  const {
    data: quota,
    isError: isQuotaError,
    isLoading: isQuotaLoading,
    isSuccess: isQuotaSuccess,
    dataUpdatedAt: quotaUpdatedAt,
  } = useSessionQuota();
  const quotaExhausted = isQuotaSuccess && quota?.practice.remaining === 0;

  const querySessionId = searchParams.get("sessionId");

  const resolvedResumeId = useMemo(() => {
    if (readyResumes.length === 0) {
      return activeResumeId;
    }

    if (activeResumeId && readyResumes.some((r) => r.id === activeResumeId)) {
      return activeResumeId;
    }

    const stored = getStoredResumeId();
    if (stored && readyResumes.some((r) => r.id === stored)) {
      return stored;
    }

    return readyResumes[0]?.id ?? null;
  }, [activeResumeId, readyResumes]);

  const resolvedSessionId = useMemo(() => {
    if (querySessionId) {
      return querySessionId;
    }

    if (activeSessionId) {
      return activeSessionId;
    }

    return sessions[0]?.id ?? null;
  }, [activeSessionId, querySessionId, sessions]);

  async function handleStartNewInterview() {
    if (!resolvedResumeId) {
      toast.error("Please upload and select a CV first.");
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    const trimmedJobDescription = jobDescription.trim();
    if (trimmedJobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
      toast.error(
        `Job description must be at most ${MAX_JOB_DESCRIPTION_LENGTH} characters.`,
      );
      return;
    }

    setIsCreatingSession(true);
    try {
      const body: CreateSessionInput = {
        resumeId: resolvedResumeId,
        level,
        interviewLocale: locale,
        turns,
      };
      if (trimmedJobDescription) {
        body.jobDescription = trimmedJobDescription;
      }

      const { id } = await interviewApi.createSession(body, token);

      toast.success("New interview session created!");

      // Invalidate query to refresh list
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessionQuota });

      // Select the new session
      setActiveSessionId(id);
      router.push(`/practice?sessionId=${id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to create interview session",
      );
      if (err instanceof ApiError && err.status === 429) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sessionQuota });
      }
      console.error(err);
    } finally {
      setIsCreatingSession(false);
    }
  }

  function handleSelectSession(id: string) {
    setActiveSessionId(id);
    router.push(`/practice?sessionId=${id}`);
  }

  async function handleLoadMore() {
    const result = await fetchNextPage();
    if (result.isError) {
      toast.error(
        result.error instanceof Error
          ? result.error.message
          : "Failed to load more sessions",
      );
    }
  }

  function handleConfirmDelete() {
    if (!sessionPendingDelete) return;
    const id = sessionPendingDelete;
    setSessionPendingDelete(null);

    deleteSession.mutate(id, {
      onSuccess: () => {
        if (resolvedSessionId === id) {
          setActiveSessionId(null);
          router.push("/practice");
        }
      },
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
      {/* Lateral Panel */}
      <aside className="flex max-h-[48%] w-full shrink-0 flex-col overflow-y-auto border-b border-border-hairline bg-fog-white md:h-full md:max-h-none md:w-80 md:border-r md:border-b-0">
        <div className="shrink-0 space-y-4 border-b border-border-hairline p-4">
          <div className="flex items-center gap-2 text-ink-black">
            <Dumbbell className="h-5 w-5" />
            <h1 className="text-sm font-semibold">Practice panel</h1>
          </div>

          {/* Active CV Selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="practice-resume"
              className="text-xs font-semibold text-text-base"
            >
              Active CV
            </label>
            {isLoadingResumes ? (
              <div className="flex items-center gap-2 py-2 text-xs text-text-base">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading CVs…
              </div>
            ) : resumesError ? (
              <p
                className="rounded-2xl bg-(--status-critical-surface) p-3 text-xs text-text-base"
                role="alert"
              >
                {resumesError instanceof Error
                  ? resumesError.message
                  : "Failed to load CVs"}
              </p>
            ) : readyResumes.length === 0 ? (
              <div className="flex items-start gap-2 rounded-2xl bg-jade-pale p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-jade-deep" />
                <div className="text-[11px] font-medium text-jade-deep">
                  No ready CV found.{" "}
                  <Link
                    href="/resumes"
                    className="cursor-pointer rounded-sm font-bold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
                  >
                    Upload one
                  </Link>{" "}
                  first to practice.
                </div>
              </div>
            ) : (
              <select
                id="practice-resume"
                value={resolvedResumeId ?? ""}
                onChange={(e) => {
                  setStoredResumeId(e.target.value);
                  setActiveResumeId(e.target.value);
                }}
                className="w-full cursor-pointer rounded-2xl border border-border-hairline bg-paper-white px-3 py-2 text-sm font-medium text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
              >
                {readyResumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <InterviewLocaleSelector />

          {/* Choose level */}
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-semibold text-text-base">
              Difficulty Level
            </legend>
            <div className="grid grid-cols-3 gap-1">
              {LEVELS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleLevelChange(opt.value)}
                  aria-pressed={level === opt.value}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center rounded-2xl border px-1 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
                    level === opt.value
                      ? "border-jade bg-jade-pale font-semibold text-jade-deep"
                      : "border-border-hairline bg-paper-white text-ink-black hover:bg-mist-gray",
                  )}
                >
                  <span className="text-xs">{opt.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Choose turns */}
          <div className="space-y-1.5">
            <span
              id="practice-turns-label"
              className="text-xs font-semibold text-text-base"
            >
              Number of turns
            </span>
            <div
              role="group"
              aria-labelledby="practice-turns-label"
              className="flex items-center justify-between rounded-2xl border border-border-hairline bg-paper-white px-3 py-1.5"
            >
              <span className="text-sm font-medium text-ink-black">
                {turns} turns
              </span>
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label="Increase number of turns"
                  disabled={turns >= MAX_INTERVIEW_TURNS}
                  onClick={handleIncreaseTurns}
                  className="cursor-pointer text-text-base transition-colors hover:text-jade-deep disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Decrease number of turns"
                  disabled={turns <= MIN_INTERVIEW_TURNS}
                  onClick={handleDecreaseTurns}
                  className="cursor-pointer text-text-base transition-colors hover:text-jade-deep disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Optional job description */}
          <div className="space-y-1.5">
            <button
              id="practice-job-description-label"
              type="button"
              onClick={() => setShowJobDescription((open) => !open)}
              aria-expanded={showJobDescription}
              aria-controls="practice-job-description"
              className="flex min-h-11 w-full cursor-pointer items-center justify-between text-xs font-semibold text-text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
            >
              <span>Job description (optional)</span>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  showJobDescription && "rotate-90",
                )}
              />
            </button>
            {showJobDescription && (
              <div className="space-y-1">
                <textarea
                  id="practice-job-description"
                  aria-labelledby="practice-job-description-label"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste a job posting to tailor questions to a specific role…"
                  rows={4}
                  maxLength={MAX_JOB_DESCRIPTION_LENGTH}
                  className="w-full resize-y rounded-2xl border border-border-hairline bg-paper-white px-3 py-2 text-xs text-ink-black placeholder:text-text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
                />
                <p className="text-right text-[10px] text-text-base">
                  {jobDescription.length}/{MAX_JOB_DESCRIPTION_LENGTH}
                </p>
              </div>
            )}
          </div>

          {/* Start New Session CTA */}
          <SessionQuotaHint
            bucket={quota?.practice}
            isError={isQuotaError}
            isLoading={isQuotaLoading}
            dataUpdatedAt={quotaUpdatedAt}
          />
          <button
            type="button"
            disabled={
              isCreatingSession ||
              Boolean(resumesError) ||
              readyResumes.length === 0 ||
              quotaExhausted
            }
            onClick={handleStartNewInterview}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-jade-deep px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-black disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
          >
            {isCreatingSession ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Start New Practice
          </button>
        </div>

        {/* Sessions History */}
        <div className="flex flex-none flex-col">
          <div className="flex items-center gap-2 border-b border-border-hairline bg-mist-gray p-3">
            <Clock className="h-3.5 w-3.5 text-text-base" />
            <span className="text-xs font-semibold text-text-base">
              Previous Conversations
            </span>
          </div>

          <div className="divide-y divide-border-hairline">
            {isLoadingSessions ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-text-base">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading sessions…
              </div>
            ) : sessionsError ? (
              <p
                className="px-4 py-8 text-center text-xs text-(--status-critical-foreground)"
                role="alert"
              >
                {sessionsError instanceof Error
                  ? sessionsError.message
                  : "Failed to load previous sessions"}
              </p>
            ) : sessions.length === 0 ? (
              <AppEmptyState
                compact
                headingLevel={2}
                title="No previous sessions"
                description="Start a new practice above to build your history."
              />
            ) : (
              sessions.map((sess) => {
                const isActive = resolvedSessionId === sess.id;
                const resumeObj = resumes.find((r) => r.id === sess.resumeId);
                const resumeName = resumeObj ? resumeObj.name : "Resume";
                const display = toDisplayTurns(sess.turnCount, sess.maxTurns);

                return (
                  <div
                    key={sess.id}
                    className={cn(
                      "group flex items-stretch transition-colors hover:bg-mist-gray",
                      isActive && "bg-jade-pale",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectSession(sess.id)}
                      className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-jade"
                    >
                      <div className="flex justify-between items-start gap-2 min-w-0">
                        <span className="flex-1 truncate text-xs font-semibold text-ink-black">
                          {resumeName}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            sess.isFinished
                              ? "bg-(--status-neutral-surface) text-(--status-neutral-foreground)"
                              : "bg-jade-pale text-jade-deep",
                          )}
                        >
                          {sess.isFinished ? "Finished" : "Active"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-base">
                        <span className="capitalize font-medium">
                          {`${sess.level} level · ${display.turnCount}/${display.maxTurns} turns`}
                        </span>
                        <span>
                          {new Date(sess.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label="Delete conversation"
                      onClick={() => setSessionPendingDelete(sess.id)}
                      className="flex w-10 shrink-0 cursor-pointer items-center justify-center text-text-base transition-colors hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-jade"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {hasNextPage && !isLoadingSessions && !sessionsError && sessions.length > 0 ? (
            <div className="p-3">
              <button
                type="button"
                disabled={isFetchingNextPage}
                onClick={() => void handleLoadMore()}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border-hairline bg-paper-white px-4 py-2 text-xs font-semibold text-ink-black transition-colors hover:bg-mist-gray disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <AlertDialog
        open={sessionPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setSessionPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the interview session and its
              messages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Expanded Chat Pane */}
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper-white">
        {sessionsError ? (
          <div className="flex flex-1 items-center justify-center bg-paper-white p-8">
            <p
              className="max-w-md text-center text-sm text-(--status-critical-foreground)"
              role="alert"
            >
              Session data could not be loaded. Interview chat is unavailable.
            </p>
          </div>
        ) : resolvedSessionId ? (
          <div className="flex-1 flex flex-col h-full p-4 overflow-hidden">
            <InterviewChat
              key={resolvedSessionId}
              sessionId={resolvedSessionId}
            />
          </div>
        ) : resumesError ? (
          <div className="flex flex-1 items-center justify-center bg-paper-white p-8">
            <p
              className="max-w-md text-center text-sm text-(--status-critical-foreground)"
              role="alert"
            >
              Resume data could not be loaded. Starting a new interview is
              unavailable.
            </p>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-paper-white p-8">
            <AppEmptyState
              icon={<MessageSquare className="h-6 w-6" />}
              title="AI mock interview"
              description="Improve your system design and coding communication skills with a real-time AI interviewer."
              action={
                <div className="flex flex-col items-center gap-3">
                  <p className="max-w-md text-xs leading-5 text-text-base">
                    {readyResumes.length === 0
                      ? "Upload your resume PDF first to start practicing."
                      : "Select a previous conversation from history or start a new practice in the sidebar panel to begin."}
                  </p>
                  {readyResumes.length === 0 && (
                    <Link
                      href="/resumes"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-jade-deep px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
                    >
                      Go to Resumes
                    </Link>
                  )}
                </div>
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}

export default function PracticePage() {
  return (
    <AppShell noPadding={true}>
      <Suspense
        fallback={
          <div className="flex h-dvh items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-jade-deep" />
            <span className="text-sm text-text-base">Loading Practice…</span>
          </div>
        }
      >
        <PracticeContent />
      </Suspense>
    </AppShell>
  );
}
