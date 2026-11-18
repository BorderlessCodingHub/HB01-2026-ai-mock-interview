import { ArrowUpRight } from "lucide-react";

import { BORDERLESS_SOCIALS } from "@/components/info/borderless-socials";

/** Large Instagram / LinkedIn cards used by Contact and Blog. */
export function SocialCards({ cta }: { cta: string }) {
  return (
    <ul className="mx-auto grid max-w-[760px] gap-5 sm:grid-cols-2">
      {BORDERLESS_SOCIALS.map(({ label, handle, href, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="landing-artifact group flex h-full flex-col !p-6 transition-transform hover:-translate-y-0.5 md:!p-8"
          >
            <div className="flex items-center justify-between">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-jade)]/10 text-[var(--color-jade)]"
                aria-hidden
              >
                <Icon className="h-5 w-5" />
              </span>
              <ArrowUpRight
                className="h-5 w-5 text-ash-gray transition-colors group-hover:text-ink-black"
                aria-hidden
              />
            </div>
            <p className="manrope mt-6 text-lg font-medium text-ink-black">
              {label}
            </p>
            <p className="manrope mt-1 text-[15px] text-slate-gray">{handle}</p>
            <p className="manrope mt-5 text-sm font-medium text-jade-deep">
              {cta}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}
