import Image from "next/image";

import borderlessIcon from "@/assets/borderless-icon.png";

const BORDERLESS_URL = "https://www.borderlesscoding.com/en";

export default function BackedByBadge({ className }: { className?: string }) {
  return (
    <a
      href={BORDERLESS_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Backed by Borderless — opens borderlesscoding.com in a new tab"
      className={`manrope inline-flex items-center gap-2 rounded-full bg-ink-black px-4 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.18)] transition-opacity hover:opacity-80 ${className ?? ""}`}
    >
      <span className="text-xs text-white/55">Backed by</span>
      <Image
        src={borderlessIcon}
        alt=""
        width={20}
        height={20}
        className="h-5 w-5 shrink-0 rounded-[6px] object-contain"
      />
      <span className="text-sm font-medium text-white">Borderless</span>
    </a>
  );
}
