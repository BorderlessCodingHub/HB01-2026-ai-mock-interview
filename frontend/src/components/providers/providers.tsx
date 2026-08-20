"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { Toaster } from "@/components/ui/sonner";
import { AuthSessionProvider } from "@/features/auth/session-provider";
import { queryClient } from "@/lib/query-client";

import { ConfirmDialogProvider } from "./confirm-dialog-provider";
import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthSessionProvider>
          <ConfirmDialogProvider>
            {children}
            <ReactQueryDevtools />
          </ConfirmDialogProvider>
        </AuthSessionProvider>
      </QueryClientProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
