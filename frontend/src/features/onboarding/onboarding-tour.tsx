"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { EVENTS, Joyride, STATUS, type EventData, type Step } from "react-joyride";

import { useOnboardingTutorial } from "./use-onboarding-tutorial";

const STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Welcome to Hone",
    content:
      "Here's a 30-second look at how to run mock interviews and turn feedback into a study plan.",
  },
  {
    target: '[data-tour="tour-start-practice"]',
    title: "Start a mock interview",
    content:
      "Upload your resume once, then start practice sessions here. Questions are tailored to your resume and the level you pick — Entry, Mid, or Senior.",
  },
  {
    target: '[data-tour="tour-stats"]',
    title: "Track your progress",
    content:
      "Your completed and active sessions, review backlog size, and highest level reached all live here.",
  },
  {
    target: '[data-tour="tour-review-items"]',
    title: "Your study backlog",
    content:
      "After each session, weak spots turn into review items here so you know exactly what to revisit.",
  },
  {
    target: '[data-tour="tour-sessions"]',
    title: "Session history",
    content: "Every past interview is listed here so you can reopen its feedback anytime.",
  },
  {
    target: '[data-tour="tour-nav-practice"]',
    title: "Practice",
    content:
      "Pick a level — Entry, Mid, or Senior — and start a new mock interview from here anytime.",
  },
  {
    target: '[data-tour="tour-nav-feedback"]',
    title: "Feedback",
    content: "Read the closing feedback from every mock interview you've finished.",
  },
  {
    target: '[data-tour="tour-nav-study"]',
    title: "Study",
    content:
      "Work through your review items one topic at a time until you've closed each knowledge gap.",
  },
  {
    target: '[data-tour="tour-nav-resumes"]',
    title: "Resumes",
    content: "Upload and manage the resumes Hone uses to tailor your interview questions.",
  },
  {
    target: "body",
    placement: "center",
    title: "You're all set",
    content: "That's the whole app. Good luck with your practice!",
  },
];

export function OnboardingTour({ ready }: { ready: boolean }) {
  const { shouldRun, complete } = useOnboardingTutorial();
  const router = useRouter();
  const searchParams = useSearchParams();
  const manualTrigger = searchParams.get("tour") === "1";

  function handleEvent(data: EventData) {
    if (
      data.type === EVENTS.TOUR_END &&
      (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED)
    ) {
      complete();
      if (manualTrigger) {
        router.replace("/dashboard", { scroll: false });
      }
    }
  }

  return (
    <Joyride
      run={(shouldRun || manualTrigger) && ready}
      steps={STEPS}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        nextWithProgress: "Next ({current}/{total})",
        skip: "Skip tour",
      }}
      options={{
        primaryColor: "var(--color-jade-deep)",
        textColor: "var(--color-ink-black)",
        backgroundColor: "var(--color-paper-white)",
        arrowColor: "var(--color-paper-white)",
        overlayColor: "rgba(23, 25, 28, 0.55)",
        zIndex: 10000,
        spotlightRadius: 16,
        width: 380,
        buttons: ["back", "primary", "skip"],
        skipBeacon: true,
        showProgress: true,
      }}
      styles={{
        tooltip: {
          borderRadius: "var(--radius-elevatedcards)",
          boxShadow: "var(--shadow-subtle-3)",
          fontFamily: "var(--font-manrope), system-ui, sans-serif",
        },
        tooltipContainer: {
          textAlign: "left",
          padding: "22px 24px 18px",
        },
        tooltipTitle: {
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          fontSize: "1.375rem",
          fontWeight: 400,
          lineHeight: 1.2,
          color: "var(--color-ink-black)",
          marginBottom: 8,
        },
        tooltipContent: {
          padding: 0,
          fontSize: "0.875rem",
          lineHeight: 1.6,
          color: "var(--text-base)",
        },
        tooltipFooter: {
          marginTop: 20,
        },
        buttonPrimary: {
          borderRadius: "var(--radius-buttons)",
          padding: "10px 20px",
          fontSize: "0.875rem",
          fontWeight: 500,
          fontFamily: "var(--font-manrope), system-ui, sans-serif",
        },
        buttonBack: {
          borderRadius: "var(--radius-buttons)",
          padding: "10px 14px",
          fontSize: "0.875rem",
          fontFamily: "var(--font-manrope), system-ui, sans-serif",
          color: "var(--color-jade-deep)",
        },
        buttonSkip: {
          fontSize: "0.8125rem",
          fontFamily: "var(--font-manrope), system-ui, sans-serif",
          color: "var(--text-base)",
        },
        overlay: {
          backdropFilter: "blur(1px)",
        },
      }}
    />
  );
}
