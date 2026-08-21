import { EnvBanner } from "@/components/env-banner"
import type { Metadata } from "next"
import Script from "next/script"
import { Outfit, Work_Sans, Barlow_Condensed, Barlow } from "next/font/google"
import AuthProvider from "./session-provider"
import { siteUrl, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site"
import { PRIMARY_DOMAIN } from "@/lib/domains"
import { JsonLd, siteGraph } from "@/lib/seo/jsonld"
import { isSeoIndexingEnabled, getThemePalette } from "@/lib/platform-settings"
import { paletteCssVars } from "@youthbasketballhub/design-tokens"
import "./globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
})

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"],
})

// Athletic display + body pair, scoped to the customizable club/league pages
// (referenced via `font-condensed` / `font-barlow`, not the app-global fonts).
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-condensed",
  weight: ["500", "600", "700"],
})

const barlow = Barlow({
  subsets: ["latin"],
  variable: "--font-barlow",
  weight: ["400", "500", "600", "700"],
})

export async function generateMetadata(): Promise<Metadata> {
  // Site-wide noindex until the owner flips the indexing switch in admin
  // settings (seo-strategy §9). Child pages inherit robots unless they set
  // their own — thin-shell club pages set noindex themselves, which is the
  // same outcome either way.
  const indexingEnabled = await isSeoIndexingEnabled()
  const envPrefix = process.env.NEXT_PUBLIC_ENV_LABEL
    ? `[${process.env.NEXT_PUBLIC_ENV_LABEL.toUpperCase()}] `
    : ""
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      // The env label is set on staging only, so a staging tab never looks
      // like the real site in a crowded browser window.
      default: envPrefix + SITE_NAME,
      // Detail pages set their own title; this suffixes index/browse pages.
      template: `${envPrefix}%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    ...(indexingEnabled ? {} : { robots: { index: false, follow: false } }),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      locale: "en_CA",
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
    },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Admin-chosen palette (Energy Pass) — stamped as CSS vars so the semantic
  // Tailwind colors (energy/stage/highlight + brand) reskin without a rebuild.
  const palette = await getThemePalette()
  return (
    <html lang="en" data-palette={palette.id} style={paletteCssVars(palette) as React.CSSProperties}>
      <body
        className={`${outfit.variable} ${workSans.variable} ${barlowCondensed.variable} ${barlow.variable} font-body`}
      >
        <JsonLd data={siteGraph()} />
        <EnvBanner />
        <AuthProvider>{children}</AuthProvider>
        {/* GA4 — inert until NEXT_PUBLIC_GA_ID is set (build-time env).
            Ads signals/personalization disabled: youth-sports audience
            (privacy posture per seo-strategy; revisit at US/COPPA entry).
            One build serves every domain, so the loader itself checks the
            hostname: only the brand domain reports (owner 2026-08-17), and
            the test domain and localhost stay out of the stats. */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <Script id="ga4-init" strategy="afterInteractive">
            {`if (location.hostname === '${PRIMARY_DOMAIN}' || location.hostname.endsWith('.${PRIMARY_DOMAIN}')) {
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('set', 'allow_google_signals', false);
                gtag('set', 'allow_ad_personalization_signals', false);
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
                var s = document.createElement('script');
                s.async = true;
                s.src = 'https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}';
                document.head.appendChild(s);
              }`}
          </Script>
        )}
      </body>
    </html>
  )
}
