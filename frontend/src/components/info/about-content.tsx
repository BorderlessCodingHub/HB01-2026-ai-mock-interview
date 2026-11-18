"use client";

import Image from "next/image";
import {
  BookOpenCheck,
  FileText,
  MessagesSquare,
  Mic,
  type LucideIcon,
} from "lucide-react";

import borderlessIcon from "@/assets/borderless-icon.png";
import { BORDERLESS_SOCIALS } from "@/components/info/borderless-socials";
import { InfoHero } from "@/components/info/info-hero";
import LandingCta from "@/components/landing/get-started-button";
import { useSiteLocale } from "@/features/site-locale/site-locale-provider";

const BORDERLESS_URL = "https://www.borderlesscoding.com/en";

const ICONS: LucideIcon[] = [FileText, MessagesSquare, Mic, BookOpenCheck];

const COPY = {
  en: {
    eyebrow: "About Hone",
    titleStart: "Interview practice that",
    titleEmphasis: "thinks like an interviewer.",
    intro:
      "Hone is an AI mock interviewer for software engineers. It reads your resume, asks the questions a real loop would ask, and keeps pushing on your reasoning until you know exactly where you stand.",
    whyEyebrow: "Why we built it",
    whyTitle: "Interviews test how you think, not what you memorized.",
    whyBody: [
      "Technical interviews reward engineers who can explain trade-offs out loud, under pressure, while someone keeps asking “why?”. That is hard to practice alone, and question banks with model answers do not help much.",
      "Hone gives you that interviewer on demand: questions shaped by your own experience, follow-ups that dig into your answers, and honest feedback after every session, in English or Portuguese.",
    ],
    whatEyebrow: "What Hone does",
    features: [
      {
        title: "Built on your resume",
        body: "Upload your resume and pick a level, from entry to senior. Questions follow your stack and the projects you actually shipped.",
      },
      {
        title: "Live follow-ups",
        body: "The AI interviewer reacts to what you say and chases your reasoning: bottlenecks, trade-offs and depth.",
      },
      {
        title: "Speak or type",
        body: "Answer out loud with built-in speech-to-text, the way you would on a real video call, or type when you prefer.",
      },
      {
        title: "Feedback that turns into study",
        body: "Every session ends with a report. Weak spots become a review backlog by priority, so the next session starts where you need it.",
      },
    ],
    borderlessEyebrow: "Backed by Borderless Coding",
    borderlessTitle: "Part of a community that helps engineers work without borders.",
    borderlessBody:
      "Hone is built by Borderless Coding. You sign in with your Borderless account, and the same credentials unlock your interviews, feedback and progress.",
    borderlessLink: "Visit borderlesscoding.com",
    followLabel: "Follow Borderless Coding",
    ctaTitle: "Your next interview starts with one practice session.",
    cta: "Get started",
  },
  pt: {
    eyebrow: "Sobre o Hone",
    titleStart: "Treino de entrevista que",
    titleEmphasis: "pensa como um entrevistador.",
    intro:
      "O Hone é um entrevistador de IA para engenheiros de software. Ele lê seu currículo, faz as perguntas que uma entrevista de verdade faria e continua questionando seu raciocínio até você saber exatamente onde está.",
    whyEyebrow: "Por que criamos",
    whyTitle: "Entrevistas testam como você pensa, não o que você decorou.",
    whyBody: [
      "Entrevistas técnicas favorecem quem consegue explicar trade-offs em voz alta, sob pressão, enquanto alguém pergunta “por quê?”. Isso é difícil de treinar sozinho, e bancos de perguntas com respostas prontas ajudam pouco.",
      "O Hone coloca esse entrevistador à sua disposição: perguntas baseadas na sua experiência, follow-ups que aprofundam suas respostas e feedback honesto depois de cada sessão, em português ou inglês.",
    ],
    whatEyebrow: "O que o Hone faz",
    features: [
      {
        title: "Baseado no seu currículo",
        body: "Envie seu currículo e escolha o nível, de júnior a sênior. As perguntas seguem sua stack e os projetos que você realmente entregou.",
      },
      {
        title: "Follow-ups ao vivo",
        body: "O entrevistador de IA reage ao que você diz e aprofunda seu raciocínio: gargalos, trade-offs e profundidade.",
      },
      {
        title: "Fale ou digite",
        body: "Responda em voz alta com o speech-to-text integrado, como numa chamada de vídeo de verdade, ou digite quando preferir.",
      },
      {
        title: "Feedback que vira estudo",
        body: "Cada sessão termina com um relatório. Os pontos fracos viram um backlog de revisão por prioridade, para a próxima sessão começar onde você precisa.",
      },
    ],
    borderlessEyebrow: "Apoiado pela Borderless Coding",
    borderlessTitle: "Parte de uma comunidade que ajuda engenheiros a trabalhar sem fronteiras.",
    borderlessBody:
      "O Hone é feito pela Borderless Coding. Você entra com sua conta Borderless, e as mesmas credenciais liberam suas entrevistas, feedbacks e progresso.",
    borderlessLink: "Visitar borderlesscoding.com",
    followLabel: "Siga a Borderless Coding",
    ctaTitle: "Sua próxima entrevista começa com uma sessão de treino.",
    cta: "Começar",
  },
} as const;

export default function AboutContent() {
  const { locale } = useSiteLocale();
  const copy = COPY[locale === "pt" ? "pt" : "en"];

  return (
    <>
      <InfoHero
        eyebrow={copy.eyebrow}
        title={
          <>
            {copy.titleStart}{" "}
            <em className="italic">{copy.titleEmphasis}</em>
          </>
        }
        intro={copy.intro}
      />

      <section className="px-6 pb-[var(--section-gap)] md:px-10">
        <div className="mx-auto grid max-w-[1120px] gap-8 md:grid-cols-[1fr_1.2fr] md:gap-16">
          <div>
            <p className="landing-eyebrow">{copy.whyEyebrow}</p>
            <h2 className="landing-heading mt-3">{copy.whyTitle}</h2>
          </div>
          <div className="space-y-5 md:pt-8">
            {copy.whyBody.map((paragraph) => (
              <p key={paragraph} className="landing-body">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--surface-section-fog)] px-6 py-[var(--section-gap)] md:px-10">
        <div className="mx-auto max-w-[1120px]">
          <p className="landing-eyebrow text-center">{copy.whatEyebrow}</p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 md:mt-12">
            {copy.features.map((feature, index) => {
              const Icon = ICONS[index]!;
              return (
                <li key={feature.title} className="landing-artifact !p-6 md:!p-8">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-jade)]/10 text-[var(--color-jade)]"
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="manrope mt-5 text-lg font-medium text-ink-black">
                    {feature.title}
                  </h3>
                  <p className="manrope mt-2 text-[15px] leading-[1.55] text-slate-gray">
                    {feature.body}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="px-6 py-[var(--section-gap)] md:px-10">
        <div className="landing-jade-card mx-auto max-w-[1120px] !p-8 md:!p-12">
          <div className="flex items-center gap-3">
            <Image
              src={borderlessIcon}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-[10px] object-contain"
            />
            <p className="landing-eyebrow">{copy.borderlessEyebrow}</p>
          </div>
          <h2 className="landing-heading mt-5 max-w-3xl">{copy.borderlessTitle}</h2>
          <p className="landing-body mt-4 max-w-2xl">{copy.borderlessBody}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a
              href={BORDERLESS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="manrope text-[15px] font-medium text-jade-deep underline-offset-4 hover:underline"
            >
              {copy.borderlessLink} →
            </a>
            <div className="flex items-center gap-4">
              <span className="manrope text-sm text-slate-gray">
                {copy.followLabel}
              </span>
              {BORDERLESS_SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} — Borderless Coding`}
                  className="text-ink-black/70 transition-colors hover:text-ink-black"
                >
                  <Icon size={20} strokeWidth={1.5} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-[var(--section-gap)] text-center md:px-10">
        <h2 className="landing-heading mx-auto max-w-2xl">{copy.ctaTitle}</h2>
        <div className="mt-8 flex justify-center">
          <LandingCta label={copy.cta} variant="solid" size="lg" href="/login" />
        </div>
      </section>
    </>
  );
}
