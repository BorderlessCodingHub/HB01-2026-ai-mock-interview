"use client";

import { useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { MobilePanelToggle } from "@/components/app/mobile-panel-toggle";
import { cn } from "@/lib/utils";
import { useDeleteReviewSession } from "@/lib/query/hooks/use-delete-review-session";
import { useReviewSessionsInfinite } from "@/lib/query/hooks/use-review-sessions-list";

import { StudyHistoryRow } from "./study-history-row";
import {
  AppErrorState,
  getErrorMessage,
} from "@/components/app/app-error-state";

type StudyHistorySidebarProps = {
  activeSessionId?: string | null;
  onSelectSession: (sessionId: string) => void;
};

export function StudyHistorySidebar({
  activeSessionId,
  onSelectSession,
}: StudyHistorySidebarProps) {
  const {
    sessions,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useReviewSessionsInfinite({ status: "completed", limit: 10 });
  const deleteReviewSession = useDeleteReviewSession();
  // Phones stack the history above the study hub; keep it collapsed until
  // asked for so the backlog stays the first thing on screen.
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLoadMore() {
    const result = await fetchNextPage();
    if (result.isError) {
      toast.error(
        getErrorMessage(result.error, "Failed to load more sessions"),
      );
    }
  }

  const showListError = isError && sessions.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-hairline bg-mist-gray p-3">
        <Clock className="h-3.5 w-3.5 text-text-base" />
        <span className="text-xs font-semibold text-text-base">
          Previous review sessions
        </span>
        <MobilePanelToggle
          open={mobileOpen}
          onToggle={() => setMobileOpen((open) => !open)}
          controls="study-history-list"
          label="previous review sessions"
        />
      </div>

      <div
        id="study-history-list"
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          !mobileOpen && "max-lg:hidden",
        )}
      >
        <div className="divide-y divide-border-hairline">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-text-base">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sessions…
            </div>
          ) : showListError ? (
            <AppErrorState
              variant="inline"
              title="Sessions didn't load"
              error={error}
              fallbackMessage="Failed to load previous sessions"
              onRetry={() => void refetch()}
              isRetrying={isFetching && !isFetchingNextPage}
              className="m-3"
            />
          ) : sessions.length === 0 ? (
            <AppEmptyState
              compact
              headingLevel={2}
              title="No previous review sessions"
              description="Complete a review session to build your history."
            />
          ) : (
            sessions.map((session) => (
              <StudyHistoryRow
                key={session.id}
                summary={session}
                isActive={activeSessionId === session.id}
                onSelect={() => {
                  setMobileOpen(false);
                  onSelectSession(session.id);
                }}
                onDelete={() => deleteReviewSession.mutate(session.id)}
              />
            ))
          )}
        </div>

        {hasNextPage && !isLoading && !showListError && sessions.length > 0 ? (
          <div className="p-3">
            <button
              type="button"
              disabled={isFetchingNextPage}
              onClick={() => void handleLoadMore()}
              className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border-hairline bg-paper-white px-4 py-2 text-xs font-semibold text-ink-black md:min-h-0 transition-colors hover:bg-mist-gray disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
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
    </div>
  );
}
