"use client";

import { ComingSoonBadge } from "@/components/coming-soon-badge";
import { InfoHero } from "@/components/info/info-hero";
import { SocialCards } from "@/components/info/social-cards";
import { useSiteLocale } from "@/features/site-locale/site-locale-provider";

const COPY = {
  en: {
    eyebrow: "Blog",
    title: "Interview notes are on the way.",
    intro:
      "We’re writing about system design, behavioral rounds and how to practice out loud. Until the first posts are up, follow Borderless Coding for tips and updates.",
    cta: "Follow →",
  },
  pt: {
    eyebrow: "Blog",
    title: "Conteúdo sobre entrevistas a caminho.",
    intro:
      "Estamos escrevendo sobre system design, entrevistas comportamentais e como treinar em voz alta. Até os primeiros posts saírem, siga a Borderless Coding para dicas e novidades.",
    cta: "Seguir →",
  },
} as const;

export default function BlogContent() {
  const { locale } = useSiteLocale();
  const copy = COPY[locale === "pt" ? "pt" : "en"];

  return (
    <>
      <InfoHero eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro}>
        <div className="mt-6 flex justify-center">
          <ComingSoonBadge />
        </div>
      </InfoHero>
      <section className="px-6 pb-[var(--section-gap)] md:px-10">
        <SocialCards cta={copy.cta} />
      </section>
    </>
  );
}
