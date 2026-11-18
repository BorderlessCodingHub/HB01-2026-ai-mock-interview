import type { Metadata } from "next";

import { InfoPage } from "@/components/info/info-page";
import LegalContent from "@/components/info/legal-content";

export const metadata: Metadata = {
  title: "Privacy Policy — Hone",
  description: "What Hone collects, why, and the choices you have.",
};

export default function PrivacyPage() {
  return (
    <InfoPage>
      <LegalContent doc="privacy" />
    </InfoPage>
  );
}
