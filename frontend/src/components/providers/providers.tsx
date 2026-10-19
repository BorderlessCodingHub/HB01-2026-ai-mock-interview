"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { Toaster } from "@/components/ui/sonner";
import { AuthSessionProvider } from "@/features/auth/session-provider";
import { queryClient } from "@/lib/query-client";

import { ConfirmDialogProvider } from "./confirm-dialog-provider";
import { PostHogProvider } from "./posthog-provider";
import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    // The app has no dark UI (canvases are always white), so the theme is
    // forced. Otherwise a "theme" key left in localStorage by another app on
    // the shared labs.borderlesscoding.com origin applies `.dark` and turns
    // the text-text-* tokens near-white on white.
    <ThemeProvider
      attribute="class"
      forcedTheme="light"
      storageKey="hone-theme"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthSessionProvider>
          <PostHogProvider>
            <ConfirmDialogProvider>
              {children}
              <ReactQueryDevtools />
            </ConfirmDialogProvider>
          </PostHogProvider>
        </AuthSessionProvider>
      </QueryClientProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
