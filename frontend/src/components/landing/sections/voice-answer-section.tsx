"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { Mic } from "lucide-react";

import { useSiteLocale } from "@/features/site-locale/site-locale-provider";

const basePath = process.env.__NEXT_ROUTER_BASEPATH ?? "";
const SRC = `${basePath}/landing/videos/online-interview.mp4`;
const POSTER = `${basePath}/landing/videos/online-interview.webp`;

const COPY = {
  en: {
    eyebrow: "Speech to text",
    title: "Just talk. Hone types it for you.",
    body: "Answer out loud like you would on a real video call. Built-in speech-to-text turns your voice into the chat message in real time, so you practice how you actually speak, not how you type.",
    points: [
      "Live transcription right in the interview chat",
      "Review and edit the text before sending",
      "Feedback on what you said, not only what you wrote",
    ],
    listening: "Listening…",
    transcript:
      "I'd start by splitting the read path behind a cache, then…",
    label:
      "A software engineer answering a mock interview question out loud on a video call",
  },
  pt: {
    eyebrow: "Speech to text",
    title: "É só falar. O Hone escreve por você.",
    body: "Responda em voz alta, como numa chamada de vídeo de verdade. O speech-to-text integrado transforma sua voz em mensagem no chat em tempo real, para você treinar do jeito que fala, não do jeito que digita.",
    points: [
      "Transcrição ao vivo direto no chat da entrevista",
      "Revise e edite o texto antes de enviar",
      "Feedback sobre o que você falou, não só o que escreveu",
    ],
    listening: "Ouvindo…",
    transcript:
      "Eu começaria separando a leitura atrás de um cache, depois…",
    label:
      "Um engenheiro de software respondendo em voz alta uma entrevista simulada por chamada de vídeo",
  },
} as const;

function TranscriptCard({
  listening,
  transcript,
}: {
  listening: string;
  transcript: string;
}) {
  return (
    <div className="manrope flex max-w-[340px] items-start gap-3 rounded-2xl bg-paper-white/95 p-3.5 shadow-[0_18px_40px_-20px_rgba(10,92,74,0.45)] backdrop-blur">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-jade text-paper-white">
        <span
          className="absolute inset-0 animate-ping rounded-full bg-jade/40 motion-reduce:hidden"
          aria-hidden
        />
        <Mic className="relative h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-jade">
          {listening}
        </p>
        <p className="mt-0.5 text-[14px] leading-snug text-ink-black">
          {transcript}
          <span
            className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-jade"
            aria-hidden
          />
        </p>
      </div>
    </div>
  );
}

export default function VoiceAnswerSection() {
  const { locale } = useSiteLocale();
  const copy = COPY[locale === "pt" ? "pt" : "en"];
  const prefersReducedMotion = useReducedMotion();

  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isNear, setIsNear] = useState(false);

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
  const cardY = useTransform(progress, [0.55, 1], [24, 0]);
  const cardOpacity = useTransform(progress, [0.55, 1], [0, 1]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || prefersReducedMotion) return;
    video.muted = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNear(true);
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  const media =
    "block aspect-[4/5] h-auto w-full object-cover object-[72%_center] sm:aspect-video";

  return (
    <section
      id="speech-to-text"
      className="scroll-mt-24 overflow-x-clip bg-paper-white px-4 pb-[var(--section-gap)] md:px-10"
    >
      <motion.div
        ref={frameRef}
        className="relative mx-auto max-w-[1280px] overflow-hidden bg-mist-gray shadow-[0_30px_80px_-40px_rgba(10,92,74,0.35)] will-change-transform"
        style={
          prefersReducedMotion
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
            className={media}
          />
        ) : (
          <video
            ref={videoRef}
            src={isNear ? SRC : undefined}
            poster={POSTER}
            width={1280}
            height={720}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={copy.label}
            className={media}
          />
        )}

        <div
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-[58%] bg-gradient-to-r from-white/85 via-white/50 to-transparent sm:block"
          aria-hidden
        />

        <motion.div
          className="absolute inset-y-0 left-0 hidden max-w-[46%] flex-col justify-center p-10 sm:flex lg:p-16"
          style={
            prefersReducedMotion ? undefined : { y: textY, opacity: textOpacity }
          }
        >
          <p className="landing-eyebrow">{copy.eyebrow}</p>
          <h2 className="landing-heading mt-3">{copy.title}</h2>
          <p className="landing-body mt-4 hidden max-w-md lg:block">
            {copy.body}
          </p>
        </motion.div>

        {/* Live transcript card over the clip */}
        <motion.div
          className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6"
          style={
            prefersReducedMotion
              ? undefined
              : { y: cardY, opacity: cardOpacity }
          }
        >
          <TranscriptCard
            listening={copy.listening}
            transcript={copy.transcript}
          />
        </motion.div>
      </motion.div>

      <div className="mx-auto mt-8 max-w-[1280px] px-2 md:mt-10">
        <div className="sm:hidden">
          <p className="landing-eyebrow">{copy.eyebrow}</p>
          <h2 className="landing-heading mt-3">{copy.title}</h2>
        </div>
        <p className="landing-body mt-4 sm:mt-0 lg:hidden">{copy.body}</p>
        <ul className="manrope mt-6 grid gap-3 text-[15px] text-ink-black sm:grid-cols-3 lg:mt-0">
          {copy.points.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <span
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-jade"
                aria-hidden
              />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
