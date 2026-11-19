"use client";

import { useEffect, useState } from "react";
import { Check, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

export type ResumeProcessingPhase = "uploading" | "processing" | "ready";

const STEPS = [
  "Uploading your file",
  "Reading your experience",
  "Collecting your skills and projects",
  "Building your interview profile",
] as const;

const STEP_MS = 1500;
const PROGRESS = [18, 45, 70, 88] as const;

function useCurrentStep(phase: ResumeProcessingPhase): number {
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    if (phase !== "processing") return;
    const timer = setInterval(() => setTicks((t) => t + 1), STEP_MS);
    return () => clearInterval(timer);
  }, [phase]);

  if (phase === "uploading") return 0;
  if (phase === "ready") return STEPS.length;
  return Math.min(1 + ticks, STEPS.length - 1);
}

/** Upload-card panel that walks the user through resume processing. */
export function ResumeProcessingPanel({
  fileName,
  phase,
}: {
  fileName: string;
  phase: ResumeProcessingPhase;
}) {
  const reduceMotion = useReducedMotion();
  const step = useCurrentStep(phase);
  const isReady = phase === "ready";
  const progress = isReady
    ? 100
    : PROGRESS[Math.min(step, PROGRESS.length - 1)];

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center gap-6 rounded-2xl border border-jade/30 bg-paper-white p-6 sm:flex-row sm:items-start sm:p-8"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
        {!isReady && !reduceMotion && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-3xl bg-jade/20"
            animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-jade-pale">
          <AnimatePresence mode="wait" initial={false}>
            {isReady ? (
              <motion.div
                key="done"
                initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
              >
                <CheckCircle2 className="h-10 w-10 text-jade-deep" />
              </motion.div>
            ) : (
              <motion.div
                key="doc"
                exit={
                  reduceMotion
                    ? undefined
                    : { scale: 0.6, opacity: 0, transition: { duration: 0.15 } }
                }
                animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <FileText className="h-9 w-9 text-jade-deep" />
              </motion.div>
            )}
          </AnimatePresence>
          {!isReady && !reduceMotion && (
            <motion.span
              aria-hidden
              className="absolute inset-x-3 h-0.5 rounded-full bg-jade shadow-[0_0_10px_var(--color-jade)]"
              initial={{ top: "20%" }}
              animate={{ top: ["20%", "80%", "20%"] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}
        </div>
      </div>

      <div className="w-full min-w-0 flex-1">
        <p className="text-center text-base font-semibold text-ink-black sm:text-left">
          {isReady ? "Your resume is ready!" : "Analyzing your resume"}
        </p>
        <p className="mt-0.5 truncate text-center text-xs text-text-base sm:text-left">
          {fileName}
        </p>

        <ol className="mt-4 space-y-2">
          {STEPS.map((label, index) => {
            const done = index < step;
            const current = index === step && !isReady;
            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-2.5 text-sm transition-colors duration-300",
                  done && "text-ink-black",
                  current && "font-medium text-jade-deep",
                  !done && !current && "text-text-base/60",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                    done && "border-jade-deep bg-jade-deep text-white",
                    current && "border-jade bg-jade-pale",
                    !done && !current && "border-border-hairline",
                  )}
                  aria-hidden
                >
                  {done ? (
                    <motion.span
                      initial={reduceMotion ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 20,
                      }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </motion.span>
                  ) : current ? (
                    <Loader2 className="h-3 w-3 animate-spin text-jade-deep" />
                  ) : null}
                </span>
                {label}
              </li>
            );
          })}
        </ol>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-jade-pale">
          <motion.div
            className="relative h-full overflow-hidden rounded-full bg-jade"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
          >
            {!isReady && !reduceMotion && (
              <motion.span
                aria-hidden
                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                animate={{ x: ["-100%", "250%"] }}
                transition={{
                  duration: 1.3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )}
          </motion.div>
        </div>
        <p className="mt-2 text-center text-xs text-text-base sm:text-left">
          {isReady
            ? "You can start a practice interview with it now."
            : "This takes just a few seconds."}
        </p>
      </div>
    </motion.div>
  );
}
