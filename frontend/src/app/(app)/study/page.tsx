"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { AppShell } from "@/features/dashboard/app-shell";
import { StudyHubShell } from "@/features/study/study-hub-shell";

export default function StudyPage() {
  return (
    <AppShell noPadding={true}>
      <Suspense
        fallback={
          <div className="flex h-dvh items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-jade-deep" />
            <span className="text-sm text-text-base">Loading Study…</span>
          </div>
        }
      >
        <StudyHubShell />
      </Suspense>
    </AppShell>
  );
}
