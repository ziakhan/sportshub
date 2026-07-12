import type { Metadata } from "next"
import { Outfit, Work_Sans, Barlow_Condensed, Barlow } from "next/font/google"
import AuthProvider from "./session-provider"
import { siteUrl, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site"
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

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: SITE_NAME,
    // Detail pages set their own title; this suffixes index/browse pages.
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${workSans.variable} ${barlowCondensed.variable} ${barlow.variable} font-body`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
