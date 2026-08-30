"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/session-provider";
import { ReviewReportCard } from "@/features/study/review-report-card";
import { ApiError } from "@/lib/api/client";
import { reviewSessionsApi } from "@/lib/api/review-sessions";
import { useReviewSession } from "@/lib/query/hooks/use-review-session";
import { queryKeys } from "@/lib/query/keys";
import type { InterviewLocale } from "@/types/interview";
import type { ReviewSessionItemReport } from "@/types/review-sessions";
import { AppPageHeader } from "@/components/app/app-page-header";

import {
  ApplyPayloadValidationError,
  buildApplyPayload,
} from "./lib/build-apply-payload";
import { deriveReviewResultsSummary } from "./lib/derive-review-results-summary";
import { clearLastReviewSessionId } from "./lib/review-session-storage";
import {
  initReportCardState,
  updateReportCardState,
  type ReportCardStatePatch,
} from "./lib/report-card-state";

type ReviewSessionReportProps = {
  sessionId: string;
};

type ReportCardsFormProps = {
  sessionId: string;
  items: ReviewSessionItemReport[];
  locale: InterviewLocale;
};

function ReportCardsForm({ sessionId, items, locale }: ReportCardsFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { getAccessToken, accessToken } = useAuth();

  const [cards, setCards] = useState(() => items.map(initReportCardState));
  const [isApplying, setIsApplying] = useState(false);

  const appliedRef = useRef(false);
  const applyingRef = useRef(false);
  const cardsRef = useRef(cards);
  const isStableMountedRef = useRef(false);

  useLayoutEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const tryKeepaliveApply = useCallback(() => {
    if (appliedRef.current || applyingRef.current) {
      return;
    }

    const token = accessToken;
    if (!token) {
      return;
    }

    try {
      const payload = buildApplyPayload(cardsRef.current);
      reviewSessionsApi.applyKeepalive(token, sessionId, payload);
    } catch {
      // Best-effort auto-apply; validation failures are ignored on leave.
    }
  }, [accessToken, sessionId]);

  const tryKeepaliveApplyRef = useRef(tryKeepaliveApply);

  useLayoutEffect(() => {
    tryKeepaliveApplyRef.current = tryKeepaliveApply;
  }, [tryKeepaliveApply]);

  useEffect(() => {
    const handlePageLeave = () => {
      tryKeepaliveApplyRef.current();
    };

    const stableMountTimer = window.setTimeout(() => {
      isStableMountedRef.current = true;
    }, 0);

    window.addEventListener("beforeunload", handlePageLeave);
    window.addEventListener("pagehide", handlePageLeave);

    return () => {
      window.clearTimeout(stableMountTimer);
      window.removeEventListener("beforeunload", handlePageLeave);
      window.removeEventListener("pagehide", handlePageLeave);

      // Skip keepalive on React Strict Mode's simulated unmount (timer never fires).
      if (isStableMountedRef.current) {
        tryKeepaliveApplyRef.current();
      }
      isStableMountedRef.current = false;
    };
  }, [sessionId]);

  const handleCardChange = (
    reviewSessionItemId: string,
    patch: ReportCardStatePatch,
  ) => {
    setCards((current) =>
      current.map((card) =>
        card.reviewSessionItemId === reviewSessionItemId
          ? updateReportCardState(card, patch)
          : card,
      ),
    );
  };

  const finishApply = useCallback(() => {
    appliedRef.current = true;
    toast.success("Review suggestions applied");
    clearLastReviewSessionId();
    void queryClient.invalidateQueries({ queryKey: ["review-items"] });
    void queryClient.invalidateQueries({
      queryKey: ["review-sessions", "list"],
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.reviewSession(sessionId),
    });
    router.push("/study");
  }, [queryClient, router, sessionId]);

  const handleApply = async () => {
    if (appliedRef.current || applyingRef.current) {
      return;
    }

    let payload;
    try {
      payload = buildApplyPayload(cards);
    } catch (error) {
      if (error instanceof ApplyPayloadValidationError) {
        toast.error(error.message);
        return;
      }
      throw error;
    }

    applyingRef.current = true;
    setIsApplying(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not authenticated");
        return;
      }

      await reviewSessionsApi.apply(token, sessionId, payload);
      finishApply();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.message === "Review session already completed"
      ) {
        finishApply();
        return;
      }

      toast.error(
        error instanceof ApiError
          ? error.message
          : "Failed to apply review suggestions",
      );
    } finally {
      applyingRef.current = false;
      setIsApplying(false);
    }
  };

  const summary = deriveReviewResultsSummary(items, "suggested");
  const topicLabel =
    summary.topicCount === 1 ? "topic reviewed" : "topics reviewed";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <AppPageHeader
        title="Review results"
        description="See how the session went, then confirm what happens to your study list."
      />

      <p className="text-sm text-text-base">
        {`${summary.topicCount} ${topicLabel} · ${summary.learnedCount} suggested as learned · ${summary.priorityChangeCount} priority changes`}
      </p>

      <ul className="list-none space-y-4">
        {cards.map((card) => (
          <ReviewReportCard
            key={card.reviewSessionItemId}
            card={card}
            locale={locale}
            onChange={(patch) =>
              handleCardChange(card.reviewSessionItemId, patch)
            }
          />
        ))}
      </ul>

      <div className="sticky bottom-0 -mx-4 border-t border-border-hairline bg-paper-white/95 px-4 py-3 backdrop-blur-sm md:-mx-6 md:px-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={isApplying || cards.length === 0}
            aria-busy={isApplying}
            className="flex min-w-22 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-jade-deep px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-black disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
          >
            {isApplying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Applying…
              </>
            ) : (
              "Apply"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReviewSessionReport({ sessionId }: ReviewSessionReportProps) {
  const router = useRouter();
  const sessionQuery = useReviewSession(sessionId);
  const session = sessionQuery.data;

  useEffect(() => {
    if (!session) {
      return;
    }

    if (session.status === "in_progress") {
      router.replace(`/review-session/${sessionId}`);
      return;
    }

    if (session.status === "completed") {
      router.replace("/study");
    }
  }, [router, session, sessionId]);

  useEffect(() => {
    if (
      sessionQuery.error instanceof ApiError &&
      sessionQuery.error.status === 404
    ) {
      toast.error("Review session not found");
      clearLastReviewSessionId();
      router.replace("/study");
    }
  }, [router, sessionQuery.error]);

  if (sessionQuery.isLoading || session?.status !== "pending_review") {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-text-base"
        role="status"
      >
        <Loader2 className="h-5 w-5 animate-spin text-jade-deep" />
        Loading review report…
      </div>
    );
  }

  return (
    <ReportCardsForm
      key={sessionId}
      sessionId={sessionId}
      items={session.items}
      locale={session.interviewLocale}
    />
  );
}
