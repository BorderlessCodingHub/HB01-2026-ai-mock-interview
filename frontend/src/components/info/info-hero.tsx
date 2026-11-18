import * as React from "react";

/** Page heading with the same jade wash as the landing hero. */
export function InfoHero({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden px-6 pb-14 pt-32 md:px-10 md:pb-20 md:pt-44">
      <div
        className="landing-jade-wash pointer-events-none absolute inset-0"
        aria-hidden
      />
      <div className="relative mx-auto max-w-[880px] text-center">
        <p className="landing-eyebrow">{eyebrow}</p>
        <h1 className="instrument-serif mt-4 text-[clamp(2.6rem,6vw,72px)] font-normal leading-[1.08] tracking-[-0.025em] text-ink-black text-balance">
          {title}
        </h1>
        {intro ? (
          <p className="landing-body mx-auto mt-6 max-w-2xl">{intro}</p>
        ) : null}
        {children}
      </div>
    </section>
  );
}
