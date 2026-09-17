"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

import BackedByBadge from "@/components/landing/backed-by-badge";
import LandingCta from "@/components/landing/get-started-button";

function ScoreArtifact({ className }: { className?: string }) {
  return (
    <div className={`landing-artifact ${className ?? ""}`}>
      <p className="landing-tag mb-1">Interview score</p>
      <p className="manrope text-[20px] font-medium leading-[1.35] text-ink-black">
        73
        <span className="text-slate-gray"> /100</span>
      </p>
      <p className="manrope mt-1 text-sm text-slate-gray">
        ↑ 12 pts vs last session
      </p>
      <svg
        viewBox="0 0 120 36"
        className="mt-3 h-9 w-full"
        aria-hidden
        fill="none"
      >
        <path
          d="M2 28 C18 26, 28 8, 44 14 C60 20, 72 4, 88 10 C100 14, 110 22, 118 6"
          stroke="var(--color-jade)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function TopicsArtifact({ className }: { className?: string }) {
  const rows = [
    { topic: "System Design", level: "Strong" },
    { topic: "APIs", level: "Strong" },
    { topic: "Algorithms", level: "Review" },
    { topic: "Trade-offs", level: "Growing" },
    { topic: "Scalability", level: "Strong" },
  ];

  return (
    <div className={`landing-artifact ${className ?? ""}`}>
      <p className="landing-tag mb-3">Topic coverage</p>
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li
            key={row.topic}
            className="manrope flex items-center justify-between gap-6 border-b border-border-hairline pb-2 text-sm text-ink-black last:border-0 last:pb-0"
          >
            <span>{row.topic}</span>
            <span className="text-ash-gray">{row.level}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeedbackArtifact({ className }: { className?: string }) {
  return (
    <div className={`landing-artifact relative ${className ?? ""}`}>
      <div className="mb-3 flex items-center gap-2">
        <span
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-jade-pale text-sm font-medium text-jade-deep"
          aria-hidden
        >
          AI
          <span className="absolute -bottom-1 -right-1 text-[10px] text-ink-black">
            ↗
          </span>
        </span>
        <div>
          <p className="manrope text-sm font-medium text-ink-black">Feedback</p>
          <p className="landing-tag">System Design · Ride share</p>
        </div>
      </div>
      <p className="manrope text-sm leading-relaxed text-ink-black">
        You framed the bottleneck clearly. Push deeper on consistency trade-offs
        before proposing shards.
      </p>
    </div>
  );
}

function ComposerArtifact({ className }: { className?: string }) {
  return (
    <div
      className={`landing-artifact flex items-center gap-3 !rounded-[16px] !py-4 !pl-4 !pr-3 ${className ?? ""}`}
    >
      <span className="manrope flex-1 text-base text-smoke-gray">
        Ask anything…
      </span>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-jade text-paper-white"
        aria-hidden
      >
        →
      </span>
    </div>
  );
}

function ActivationArtifact({ className }: { className?: string }) {
  return (
    <div className={`landing-artifact ${className ?? ""}`}>
      <p className="landing-tag mb-1">Activation</p>
      <p className="manrope text-[20px] font-medium text-ink-black">46.2%</p>
      <p className="manrope mt-1 text-sm text-slate-gray">
        ↑ 5.5× vs last week
      </p>
      <svg viewBox="0 0 80 80" className="mx-auto mt-3 h-16 w-16" aria-hidden>
        <circle
          cx="40"
          cy="40"
          r="28"
          fill="none"
          stroke="var(--color-mist-gray)"
          strokeWidth="6"
        />
        <circle
          cx="40"
          cy="40"
          r="28"
          fill="none"
          stroke="var(--color-jade)"
          strokeWidth="6"
          strokeDasharray="128 176"
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
      </svg>
    </div>
  );
}

/** Smooth 3-point loop — avoids the hard reversal of yoyo */
function attachArtifactFloat(el: Element, index: number) {
  const yAmp = 8 + (index % 3) * 2.5;
  const xAmp = 3 + (index % 2) * 1.5;
  const xDir = index % 2 === 0 ? 1 : -1;
  const duration = 7 + index * 1.1;

  gsap
    .timeline({
      repeat: -1,
      delay: index * 0.55,
      defaults: { ease: "sine.inOut" },
    })
    .to(el, { y: -yAmp, x: xAmp * xDir, duration: duration * 0.38 })
    .to(el, {
      y: yAmp * 0.45,
      x: -xAmp * xDir * 0.35,
      duration: duration * 0.34,
    })
    .to(el, { y: 0, x: 0, duration: duration * 0.28 });
}

export default function HeroSection() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const ctx = gsap.context(() => {
      const copy = root.querySelectorAll("[data-hero-copy]");
      const arts = root.querySelectorAll("[data-hero-art]");

      gsap.set(copy, { opacity: 0, y: 28 });
      gsap.set(arts, { opacity: 0, y: 40, scale: 0.96 });

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          if (!reduced) {
            arts.forEach((el, i) => attachArtifactFloat(el, i));
          }
        },
      });
      tl.to(copy, {
        opacity: 1,
        y: 0,
        duration: reduced ? 0.01 : 0.9,
        stagger: reduced ? 0 : 0.1,
      }).to(
        arts,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: reduced ? 0.01 : 0.95,
          stagger: reduced ? 0 : 0.08,
        },
        reduced ? 0 : "-=0.45",
      );
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      className="landing-hero relative isolate min-h-[100svh] overflow-hidden px-6 pb-24 pt-28 md:pb-32 md:pt-32"
    >
      {/* Soft jade wash */}
      <div
        className="landing-jade-wash pointer-events-none absolute inset-0"
        aria-hidden
      />

      <div className="relative mx-auto min-h-[calc(100svh-8rem)] max-w-[1200px]">
        {/* Collage artifacts — desktop */}
        <div
          data-hero-art
          className="pointer-events-none absolute left-0 top-[12%] z-[1] hidden w-[240px] lg:block"
          style={{ rotate: "-2deg" }}
        >
          <TopicsArtifact />
        </div>

        <div
          data-hero-art
          className="pointer-events-none absolute right-[-1%] top-[8%] z-[1] hidden w-[220px] lg:block"
          style={{ rotate: "2.5deg" }}
        >
          <ScoreArtifact />
        </div>

        <div
          data-hero-art
          className="pointer-events-none absolute right-[6%] top-[42%] z-[1] hidden w-[180px] lg:block"
          style={{ rotate: "-1.5deg" }}
        >
          <ActivationArtifact />
        </div>

        <div
          data-hero-art
          className="pointer-events-none absolute bottom-[18%] left-[4%] z-[1] hidden w-[300px] lg:block"
          style={{ rotate: "1deg" }}
        >
          <FeedbackArtifact />
        </div>

        <div
          data-hero-art
          className="pointer-events-none absolute bottom-[8%] left-1/2 z-[2] hidden w-[min(420px,48%)] -translate-x-1/2 lg:block"
        >
          <ComposerArtifact />
        </div>

        {/* Center editorial copy */}
        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-10rem)] max-w-[720px] flex-col items-center justify-center text-center">
          <div data-hero-copy>
            <BackedByBadge className="mb-5" />
          </div>

          <p
            data-hero-copy
            className="instrument-serif mb-5 text-[44px] font-normal leading-[1.1] tracking-[-0.66px] text-ink-black md:text-[64px] md:tracking-[-0.96px]"
          >
            Hone
          </p>

          <h1
            data-hero-copy
            className="instrument-serif text-[clamp(2.75rem,7.5vw,90px)] font-normal leading-[1.15] tracking-[-0.025em] text-ink-black text-balance"
          >
            Practice the interview that{" "}
            <em className="italic">decides your career</em>
          </h1>

          <p
            data-hero-copy
            className="manrope mt-6 max-w-lg text-[17px] leading-[1.35] text-slate-gray"
          >
            Resume-aware AI mock interviews for software engineers — structured
            feedback, topic coverage, and the reps that stick.
          </p>

          <div
            data-hero-copy
            className="mt-10 flex items-center justify-center"
          >
            <LandingCta label="Get started" variant="solid" href="/login" />
          </div>
        </div>

        {/* Mobile artifacts */}
        <div className="relative z-10 mt-10 grid gap-4 sm:grid-cols-2 lg:hidden">
          <div data-hero-art>
            <ScoreArtifact />
          </div>
          <div data-hero-art>
            <ActivationArtifact />
          </div>
          <div data-hero-art className="sm:col-span-2">
            <TopicsArtifact />
          </div>
          <div data-hero-art className="sm:col-span-2">
            <FeedbackArtifact />
          </div>
          <div data-hero-art className="sm:col-span-2">
            <ComposerArtifact />
          </div>
        </div>
      </div>
    </section>
  );
}
