"use client";

import { toast } from "sonner";

import { cn } from "@/lib/utils";

import {
  useInterviewLocale,
  type InterviewLocale,
} from "./use-interview-locale";

const OPTIONS: { value: InterviewLocale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "pt", label: "PT" },
];

export function InterviewLocaleSelector() {
  const { locale, setLocale, isReady } = useInterviewLocale();

  async function handleSelect(next: InterviewLocale) {
    if (!isReady || next === locale) return;
    try {
      await setLocale(next);
    } catch {
      toast.error("Failed to update interview language");
    }
  }

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold text-text-base">
        Interview language
      </legend>
      <div className="grid grid-cols-2 gap-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={!isReady}
            onClick={() => void handleSelect(opt.value)}
            aria-pressed={locale === opt.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border px-1 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
              locale === opt.value
                ? "border-jade bg-jade-mist font-semibold text-jade-deep"
                : "border-border-hairline bg-paper-white text-ink-black hover:bg-mist-gray",
              !isReady && "pointer-events-none cursor-not-allowed opacity-50",
            )}
          >
            <span className="text-xs">{opt.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
