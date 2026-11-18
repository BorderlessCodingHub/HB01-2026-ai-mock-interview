import type { Metadata } from "next";

import BlogContent from "@/components/info/blog-content";
import { InfoPage } from "@/components/info/info-page";

export const metadata: Metadata = {
  title: "Blog — Hone",
  description: "Interview notes from Hone are coming soon.",
};

export default function BlogPage() {
  return (
    <InfoPage>
      <BlogContent />
    </InfoPage>
  );
}
