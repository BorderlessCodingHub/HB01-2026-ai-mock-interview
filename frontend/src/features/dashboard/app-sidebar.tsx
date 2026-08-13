"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  Dumbbell,
  MessageSquare,
  LogOut,
  FileText,
  User,
  HelpCircle,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/session-provider";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", tour: undefined },
  { icon: Dumbbell, label: "Practice", href: "/practice", tour: "tour-nav-practice" },
  { icon: MessageSquare, label: "Feedback", href: "/feedback", tour: "tour-nav-feedback" },
  { icon: BookOpen, label: "Study", href: "/study", tour: "tour-nav-study" },
  { icon: FileText, label: "Resumes", href: "/resumes", tour: "tour-nav-resumes" },
  { icon: User, label: "Profile", href: "/profile", tour: undefined },
  { icon: HelpCircle, label: "How to use", href: "/dashboard?tour=1", tour: undefined },
] as const;

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/study") {
    return (
      pathname === "/study" ||
      pathname.startsWith("/study/") ||
      pathname === "/review-session" ||
      pathname.startsWith("/review-session/")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

type AppSidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const mobileDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const dialog = mobileDialogRef.current;
    if (!dialog) {
      return;
    }

    const getFocusableElements = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

    const closeButton = dialog.querySelector<HTMLElement>(
      "[data-drawer-close]",
    );
    (closeButton ?? dialog).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      if (
        event.shiftKey &&
        (document.activeElement === firstElement ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === lastElement ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const sidebar = (
    <aside className="manrope flex h-full w-60 shrink-0 flex-col border-r border-border-hairline bg-fog-white text-ink-black">
      <div className="flex items-start justify-between px-6 pt-6 pb-8">
        <div>
          <p className="instrument-serif text-2xl font-normal tracking-tight text-ink-black">
            Hone
          </p>
          <p className="mt-1 text-xs text-text-base">AI Interview Expert</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 -mr-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-text-base transition-colors hover:bg-mist-gray hover:text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-deep focus-visible:ring-offset-2 md:hidden"
            aria-label="Close navigation"
            data-drawer-close
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="App navigation">
        {NAV_ITEMS.map(({ icon: Icon, label, href, tour }) => {
          const active = isNavItemActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              data-tour={tour}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-deep focus-visible:ring-offset-2",
                active
                  ? "bg-jade-mist font-medium text-jade-deep"
                  : "text-text-base hover:bg-mist-gray hover:text-ink-black",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-border-hairline px-3 pt-4 pb-6">
        <Link
          href="/practice"
          onClick={onClose}
          className="manrope inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-(--radius-buttons) border border-jade-deep bg-jade-deep px-5 text-base font-normal text-paper-white transition-colors hover:bg-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-deep focus-visible:ring-offset-2"
        >
          <Dumbbell className="h-4 w-4" aria-hidden="true" />
          Start Practice
        </Link>
        {user && (
          <p className="truncate px-2 text-xs text-text-base" title={user.name}>
            {user.name}
          </p>
        )}
        <button
          type="button"
          onClick={logout}
          className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-base transition-colors hover:bg-mist-gray hover:text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-deep focus-visible:ring-offset-2"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{sidebar}</div>

      {/* Mobile drawer overlay */}
      {isOpen && (
        <div
          ref={mobileDialogRef}
          id="app-mobile-navigation"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="App navigation"
          tabIndex={-1}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose?.();
            }
          }}
        >
          <div className="absolute inset-y-0 left-0 flex">{sidebar}</div>
        </div>
      )}
    </>
  );
}
