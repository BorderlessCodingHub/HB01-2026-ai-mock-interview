"use client";

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
    target: "body",
    placement: "center",
    title: "You're all set",
    content:
      "Use the sidebar anytime to jump into Practice, Study, Feedback, or your Resumes. Good luck!",
  },
];

export function OnboardingTour({ ready }: { ready: boolean }) {
  const { shouldRun, complete } = useOnboardingTutorial();

  function handleEvent(data: EventData) {
    if (
      data.type === EVENTS.TOUR_END &&
      (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED)
    ) {
      complete();
    }
  }

  return (
    <Joyride
      run={shouldRun && ready}
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
        primaryColor: "#0a5c4a",
        textColor: "#17191c",
        backgroundColor: "#ffffff",
        arrowColor: "#ffffff",
        overlayColor: "rgba(23, 25, 28, 0.55)",
        zIndex: 10000,
        spotlightRadius: 10,
        width: 360,
        buttons: ["back", "primary", "skip"],
        skipBeacon: true,
        showProgress: true,
      }}
    />
  );
}
