"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { Toaster } from "@/components/ui/sonner";
import { AuthSessionProvider } from "@/features/auth/session-provider";
import { queryClient } from "@/lib/query-client";

import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="ami-theme"
    >
      <QueryClientProvider client={queryClient}>
        <AuthSessionProvider>
          {children}
          <ReactQueryDevtools />
        </AuthSessionProvider>
      </QueryClientProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
