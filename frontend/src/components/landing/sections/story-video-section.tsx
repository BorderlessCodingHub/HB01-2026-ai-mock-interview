"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

import { useSiteLocale } from "@/features/site-locale/site-locale-provider";
import {
  useAutoplayVideo,
  useIsCompactViewport,
} from "@/components/landing/use-autoplay-video";

const basePath = process.env.__NEXT_ROUTER_BASEPATH ?? "";
const SRC = `${basePath}/landing/videos/candidate-story.mp4`;
const POSTER = `${basePath}/landing/videos/candidate-story.webp`;

const COPY = {
  en: {
    eyebrow: "Your next interview",
    title: "Walk in ready.",
    body: "Practice out loud until the answers feel like yours. Hone turns nerves into reps — and reps into offers.",
    label:
      "A software engineer practicing answers out loud for an upcoming technical interview",
  },
  pt: {
    eyebrow: "Sua próxima entrevista",
    title: "Chegue preparado.",
    body: "Pratique em voz alta até as respostas soarem naturais. O Hone transforma nervosismo em prática — e prática em aprovação.",
    label:
      "Uma engenheira de software praticando respostas em voz alta para uma entrevista técnica",
  },
} as const;

export default function StoryVideoSection() {
  const { locale } = useSiteLocale();
  const copy = COPY[locale === "pt" ? "pt" : "en"];
  const prefersReducedMotion = useReducedMotion();
  // Scaling a playing <video> on every scroll frame stutters on phones.
  const staticFrame = useIsCompactViewport();

  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Card opens up from a smaller, rounder frame to full width as it scrolls in.
  const { scrollYProgress } = useScroll({
    target: frameRef,
    offset: ["start end", "center center"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 26,
    mass: 0.4,
  });
  const scale = useTransform(progress, [0, 1], [0.86, 1]);
  const radius = useTransform(progress, [0, 1], [48, 28]);
  const y = useTransform(progress, [0, 1], [70, 0]);
  const textY = useTransform(progress, [0.35, 1], [28, 0]);
  const textOpacity = useTransform(progress, [0.35, 0.9], [0, 1]);

  const shouldLoad = useAutoplayVideo(videoRef, !prefersReducedMotion);

  return (
    <section className="overflow-x-clip bg-paper-white px-4 pb-[var(--section-gap)] md:px-10">
      <motion.div
        ref={frameRef}
        className="relative mx-auto max-w-[1280px] overflow-hidden bg-mist-gray shadow-[0_30px_80px_-40px_rgba(10,92,74,0.35)] will-change-transform"
        style={
          prefersReducedMotion || staticFrame
            ? { borderRadius: 28 }
            : { scale, y, borderRadius: radius }
        }
      >
        {prefersReducedMotion ? (
          // eslint-disable-next-line @next/next/no-img-element -- static poster from /public
          <img
            src={POSTER}
            alt={copy.label}
            width={1280}
            height={720}
            className="block aspect-[4/5] h-auto w-full object-cover object-[70%_center] sm:aspect-video"
          />
        ) : (
          <video
            ref={videoRef}
            src={shouldLoad ? SRC : undefined}
            poster={POSTER}
            width={1280}
            height={720}
            muted
            loop
            playsInline
            preload={shouldLoad ? "auto" : "none"}
            aria-label={copy.label}
            className="block aspect-[4/5] h-auto w-full object-cover object-[70%_center] sm:aspect-video"
          />
        )}

        {/* Soft white fade so copy stays readable over the bright footage. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-[55%] bg-gradient-to-r from-white/80 via-white/45 to-transparent sm:block"
          aria-hidden
        />

        <motion.div
          className="absolute inset-y-0 left-0 hidden max-w-[44%] flex-col justify-center p-10 sm:flex lg:p-16"
          style={
            prefersReducedMotion
              ? undefined
              : { y: textY, opacity: textOpacity }
          }
        >
          <p className="landing-eyebrow">{copy.eyebrow}</p>
          <h2 className="landing-heading mt-3">{copy.title}</h2>
          <p className="landing-body mt-4 max-w-md">{copy.body}</p>
        </motion.div>
      </motion.div>

      {/* Mobile: copy below the clip so it never covers the person. */}
      <div className="mx-auto mt-8 max-w-[1280px] px-2 sm:hidden">
        <p className="landing-eyebrow">{copy.eyebrow}</p>
        <h2 className="landing-heading mt-3">{copy.title}</h2>
        <p className="landing-body mt-4">{copy.body}</p>
      </div>
    </section>
  );
}
