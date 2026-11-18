"use client";

import Link from "next/link";

import { InfoHero } from "@/components/info/info-hero";
import { useSiteLocale } from "@/features/site-locale/site-locale-provider";

type LegalSection = { heading: string; body: string[]; list?: string[] };
type LegalDoc = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
};

const UPDATED = {
  en: "Last updated: November 18, 2026",
  pt: "Última atualização: 18 de novembro de 2026",
} as const;

const CONTACT = {
  en: { before: "Questions about this page? ", link: "Contact us", after: "." },
  pt: { before: "Dúvidas sobre esta página? ", link: "Fale com a gente", after: "." },
} as const;

const DOCS: Record<"terms" | "privacy", Record<"en" | "pt", LegalDoc>> = {
  privacy: {
    en: {
      eyebrow: "Legal",
      title: "Privacy Policy",
      intro:
        "Hone is a Borderless Coding product. This policy explains what we collect when you use Hone, why, and the choices you have.",
      sections: [
        {
          heading: "What we collect",
          body: ["We only collect what Hone needs to run your mock interviews:"],
          list: [
            "Account details from your Borderless account, such as your name and email.",
            "Resumes you upload, including the file and the text we extract from it.",
            "Your interview sessions: questions, your answers, feedback reports, topic coverage and review items.",
            "Voice answers, when you use speech-to-text. The audio is sent for transcription and Hone keeps only the resulting text, not the recording.",
            "Usage data, such as session counts, to apply fair-use limits and improve the product.",
          ],
        },
        {
          heading: "How we use it",
          body: [
            "We use your data to run interviews tailored to your resume, generate feedback and study material, keep your history in your dashboard, keep the service secure and understand how Hone is used so we can improve it. We do not sell your data.",
          ],
        },
        {
          heading: "Service providers",
          body: ["Some features rely on trusted providers that process data on our behalf:"],
          list: [
            "OpenAI, to generate interview questions, follow-ups and feedback.",
            "AssemblyAI, to transcribe voice answers into text.",
            "Cloudflare, to host the site and store uploaded resume files.",
            "PostHog, for product analytics.",
          ],
        },
        {
          heading: "Cookies and local storage",
          body: [
            "Hone stores your sign-in session and preferences, such as the site language, in your browser. Analytics may also set its own identifiers. You can clear them at any time in your browser settings, which signs you out.",
          ],
        },
        {
          heading: "Your choices",
          body: [
            "You can delete resumes, interview sessions and review items from inside the app at any time. To request a copy of your data or the deletion of your account, contact us and we will help you.",
          ],
        },
        {
          heading: "Changes",
          body: [
            "We may update this policy as Hone evolves. When we do, we change the date at the top of this page.",
          ],
        },
      ],
    },
    pt: {
      eyebrow: "Legal",
      title: "Política de Privacidade",
      intro:
        "O Hone é um produto da Borderless Coding. Esta política explica o que coletamos quando você usa o Hone, por quê, e quais escolhas você tem.",
      sections: [
        {
          heading: "O que coletamos",
          body: ["Coletamos apenas o que o Hone precisa para rodar suas entrevistas simuladas:"],
          list: [
            "Dados da sua conta Borderless, como nome e e-mail.",
            "Currículos que você envia, incluindo o arquivo e o texto extraído dele.",
            "Suas sessões de entrevista: perguntas, respostas, relatórios de feedback, cobertura de tópicos e itens de revisão.",
            "Respostas por voz, quando você usa o speech-to-text. O áudio é enviado para transcrição e o Hone guarda apenas o texto resultante, não a gravação.",
            "Dados de uso, como quantidade de sessões, para aplicar limites de uso justo e melhorar o produto.",
          ],
        },
        {
          heading: "Como usamos",
          body: [
            "Usamos seus dados para rodar entrevistas baseadas no seu currículo, gerar feedback e material de estudo, manter seu histórico no dashboard, proteger o serviço e entender como o Hone é usado para melhorá-lo. Não vendemos seus dados.",
          ],
        },
        {
          heading: "Prestadores de serviço",
          body: ["Alguns recursos dependem de parceiros que processam dados em nosso nome:"],
          list: [
            "OpenAI, para gerar perguntas, follow-ups e feedback.",
            "AssemblyAI, para transcrever respostas por voz em texto.",
            "Cloudflare, para hospedar o site e armazenar os arquivos de currículo.",
            "PostHog, para análise de uso do produto.",
          ],
        },
        {
          heading: "Cookies e armazenamento local",
          body: [
            "O Hone guarda sua sessão de login e preferências, como o idioma do site, no seu navegador. A ferramenta de análise também pode definir identificadores próprios. Você pode apagá-los quando quiser nas configurações do navegador, o que encerra sua sessão.",
          ],
        },
        {
          heading: "Suas escolhas",
          body: [
            "Você pode excluir currículos, sessões de entrevista e itens de revisão dentro do app a qualquer momento. Para pedir uma cópia dos seus dados ou a exclusão da sua conta, fale com a gente e vamos ajudar.",
          ],
        },
        {
          heading: "Alterações",
          body: [
            "Podemos atualizar esta política conforme o Hone evolui. Quando isso acontecer, mudamos a data no topo desta página.",
          ],
        },
      ],
    },
  },
  terms: {
    en: {
      eyebrow: "Legal",
      title: "Terms of Use",
      intro:
        "These terms apply when you use Hone, a Borderless Coding product. By using Hone you agree to them.",
      sections: [
        {
          heading: "Your account",
          body: [
            "You sign in to Hone with your Borderless account. Keep your credentials safe: you are responsible for activity on your account.",
          ],
        },
        {
          heading: "Using Hone",
          body: ["Hone is for practicing interviews. When using it, please don’t:"],
          list: [
            "Upload content you don’t have the right to share, or other people’s personal data.",
            "Try to break, overload or get around the limits of the service.",
            "Use Hone to build a competing product or to extract its prompts or data in bulk.",
          ],
        },
        {
          heading: "Your content",
          body: [
            "Your resumes and answers remain yours. You allow us to process them only to provide Hone to you, as described in the Privacy Policy.",
          ],
        },
        {
          heading: "AI feedback",
          body: [
            "Questions, scores and feedback are generated by AI. They are meant to help you practice and can be incomplete or wrong. Hone does not guarantee interview results or job offers.",
          ],
        },
        {
          heading: "Availability and limits",
          body: [
            "Hone is evolving. Features may change, and we apply usage limits to keep the service fair. We may suspend accounts that break these terms.",
          ],
        },
        {
          heading: "Liability",
          body: [
            "Hone is provided “as is”. To the extent allowed by law, Borderless Coding is not liable for indirect damages arising from the use of the service.",
          ],
        },
        {
          heading: "Changes",
          body: [
            "We may update these terms. When we do, we change the date at the top of this page. Continuing to use Hone means you accept the updated terms.",
          ],
        },
      ],
    },
    pt: {
      eyebrow: "Legal",
      title: "Termos de Uso",
      intro:
        "Estes termos valem quando você usa o Hone, um produto da Borderless Coding. Ao usar o Hone, você concorda com eles.",
      sections: [
        {
          heading: "Sua conta",
          body: [
            "Você entra no Hone com sua conta Borderless. Mantenha suas credenciais seguras: você é responsável pela atividade na sua conta.",
          ],
        },
        {
          heading: "Uso do Hone",
          body: ["O Hone serve para treinar entrevistas. Ao usá-lo, não:"],
          list: [
            "Envie conteúdo que você não tem direito de compartilhar, nem dados pessoais de outras pessoas.",
            "Tente quebrar, sobrecarregar ou contornar os limites do serviço.",
            "Use o Hone para criar um produto concorrente ou extrair seus prompts ou dados em massa.",
          ],
        },
        {
          heading: "Seu conteúdo",
          body: [
            "Seus currículos e respostas continuam sendo seus. Você nos permite processá-los apenas para oferecer o Hone a você, como descrito na Política de Privacidade.",
          ],
        },
        {
          heading: "Feedback de IA",
          body: [
            "Perguntas, notas e feedback são gerados por IA. Eles servem para ajudar no seu treino e podem estar incompletos ou errados. O Hone não garante resultado em entrevistas nem ofertas de emprego.",
          ],
        },
        {
          heading: "Disponibilidade e limites",
          body: [
            "O Hone está em evolução. Recursos podem mudar, e aplicamos limites de uso para manter o serviço justo. Podemos suspender contas que violem estes termos.",
          ],
        },
        {
          heading: "Responsabilidade",
          body: [
            "O Hone é oferecido “como está”. Na medida permitida por lei, a Borderless Coding não se responsabiliza por danos indiretos decorrentes do uso do serviço.",
          ],
        },
        {
          heading: "Alterações",
          body: [
            "Podemos atualizar estes termos. Quando isso acontecer, mudamos a data no topo desta página. Continuar usando o Hone significa aceitar os termos atualizados.",
          ],
        },
      ],
    },
  },
};

export default function LegalContent({ doc }: { doc: "terms" | "privacy" }) {
  const { locale } = useSiteLocale();
  const lang = locale === "pt" ? "pt" : "en";
  const copy = DOCS[doc][lang];
  const contact = CONTACT[lang];

  return (
    <>
      <InfoHero eyebrow={copy.eyebrow} title={copy.title} intro={copy.intro}>
        <p className="manrope mt-5 text-sm text-ash-gray">{UPDATED[lang]}</p>
      </InfoHero>
      <section className="px-6 pb-[var(--section-gap)] md:px-10">
        <div className="mx-auto max-w-[720px] space-y-10">
          {copy.sections.map((section, index) => (
            <div key={section.heading}>
              <h2 className="manrope text-xl font-medium text-ink-black">
                {index + 1}. {section.heading}
              </h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph}
                  className="manrope mt-3 text-[16px] leading-[1.65] text-slate-gray"
                >
                  {paragraph}
                </p>
              ))}
              {section.list ? (
                <ul className="mt-3 space-y-2">
                  {section.list.map((item) => (
                    <li
                      key={item}
                      className="manrope flex items-start gap-3 text-[16px] leading-[1.6] text-slate-gray"
                    >
                      <span
                        className="mt-[0.6rem] size-1.5 shrink-0 rounded-full bg-[var(--color-jade)]"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
          <p className="manrope border-t border-[var(--color-border-hairline)] pt-8 text-[15px] text-slate-gray">
            {contact.before}
            <Link
              href="/contact"
              className="font-medium text-jade-deep underline-offset-4 hover:underline"
            >
              {contact.link}
            </Link>
            {contact.after}
          </p>
        </div>
      </section>
    </>
  );
}
