"use client";

import Link from "next/link";

import { BORDERLESS_SOCIALS } from "@/components/info/borderless-socials";
import { useSiteLocale } from "@/features/site-locale/site-locale-provider";

const LINKS = {
  product: [
    { key: "features", href: "/#features" },
    { key: "demo", href: "/#demo" },
  ],
  company: [
    { key: "about", href: "/about" },
    { key: "blog", href: "/blog" },
    { key: "contact", href: "/contact" },
  ],
  legal: [
    { key: "terms", href: "/terms" },
    { key: "privacy", href: "/privacy" },
  ],
} as const;

type LinkGroup = keyof typeof LINKS;


export default function LandingFooter() {
  const year = new Date().getFullYear();
  const { t } = useSiteLocale();

  return (
    <footer className="border-t border-[var(--color-border-hairline)] bg-[var(--color-paper-white)] px-6 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="instrument-serif text-[30px] font-normal text-[var(--color-ink-black)]"
              aria-label={t.common.homeAriaLabel}
            >
              Hone
            </Link>
            <p className="manrope mt-4 max-w-sm text-base leading-relaxed text-[var(--color-slate-gray)]">
              {t.footer.tagline}
            </p>
            <div className="mt-6 flex items-center gap-5">
              {BORDERLESS_SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} — Borderless Coding`}
                  className="text-[var(--color-ash-gray)] transition-colors hover:text-[var(--color-ink-black)]"
                >
                  <Icon size={20} strokeWidth={1.5} />
                </a>
              ))}
            </div>
          </div>

          {(Object.keys(LINKS) as LinkGroup[]).map((group) => (
            <div key={group}>
              <p className="landing-eyebrow mb-5">{t.footer.groups[group]}</p>
              <ul className="space-y-3">
                {LINKS[group].map(({ key, href }) => (
                  <li key={key}>
                    <Link
                      href={href}
                      className="manrope text-[15px] text-[var(--color-slate-gray)] transition-colors md:text-base hover:text-[var(--color-ink-black)]"
                    >
                      {t.footer.links[key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[var(--color-border-hairline)] pt-8 md:flex-row">
          <p className="manrope text-sm text-[var(--color-ash-gray)]">
            © {year} {t.footer.rights}
          </p>
          <p className="manrope text-sm text-[var(--color-smoke-gray)]">
            {t.footer.builtFor}
          </p>
        </div>
      </div>
    </footer>
  );
}
