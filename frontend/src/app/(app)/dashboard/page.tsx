"use client";

import { Suspense, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { useAuth } from "@/features/auth/session-provider";
import { AppShell } from "@/features/dashboard/app-shell";
import { DashboardStats } from "@/features/dashboard/dashboard-stats";
import { deriveDashboardStats } from "@/features/dashboard/lib/stats";
import { OnboardingTour } from "@/features/onboarding/onboarding-tour";
import {
  ReviewItemsGrid,
  ReviewItemsSectionHeader,
} from "@/features/dashboard/review-items-grid";
import { SessionsTable } from "@/features/dashboard/sessions-table";
import { useReviewItems } from "@/lib/query/hooks/use-review-items";
import { useSessions } from "@/lib/query/hooks/use-sessions";

const TABS = ["Overview", "Feedback"] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Overview");
  const sessionsQuery = useSessions();
  const reviewQuery = useReviewItems();

  const sessions = sessionsQuery.data?.sessions ?? [];
  const reviewItems = reviewQuery.data?.reviewItems ?? [];
  const stats = deriveDashboardStats(sessions);

  const isLoading = sessionsQuery.isLoading || reviewQuery.isLoading;
  const error = sessionsQuery.error ?? reviewQuery.error;

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = TABS[nextIndex];
    setActiveTab(nextTab);
    document.getElementById(`dashboard-tab-${nextTab.toLowerCase()}`)?.focus();
  }

  const header = (
    <header className="flex shrink-0 items-center justify-between border-b border-border-hairline bg-paper-white px-6 py-3">
      <div
        role="tablist"
        aria-label="Dashboard sections"
        className="manrope flex items-center gap-6"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab}
            id={`dashboard-tab-${tab.toLowerCase()}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`dashboard-panel-${tab.toLowerCase()}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={cn(
              "cursor-pointer border-b-2 px-0.5 pb-1 text-sm transition-colors focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-jade-deep",
              activeTab === tab
                ? "border-jade font-medium text-jade-deep"
                : "border-transparent text-text-base hover:text-ink-black",
            )}
          >
            {tab}
          </button>
        ))}
      </div>
    </header>
  );

  return (
    <AppShell header={header}>
      <div
        id="dashboard-panel-overview"
        role="tabpanel"
        aria-labelledby="dashboard-tab-overview"
        tabIndex={activeTab === "Overview" ? 0 : -1}
        hidden={activeTab !== "Overview"}
        className="space-y-7 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-jade-deep"
      >
        {isLoading && (
          <p className="manrope text-sm text-text-base">Loading dashboard…</p>
        )}
        {error && (
          <p
            role="alert"
            className="manrope text-sm text-(--status-critical-foreground)"
          >
            {error instanceof Error ? error.message : "Failed to load data"}
          </p>
        )}

        {!isLoading && !error && (
          <>
            <section className="landing-artifact landing-jade-wash relative overflow-hidden p-6! sm:p-8!">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-jade-mist/80 blur-2xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-8 top-1/2 hidden w-28 -translate-y-1/2 space-y-2 sm:block"
              >
                <span className="block h-2 w-full rounded-full bg-jade-light/70" />
                <span className="ml-auto block h-2 w-4/5 rounded-full bg-jade/45" />
                <span className="ml-auto block h-2 w-3/5 rounded-full bg-jade-mist" />
              </div>
              <div className="relative z-10 max-w-lg space-y-3">
                <p className="landing-tag text-text-base!">
                  Your interview practice
                </p>
                <h1 className="instrument-serif text-3xl leading-tight tracking-[-0.02em] text-ink-black sm:text-4xl">
                  Welcome back, {user?.name ?? "there"}.
                </h1>
                <p className="manrope max-w-[58ch] text-sm leading-relaxed text-text-base">
                  Upload your resume and run AI mock interviews. Review items
                  appear after you finish a session.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link
                    href="/practice"
                    data-tour="tour-start-practice"
                    className="manrope inline-flex h-11 items-center justify-center rounded-full border border-jade-deep bg-jade-deep px-5 text-sm font-medium text-paper-white transition-colors hover:border-ink-black hover:bg-ink-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-deep"
                  >
                    Start practice
                  </Link>
                  <Link
                    href="/feedback"
                    className="manrope inline-flex h-11 items-center justify-center rounded-full border border-jade-deep bg-transparent px-5 text-sm font-medium text-jade-deep transition-colors hover:bg-jade-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-deep"
                  >
                    View feedback
                  </Link>
                </div>
              </div>
            </section>

            <div data-tour="tour-stats">
              <DashboardStats
                completedCount={stats.completedCount}
                activeCount={stats.activeCount}
                reviewItemsCount={reviewItems.length}
                highestLevel={stats.highestLevel}
              />
            </div>

            <div data-tour="tour-review-items" className="space-y-4">
              <ReviewItemsSectionHeader />
              <ReviewItemsGrid items={reviewItems} limit={3} />
            </div>

            <div data-tour="tour-sessions" className="space-y-4">
              <div>
                <p className="landing-tag mb-1 text-text-base!">
                  Practice history
                </p>
                <h2 className="instrument-serif text-2xl leading-tight text-ink-black">
                  Recent sessions
                </h2>
              </div>
              <SessionsTable sessions={sessions} />
            </div>
          </>
        )}
      </div>

      {!isLoading && !error && (
        <Suspense fallback={null}>
          <OnboardingTour ready />
        </Suspense>
      )}

      <div
        id="dashboard-panel-feedback"
        role="tabpanel"
        aria-labelledby="dashboard-tab-feedback"
        tabIndex={activeTab === "Feedback" ? 0 : -1}
        hidden={activeTab !== "Feedback"}
        className="space-y-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-jade-deep"
      >
        {isLoading && (
          <p className="manrope text-sm text-text-base">Loading dashboard…</p>
        )}
        {error && (
          <p
            role="alert"
            className="manrope text-sm text-(--status-critical-foreground)"
          >
            {error instanceof Error ? error.message : "Failed to load data"}
          </p>
        )}

        {!isLoading && !error && (
          <>
            <ReviewItemsSectionHeader />
            <ReviewItemsGrid items={reviewItems} />
          </>
        )}
      </div>
    </AppShell>
  );
}
