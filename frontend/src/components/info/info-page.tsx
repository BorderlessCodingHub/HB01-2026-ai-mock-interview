import * as React from "react";

import LandingFooter from "@/components/landing/landing-footer";
import LandingNavbar from "@/components/landing/landing-navbar";
import { getSiteLocale } from "@/features/site-locale/get-site-locale";
import { SiteLocaleProvider } from "@/features/site-locale/site-locale-provider";

/** Server wrapper shared by About, Contact, Blog, Terms and Privacy. */
export async function InfoPage({ children }: { children: React.ReactNode }) {
  // Read on the server so PT visitors get Portuguese HTML (no EN flash).
  const locale = await getSiteLocale();

  return (
    <SiteLocaleProvider initialLocale={locale}>
      <div className="landing-canvas">
        <LandingNavbar />
        <main>{children}</main>
        <LandingFooter />
      </div>
    </SiteLocaleProvider>
  );
}
