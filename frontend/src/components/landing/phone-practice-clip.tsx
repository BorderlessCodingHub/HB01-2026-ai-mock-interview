"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";

import { useSiteLocale } from "@/features/site-locale/site-locale-provider";
import { useAutoplayVideo } from "@/components/landing/use-autoplay-video";

const basePath = process.env.__NEXT_ROUTER_BASEPATH ?? "";
const CLIP_SRC = `${basePath}/landing/videos/mobile-practice.mp4`;
const CLIP_POSTER = `${basePath}/landing/videos/mobile-practice.webp`;

const CLIP_LABEL = {
  en: "A software engineer practicing interview answers out loud on his phone",
  pt: "Um engenheiro de software praticando respostas de entrevista em voz alta no celular",
} as const;

type PhonePracticeClipProps = {
  /** Classes for the <video>/<img> (aspect ratio, crop position). */
  mediaClassName?: string;
  className?: string;
};

/**
 * Lifestyle clip of someone practicing on their phone. Muted and looping,
 * plays only while near the viewport, poster only with reduced motion.
 */
export function PhonePracticeClip({
  mediaClassName = "aspect-[4/3] object-[30%_center] md:aspect-[5/4]",
  className,
}: PhonePracticeClipProps) {
  const { locale } = useSiteLocale();
  const label = CLIP_LABEL[locale === "pt" ? "pt" : "en"];
  const prefersReducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  const shouldLoad = useAutoplayVideo(videoRef, !prefersReducedMotion);

  const media = `block h-auto w-full object-cover ${mediaClassName}`;

  return (
    <div
      className={`overflow-hidden rounded-[22px] bg-mist-gray shadow-[0_24px_60px_-32px_rgba(10,92,74,0.45)] ${className ?? ""}`}
    >
      {prefersReducedMotion ? (
        // eslint-disable-next-line @next/next/no-img-element -- static poster from /public
        <img
          src={CLIP_POSTER}
          alt={label}
          width={640}
          height={360}
          className={media}
        />
      ) : (
        <video
          ref={videoRef}
          src={shouldLoad ? CLIP_SRC : undefined}
          poster={CLIP_POSTER}
          width={640}
          height={360}
          muted
          loop
          playsInline
          preload={shouldLoad ? "auto" : "none"}
          aria-label={label}
          className={media}
        />
      )}
    </div>
  );
}
