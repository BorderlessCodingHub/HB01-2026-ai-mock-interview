import type { Metadata } from "next";

import AboutContent from "@/components/info/about-content";
import { InfoPage } from "@/components/info/info-page";

export const metadata: Metadata = {
  title: "About Hone — AI mock interviews for software engineers",
  description:
    "Hone is an AI mock interviewer built by Borderless Coding. It reads your resume, asks real follow-ups and turns feedback into a study plan.",
};

export default function AboutPage() {
  return (
    <InfoPage>
      <AboutContent />
    </InfoPage>
  );
}
