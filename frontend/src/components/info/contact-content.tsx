"use client";

import { InfoHero } from "@/components/info/info-hero";
import { SocialCards } from "@/components/info/social-cards";
import { useSiteLocale } from "@/features/site-locale/site-locale-provider";

const COPY = {
  en: {
    eyebrow: "Contact",
    title: "Talk to the team behind Hone.",
    intro:
      "Questions, feedback or ideas for Hone? Send a message to Borderless Coding on Instagram or LinkedIn. We read everything.",
    cta: "Send a message →",
    accountTitle: "Trouble signing in?",
    accountBody:
      "Hone uses your Borderless account. If you can’t sign in, mention the email you use with Borderless in your message so we can find your account faster.",
  },
  pt: {
    eyebrow: "Contato",
    title: "Fale com o time por trás do Hone.",
    intro:
      "Dúvidas, feedback ou ideias para o Hone? Mande uma mensagem para a Borderless Coding no Instagram ou no LinkedIn. A gente lê tudo.",
    cta: "Enviar mensagem →",
    accountTitle: "Problemas para entrar?",
    accountBody:
      "O Hone usa sua conta Borderless. Se não conseguir entrar, informe na mensagem o e-mail que você usa na Borderless para encontrarmos sua conta mais rápido.",
  },
} as const;

export default function ContactContent() {
  const { locale } = useSiteLocale();
  const copy = COPY[locale === "pt" ? "pt" : "en"];

  return (
    <>
      <InfoHero eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro} />
      <section className="px-6 pb-[var(--section-gap)] md:px-10">
        <SocialCards cta={copy.cta} />
        <div className="mx-auto mt-12 max-w-[760px] rounded-[20px] border border-[var(--color-border-hairline)] p-6 md:p-8">
          <h2 className="manrope text-lg font-medium text-ink-black">
            {copy.accountTitle}
          </h2>
          <p className="manrope mt-2 text-[15px] leading-[1.55] text-slate-gray">
            {copy.accountBody}
          </p>
        </div>
      </section>
    </>
  );
}
