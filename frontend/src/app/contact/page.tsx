import type { Metadata } from "next";

import ContactContent from "@/components/info/contact-content";
import { InfoPage } from "@/components/info/info-page";

export const metadata: Metadata = {
  title: "Contact — Hone",
  description: "Talk to the Borderless Coding team behind Hone on Instagram or LinkedIn.",
};

export default function ContactPage() {
  return (
    <InfoPage>
      <ContactContent />
    </InfoPage>
  );
}
