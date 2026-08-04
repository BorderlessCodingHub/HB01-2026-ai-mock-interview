"use client";

import type { KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

const TABS = [
  { value: "active", label: "Active" },
  { value: "learned", label: "Learned" },
  { value: "insufficient", label: "Insufficient Answers" },
] as const;

export type StudyTab = (typeof TABS)[number]["value"];

export const getStudyTabId = (tab: StudyTab) => `study-tab-${tab}`;
export const getStudyPanelId = (tab: StudyTab) => `study-panel-${tab}`;

export type StudyTabsProps = {
  activeTab: StudyTab;
  onTabChange: (tab: StudyTab) => void;
};

export function StudyTabs({ activeTab, onTabChange }: StudyTabsProps) {
  function handleKeyDown(
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
    const nextTab = TABS[nextIndex].value;
    onTabChange(nextTab);
    document.getElementById(getStudyTabId(nextTab))?.focus();
  }

  return (
    <div
      className="flex items-center gap-6 border-b border-border-hairline"
      role="tablist"
      aria-label="Study topic status"
    >
      {TABS.map((tab, index) => (
        <button
          key={tab.value}
          id={getStudyTabId(tab.value)}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.value}
          aria-controls={getStudyPanelId(tab.value)}
          tabIndex={activeTab === tab.value ? 0 : -1}
          onClick={() => onTabChange(tab.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={cn(
            "cursor-pointer border-b-2 pb-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
            activeTab === tab.value
              ? "border-jade-deep font-semibold text-jade-deep"
              : "border-transparent text-text-base hover:text-ink-black",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
