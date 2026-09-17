"use client";

import HeroSection from "@/components/landing/sections/hero-section";
import SocialProofSection from "@/components/landing/sections/social-proof-section";
import FeaturesSection from "@/components/landing/sections/features-section";
import ChatDemoSection from "@/components/landing/sections/chat-demo-section";
import QuoteSection from "@/components/landing/sections/quote-section";
import LandingCtaSection from "@/components/landing/sections/landing-cta-section";
import LandingFooter from "@/components/landing/landing-footer";

export default function LandingSections() {
  return (
    <>
      <HeroSection />
      <SocialProofSection />
      <FeaturesSection />
      <ChatDemoSection />
      <QuoteSection />
      <LandingCtaSection />
      <LandingFooter />
    </>
  );
}
