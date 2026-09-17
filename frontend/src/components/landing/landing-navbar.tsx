"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import LandingCta from "@/components/landing/get-started-button";

const NAV_LINKS = [
  { label: "Product", href: "/#features" },
  { label: "How it works", href: "/#demo" },
];

const SCROLL_THRESHOLD = 24;

export default function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled || open
          ? "border-b border-border-hairline bg-paper-white"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav
        className="landing-container flex h-16 items-center justify-between"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="instrument-serif text-2xl font-normal tracking-tight text-[var(--color-ink-black)]"
          aria-label="Hone home"
        >
          Hone
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="manrope text-base font-normal text-[var(--color-ink-black)] transition-opacity hover:opacity-60"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center md:flex">
          <LandingCta label="Get started" variant="solid" href="/login" />
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-ink-black)] md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <X size={22} strokeWidth={1.5} />
          ) : (
            <Menu size={22} strokeWidth={1.5} />
          )}
        </button>
      </nav>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-[var(--color-border-hairline)] bg-[var(--color-paper-white)] px-6 py-6 md:hidden"
        >
          <div className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="manrope text-base text-[var(--color-ink-black)]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <LandingCta
              label="Get started"
              variant="solid"
              href="/login"
              className="mt-2 w-full"
            />
          </div>
        </div>
      ) : null}
    </header>
  );
}
