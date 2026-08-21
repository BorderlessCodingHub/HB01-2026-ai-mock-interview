import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

type StudySelectionBarProps = {
  selectedCount: number;
  onStart: () => void;
  isStarting?: boolean;
  quotaExhausted?: boolean;
  quotaHint?: ReactNode;
};

export function StudySelectionBar({
  selectedCount,
  onStart,
  isStarting = false,
  quotaExhausted = false,
  quotaHint,
}: StudySelectionBarProps) {
  const isDisabled = selectedCount === 0 || isStarting || quotaExhausted;

  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-border-hairline bg-paper-white/95 px-4 py-3 backdrop-blur-sm md:-mx-6 md:px-6">
      <div className="flex items-end justify-between gap-4">
        <p className="text-sm text-text-base">{selectedCount} selected</p>
        <div className="flex flex-col items-end gap-1.5">
          {quotaHint}
          <button
            type="button"
            onClick={onStart}
            disabled={isDisabled}
            aria-busy={isStarting}
            className="flex min-w-[5.5rem] cursor-pointer items-center justify-center gap-1.5 rounded-full bg-jade-deep px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-black disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
          >
            {isStarting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Starting…
              </>
            ) : (
              "Start review session"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
