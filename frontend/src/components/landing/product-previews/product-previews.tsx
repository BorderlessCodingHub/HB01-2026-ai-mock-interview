"use client";

import { useSiteLocale } from "@/features/site-locale/site-locale-provider";

function FeedbackPreview() {
  const { t } = useSiteLocale();
  const report = t.previews.report;
  return (
    <div className="landing-artifact !p-6 md:!p-8">
      <p className="landing-tag mb-1">{report.tag}</p>
      <h4 className="manrope mb-6 text-xl font-medium md:text-[22px] text-[var(--color-ink-black)]">
        {report.title}
      </h4>

      <div className="mb-5 grid grid-cols-3 gap-4 rounded-[16px] bg-[var(--color-mist-gray)] p-4">
        {report.metrics.map((m) => (
          <div key={m.label} className="text-center">
            <p className="manrope text-lg font-medium text-[var(--color-ink-black)]">
              {m.value}
            </p>
            <p className="landing-tag mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <p className="landing-tag mb-2">{report.strengthsTag}</p>
        <ul className="space-y-1.5">
          {report.strengths.map((s) => (
            <li
              key={s}
              className="manrope flex items-start gap-2 text-sm text-[var(--color-ink-black)] md:text-[15px]"
            >
              <span className="text-[var(--color-ash-gray)]" aria-hidden>
                +
              </span>
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="landing-tag mb-2">{report.growthTag}</p>
        <ul className="space-y-1.5">
          {report.growthAreas.map((g) => (
            <li
              key={g}
              className="manrope flex items-start gap-2 text-sm text-[var(--color-ink-black)] md:text-[15px]"
            >
              <span className="text-[var(--color-ash-gray)]" aria-hidden>
                →
              </span>
              {g}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ProductPreviews() {
  const { t } = useSiteLocale();
  return (
    <div className="mt-24 md:mt-32">
      <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
        <p className="landing-eyebrow">{t.previews.eyebrow}</p>
        <h3 className="landing-heading mt-4">
          {t.previews.title}
        </h3>
      </div>

      {/* The progress dashboard lives in its own landing section; the demo only shows the per-session report. */}
      <div className="mx-auto max-w-[680px]">
        <p className="landing-tag mb-3">{t.previews.feedbackTag}</p>
        <FeedbackPreview />
      </div>
    </div>
  );
}
