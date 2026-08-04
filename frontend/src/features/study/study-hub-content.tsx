"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, BookOpen, Loader2 } from "lucide-react";

import { useAuth } from "@/features/auth/session-provider";
import { InterviewLocaleSelector } from "@/features/interview-locale/interview-locale-selector";
import { useInterviewLocale } from "@/features/interview-locale/use-interview-locale";
import { StudyItemCard } from "@/features/study/study-item-card";
import { StudyResumeBanner } from "@/features/study/study-resume-banner";
import { StudySelectionBar } from "@/features/study/study-selection-bar";
import {
  getStudyPanelId,
  getStudyTabId,
  StudyTabs,
  type StudyTab,
} from "@/features/study/study-tabs";
import { WeakAnswerCard } from "@/features/study/weak-answer-card";
import { setLastReviewSessionId } from "@/features/study/lib/review-session-storage";
import { ApiError } from "@/lib/api/client";
import { reviewSessionsApi } from "@/lib/api/review-sessions";
import { useDeleteReviewItem } from "@/lib/query/hooks/use-delete-review-item";
import { useDeleteWeakAnswer } from "@/lib/query/hooks/use-delete-weak-answer";
import { useReviewItems } from "@/lib/query/hooks/use-review-items";
import { useUpdateReviewItemStatus } from "@/lib/query/hooks/use-update-review-item-status";
import { useWeakAnswers } from "@/lib/query/hooks/use-weak-answers";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { AppPageHeader } from "@/components/app/app-page-header";

const ALL_TABS: StudyTab[] = ["active", "learned", "insufficient"];

const MAX_SELECTION = 10;

function removeFromSelection(
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>,
  itemId: string,
) {
  setSelectedIds((prev) => {
    if (!prev.has(itemId)) return prev;
    const next = new Set(prev);
    next.delete(itemId);
    return next;
  });
}

export function StudyHubContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();
  const { locale } = useInterviewLocale();
  const updateStatus = useUpdateReviewItemStatus();
  const deleteReviewItem = useDeleteReviewItem();
  const deleteWeakAnswer = useDeleteWeakAnswer();

  const [activeTab, setActiveTab] = useState<StudyTab>("active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isStarting, setIsStarting] = useState(false);

  const reviewQuery = useReviewItems(
    activeTab === "learned" ? "learned" : "active",
  );
  const items = useMemo(
    () => reviewQuery.data?.reviewItems ?? [],
    [reviewQuery.data?.reviewItems],
  );

  const weakAnswersQuery = useWeakAnswers();
  const weakAnswers = useMemo(
    () => weakAnswersQuery.data?.weakAnswers ?? [],
    [weakAnswersQuery.data?.weakAnswers],
  );

  const visibleItemIds = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items],
  );

  const effectiveSelectedIds = useMemo(
    () => new Set([...selectedIds].filter((id) => visibleItemIds.has(id))),
    [selectedIds, visibleItemIds],
  );

  function handleTabChange(tab: StudyTab) {
    setActiveTab(tab);
    setSelectedIds(new Set());
  }

  function handleSelectToggle(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        return next;
      }
      if (next.size >= MAX_SELECTION) {
        toast.error("You can select at most 10 topics per session");
        return prev;
      }
      next.add(itemId);
      return next;
    });
  }

  function handleMarkLearned(itemId: string) {
    removeFromSelection(setSelectedIds, itemId);
    updateStatus.mutate({ itemId, status: "learned" });
  }

  function handleReactivate(itemId: string) {
    updateStatus.mutate({ itemId, status: "active" });
  }

  function handleDelete(itemId: string) {
    removeFromSelection(setSelectedIds, itemId);
    deleteReviewItem.mutate(itemId);
  }

  function handleDeleteWeakAnswer(id: string) {
    deleteWeakAnswer.mutate(id);
  }

  async function handleStartSession() {
    if (effectiveSelectedIds.size === 0 || isStarting) {
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    setIsStarting(true);
    try {
      const response = await reviewSessionsApi.create(token, {
        reviewItemIds: [...effectiveSelectedIds],
        interviewLocale: locale,
      });
      setLastReviewSessionId(response.id);
      router.push(`/review-session/${response.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to start review session",
      );
      if (err instanceof ApiError && err.status === 404) {
        setSelectedIds(new Set());
        void queryClient.invalidateQueries({ queryKey: ["review-items"] });
      }
    } finally {
      setIsStarting(false);
    }
  }

  const showSelection = activeTab === "active" && items.length > 0;
  const inactiveTabs = ALL_TABS.filter((tab) => tab !== activeTab);
  const isItemPending = (itemId: string) =>
    (updateStatus.isPending && updateStatus.variables?.itemId === itemId) ||
    (deleteReviewItem.isPending && deleteReviewItem.variables === itemId);
  const isWeakAnswerPending = (id: string) =>
    deleteWeakAnswer.isPending && deleteWeakAnswer.variables === id;

  return (
    <div className="space-y-6 pb-20">
      <AppPageHeader
        title="Study"
        description="Manage your study backlog and start focused review sessions."
        actions={
          <div className="w-full sm:w-40">
            <InterviewLocaleSelector />
          </div>
        }
      />

      <StudyResumeBanner />

      <StudyTabs activeTab={activeTab} onTabChange={handleTabChange} />

      <div
        id={getStudyPanelId(activeTab)}
        role="tabpanel"
        aria-labelledby={getStudyTabId(activeTab)}
        tabIndex={0}
        className="space-y-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
      >
        {activeTab !== "insufficient" && reviewQuery.isLoading && (
          <div
            className="flex items-center gap-2 py-12 text-sm text-text-base"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading topics…
          </div>
        )}

        {activeTab !== "insufficient" && reviewQuery.error && (
          <p className="text-sm text-red-700" role="alert">
            {reviewQuery.error instanceof Error
              ? reviewQuery.error.message
              : "Failed to load study topics"}
          </p>
        )}

        {activeTab !== "insufficient" &&
          !reviewQuery.isLoading &&
          !reviewQuery.error &&
          items.length === 0 &&
          activeTab === "active" && (
            <AppEmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title="No active study topics yet"
              description="Complete a mock interview to generate topics from your feedback."
              action={
                <Link
                  href="/practice"
                  className="inline-flex cursor-pointer rounded-full bg-jade-deep px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
                >
                  Go to Practice
                </Link>
              }
            />
          )}

        {activeTab !== "insufficient" &&
          !reviewQuery.isLoading &&
          !reviewQuery.error &&
          items.length === 0 &&
          activeTab === "learned" && (
            <AppEmptyState title="No mastered topics yet" />
          )}

        {activeTab !== "insufficient" &&
          !reviewQuery.isLoading &&
          !reviewQuery.error &&
          items.length > 0 && (
            <ul className="list-none space-y-4">
              {items.map((item) => (
                <StudyItemCard
                  key={item.id}
                  item={item}
                  selectable={showSelection}
                  selected={effectiveSelectedIds.has(item.id)}
                  onSelectToggle={
                    showSelection && !isItemPending(item.id)
                      ? () => handleSelectToggle(item.id)
                      : undefined
                  }
                  onMarkLearned={
                    !isItemPending(item.id)
                      ? () => void handleMarkLearned(item.id)
                      : undefined
                  }
                  onReactivate={
                    !isItemPending(item.id)
                      ? () => void handleReactivate(item.id)
                      : undefined
                  }
                  onDelete={
                    !isItemPending(item.id)
                      ? () => void handleDelete(item.id)
                      : undefined
                  }
                />
              ))}
            </ul>
          )}

        {showSelection && (
          <StudySelectionBar
            selectedCount={effectiveSelectedIds.size}
            onStart={() => void handleStartSession()}
            isStarting={isStarting}
          />
        )}

        {activeTab === "insufficient" && weakAnswersQuery.isLoading && (
          <div
            className="flex items-center gap-2 py-12 text-sm text-text-base"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading answers…
          </div>
        )}

        {activeTab === "insufficient" && weakAnswersQuery.error && (
          <p className="text-sm text-red-700" role="alert">
            {weakAnswersQuery.error instanceof Error
              ? weakAnswersQuery.error.message
              : "Failed to load insufficient answers"}
          </p>
        )}

        {activeTab === "insufficient" &&
          !weakAnswersQuery.isLoading &&
          !weakAnswersQuery.error &&
          weakAnswers.length === 0 && (
            <AppEmptyState
              icon={<AlertTriangle className="h-6 w-6" />}
              title="No insufficient answers yet"
              description="Answers that need more work will show up here after a mock interview."
            />
          )}

        {activeTab === "insufficient" &&
          !weakAnswersQuery.isLoading &&
          !weakAnswersQuery.error &&
          weakAnswers.length > 0 && (
            <ul className="list-none space-y-4">
              {weakAnswers.map((item) => (
                <WeakAnswerCard
                  key={item.id}
                  item={item}
                  onDelete={
                    !isWeakAnswerPending(item.id)
                      ? () => handleDeleteWeakAnswer(item.id)
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
      </div>

      {inactiveTabs.map((tab) => (
        <div
          key={tab}
          id={getStudyPanelId(tab)}
          role="tabpanel"
          aria-labelledby={getStudyTabId(tab)}
          hidden
        />
      ))}
    </div>
  );
}
