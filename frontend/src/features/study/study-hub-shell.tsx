"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/client";
import { useReviewSession } from "@/lib/query/hooks/use-review-session";

import { StudyHistorySidebar } from "./study-history-sidebar";
import { StudyHubContent } from "./study-hub-content";
import { StudySessionTranscript } from "./study-session-transcript";

function MainPanelLoading({ label }: { label: string }) {
  return (
    <div
      className="flex flex-1 items-center justify-center gap-2 bg-paper-white p-8"
      role="status"
    >
      <Loader2 className="h-5 w-5 animate-spin text-jade-deep" />
      <span className="text-sm text-text-base">{label}</span>
    </div>
  );
}

export function StudyHubShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const sessionQuery = useReviewSession(sessionId ?? undefined);
  const session = sessionQuery.data;
  const isNotFound =
    sessionQuery.error instanceof ApiError && sessionQuery.error.status === 404;

  useEffect(() => {
    if (!sessionId || !isNotFound) {
      return;
    }

    toast.error("Review session not found");
    router.replace("/study");
  }, [isNotFound, router, sessionId]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (session.status === "in_progress") {
      router.replace(`/review-session/${session.id}`);
      return;
    }

    if (session.status === "pending_review") {
      router.replace(`/review-session/${session.id}/report`);
    }
  }, [router, session]);

  function handleSelectSession(id: string) {
    router.push(`/study?sessionId=${id}`);
  }

  function handleBackToHub() {
    router.push("/study");
  }

  const isRedirecting =
    session?.status === "in_progress" || session?.status === "pending_review";

  const showTranscript =
    Boolean(sessionId) &&
    !isNotFound &&
    !isRedirecting &&
    (session?.status === "completed" ||
      (Boolean(sessionQuery.error) && !sessionQuery.isLoading));

  const showSessionLoading =
    Boolean(sessionId) &&
    !isNotFound &&
    !showTranscript &&
    (sessionQuery.isLoading || isRedirecting || !sessionQuery.isFetched);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
      <aside className="flex max-h-[48%] w-full shrink-0 flex-col overflow-hidden border-b border-border-hairline bg-fog-white md:h-full md:max-h-none md:w-80 md:border-r md:border-b-0">
        <StudyHistorySidebar
          activeSessionId={showTranscript ? sessionId : null}
          onSelectSession={handleSelectSession}
        />
      </aside>

      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper-white">
        {showSessionLoading ? (
          <MainPanelLoading
            label={isRedirecting ? "Opening session…" : "Loading session…"}
          />
        ) : showTranscript && sessionId ? (
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4">
            <StudySessionTranscript
              sessionId={sessionId}
              onBack={handleBackToHub}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8">
            <StudyHubContent />
          </div>
        )}
      </section>
    </div>
  );
}
