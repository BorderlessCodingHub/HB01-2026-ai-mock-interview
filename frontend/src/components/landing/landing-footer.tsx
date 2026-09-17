import Link from "next/link";
import { Github, Twitter, Linkedin } from "lucide-react";

const LINKS = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "Demo", href: "/#demo" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "mailto:hello@honeyourcraft.com" },
  ],
  Legal: [
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
  ],
};

const SOCIALS = [
  { label: "GitHub", href: "https://github.com", Icon: Github },
  { label: "Twitter / X", href: "https://x.com", Icon: Twitter },
  { label: "LinkedIn", href: "https://linkedin.com", Icon: Linkedin },
];

export default function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-border-hairline)] bg-[var(--color-paper-white)] px-6 py-16 md:py-20">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Link
              href="/"
              className="instrument-serif text-2xl font-normal text-[var(--color-ink-black)]"
              aria-label="Hone home"
            >
              Hone
            </Link>
            <p className="manrope mt-4 max-w-sm text-sm leading-relaxed text-[var(--color-slate-gray)]">
              Sharpen the thinking that interviews actually test.
            </p>
            <div className="mt-6 flex items-center gap-4">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="text-[var(--color-ash-gray)] transition-colors hover:text-[var(--color-ink-black)]"
                >
                  <Icon size={18} strokeWidth={1.5} />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(LINKS).map(([group, links]) => (
            <div key={group}>
              <p className="landing-tag mb-4">{group}</p>
              <ul className="space-y-3">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="manrope text-sm text-[var(--color-slate-gray)] transition-colors hover:text-[var(--color-ink-black)]"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[var(--color-border-hairline)] pt-8 md:flex-row">
          <p className="manrope text-xs text-[var(--color-ash-gray)]">
            © {year} Hone. All rights reserved.
          </p>
          <p className="manrope text-xs text-[var(--color-smoke-gray)]">
            Built for engineers who take their craft seriously.
          </p>
        </div>
      </div>
    </footer>
  );
}
