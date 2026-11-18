import type { Metadata } from "next";

import { InfoPage } from "@/components/info/info-page";
import LegalContent from "@/components/info/legal-content";

export const metadata: Metadata = {
  title: "Terms of Use — Hone",
  description: "The terms that apply when you use Hone.",
};

export default function TermsPage() {
  return (
    <InfoPage>
      <LegalContent doc="terms" />
    </InfoPage>
  );
}
