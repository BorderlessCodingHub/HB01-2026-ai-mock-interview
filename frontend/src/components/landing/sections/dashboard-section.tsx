"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { Award, CircleCheck, History, ListChecks } from "lucide-react";

import LandingCta from "@/components/landing/get-started-button";
import { useSiteLocale } from "@/features/site-locale/site-locale-provider";

const basePath = process.env.__NEXT_ROUTER_BASEPATH ?? "";
const IMAGE_SRC = `${basePath}/landing/images/dashboard-lifestyle.webp`;
const SCREEN_SRC = `${basePath}/landing/images/dashboard-screen.webp`;

const ICONS = [CircleCheck, ListChecks, Award, History] as const;

const COPY = {
  en: {
    eyebrow: "Your dashboard",
    title: "Every session adds up.",
    body: "The moment you sign in, your dashboard shows where you stand and what to practice next, so every mock interview builds on the last one.",
    items: [
      {
        title: "Sessions at a glance",
        body: "Completed and in-progress interviews, ready to pick up where you left off.",
      },
      {
        title: "Review backlog",
        body: "Topics the AI flagged after each interview, sorted by high, medium and low priority.",
      },
      {
        title: "Highest level reached",
        body: "Track your climb from entry to mid to senior-level interviews.",
      },
      {
        title: "Practice history",
        body: "Every past session with its feedback, so you can see how your answers improve.",
      },
    ],
    cta: "Open your dashboard",
    alt: "A software engineer smiling next to a laptop showing the Hone dashboard",
    screenTag: "Inside your dashboard",
    screenAlt:
      "The Hone dashboard with completed sessions, active sessions, review items, highest level reached and a review backlog sorted by priority",
  },
  pt: {
    eyebrow: "Seu dashboard",
    title: "Cada sessão soma.",
    body: "Assim que você entra, o dashboard mostra onde você está e o que praticar em seguida, para cada entrevista simulada evoluir a partir da anterior.",
    items: [
      {
        title: "Sessões num relance",
        body: "Entrevistas concluídas e em andamento, prontas para continuar de onde você parou.",
      },
      {
        title: "Backlog de revisão",
        body: "Tópicos que a IA apontou em cada entrevista, organizados por prioridade alta, média e baixa.",
      },
      {
        title: "Maior nível alcançado",
        body: "Acompanhe sua evolução de entrevistas júnior para pleno e sênior.",
      },
      {
        title: "Histórico de prática",
        body: "Todas as sessões anteriores com feedback, para ver suas respostas melhorando.",
      },
    ],
    cta: "Abrir meu dashboard",
    alt: "Uma engenheira de software sorrindo ao lado de um notebook com o dashboard do Hone",
    screenTag: "Por dentro do dashboard",
    screenAlt:
      "O dashboard do Hone com sessões concluídas, sessões ativas, itens de revisão, maior nível alcançado e um backlog de revisão por prioridade",
  },
} as const;

export default function DashboardSection() {
  const { locale } = useSiteLocale();
  const copy = COPY[locale === "pt" ? "pt" : "en"];
  const prefersReducedMotion = useReducedMotion();

  const frameRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: frameRef,
    offset: ["start end", "center center"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 26,
    mass: 0.4,
  });
  const scale = useTransform(progress, [0, 1], [0.88, 1]);
  const radius = useTransform(progress, [0, 1], [40, 24]);
  const y = useTransform(progress, [0, 1], [60, 0]);
  const textY = useTransform(progress, [0, 0.6], [28, 0]);
  const textOpacity = useTransform(progress, [0, 0.5], [0, 1]);

  // The real screenshot tilts up into place, like the demo clip.
  const screenRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: screenScroll } = useScroll({
    target: screenRef,
    offset: ["start end", "center center"],
  });
  const screenProgress = useSpring(screenScroll, {
    stiffness: 120,
    damping: 24,
    mass: 0.4,
  });
  const screenScale = useTransform(screenProgress, [0, 1], [0.84, 1]);
  const screenRotateX = useTransform(screenProgress, [0, 1], [18, 0]);
  const screenY = useTransform(screenProgress, [0, 1], [70, 0]);

  return (
    <section
      id="dashboard"
      className="landing-section scroll-mt-24 overflow-x-clip bg-paper-white px-4 md:px-10"
    >
      <motion.div
        className="mx-auto mb-10 max-w-2xl px-2 text-center md:mb-14"
        style={
          prefersReducedMotion ? undefined : { y: textY, opacity: textOpacity }
        }
      >
        <p className="landing-eyebrow">{copy.eyebrow}</p>
        <h2 className="landing-heading mt-3">{copy.title}</h2>
        <p className="landing-body mt-4">{copy.body}</p>
      </motion.div>

      <div className="mx-auto grid max-w-[1360px] items-center gap-10 lg:grid-cols-[1.7fr_1fr] lg:gap-12 xl:gap-14">
        <motion.div
          ref={frameRef}
          className="overflow-hidden bg-mist-gray shadow-[0_30px_80px_-40px_rgba(10,92,74,0.35)] will-change-transform"
          style={
            prefersReducedMotion
              ? { borderRadius: 24 }
              : { scale, y, borderRadius: radius }
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static image from /public */}
          <img
            src={IMAGE_SRC}
            alt={copy.alt}
            width={2400}
            height={1340}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
        </motion.div>

        <div className="px-2">
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-1 lg:gap-y-5">
            {copy.items.map((item, index) => {
              const Icon = ICONS[index];
              return (
                <li key={item.title} className="flex items-start gap-4">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-jade)]/10 text-[var(--color-jade)]"
                    aria-hidden
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <h3 className="manrope text-[17px] font-medium text-ink-black">
                      {item.title}
                    </h3>
                    <p className="manrope mt-1 text-[15px] leading-[1.5] text-slate-gray">
                      {item.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-8">
            <LandingCta label={copy.cta} variant="solid" href="/login" />
          </div>
        </div>
      </div>

      <div
        ref={screenRef}
        className="mx-auto mt-16 max-w-[1200px] [perspective:1600px] md:mt-24"
      >
        <p className="landing-tag mb-3 text-center">{copy.screenTag}</p>
        <motion.div
          className="overflow-hidden rounded-[20px] border border-black/5 bg-paper-white shadow-[0_40px_100px_-50px_rgba(10,92,74,0.45)] will-change-transform"
          style={
            prefersReducedMotion
              ? undefined
              : {
                  scale: screenScale,
                  rotateX: screenRotateX,
                  y: screenY,
                  transformOrigin: "50% 100%",
                }
          }
        >
          <div
            className="flex items-center gap-1.5 border-b border-black/5 bg-mist-gray px-4 py-3"
            aria-hidden
          >
            <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static image from /public */}
          <img
            src={SCREEN_SRC}
            alt={copy.screenAlt}
            width={2400}
            height={1367}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
        </motion.div>
      </div>
    </section>
  );
}
