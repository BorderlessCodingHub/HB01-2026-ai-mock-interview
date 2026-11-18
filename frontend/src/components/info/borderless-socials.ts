import { Instagram, Linkedin, type LucideIcon } from "lucide-react";

export type SocialLink = {
  label: string;
  handle: string;
  href: string;
  Icon: LucideIcon;
};

/** Hone is a Borderless Coding product; these are its official channels for now. */
export const BORDERLESS_SOCIALS: SocialLink[] = [
  {
    label: "Instagram",
    handle: "@borderlesscoding",
    href: "https://www.instagram.com/borderlesscoding",
    Icon: Instagram,
  },
  {
    label: "LinkedIn",
    handle: "Borderless Coding",
    href: "https://www.linkedin.com/company/borderless-coding",
    Icon: Linkedin,
  },
];
