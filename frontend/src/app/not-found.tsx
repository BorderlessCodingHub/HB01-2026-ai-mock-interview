import type { Metadata } from "next";
import { Compass } from "lucide-react";

import { AppEmptyState } from "@/components/app/app-empty-state";

import { NotFoundCta } from "./not-found-cta";

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
        action={<NotFoundCta />}
      />
    </div>
  );
}
