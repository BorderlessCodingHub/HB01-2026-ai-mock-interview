"use client";

import HeroSection from "@/components/landing/sections/hero-section";
import FeaturesSection from "@/components/landing/sections/features-section";
import ChatDemoSection from "@/components/landing/sections/chat-demo-section";
import DashboardSection from "@/components/landing/sections/dashboard-section";
import InstallAppSection from "@/components/landing/sections/install-app-section";
import StoryVideoSection from "@/components/landing/sections/story-video-section";
import VoiceAnswerSection from "@/components/landing/sections/voice-answer-section";
import LandingCtaSection from "@/components/landing/sections/landing-cta-section";
import LandingFooter from "@/components/landing/landing-footer";

export default function LandingSections() {
  return (
    <>
      <HeroSection />
      {/* Disabled for now: "Trusted by engineers at" logos strip. */}
      {/* <SocialProofSection /> */}
      <StoryVideoSection />
      <FeaturesSection />
      <ChatDemoSection />
      <VoiceAnswerSection />
      <DashboardSection />
      <InstallAppSection />
      <LandingCtaSection />
      <LandingFooter />
    </>
  );
}
