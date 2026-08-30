import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";

import { AppEmptyState } from "@/components/app/app-empty-state";

export const metadata: Metadata = {
  title: "Page not found — Hone",
};

export default function NotFound() {
  return (
    <div className="app-canvas manrope flex min-h-dvh items-center justify-center bg-paper-white px-6 text-ink-black">
      <AppEmptyState
        headingLevel={1}
        icon={<Compass className="h-6 w-6" aria-hidden="true" />}
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Link
            href="/"
            className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-jade-deep bg-jade-deep px-5 text-sm font-medium text-paper-white transition-colors hover:border-ink-black hover:bg-ink-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-deep"
          >
            Back to home
          </Link>
        }
      />
    </div>
  );
}
