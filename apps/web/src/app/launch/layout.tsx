import type { Metadata, Viewport } from "next"

/**
 * Bare layout for the soft-launch homepage (owner host-split call,
 * 2026-08-17): the brand apex (sportshubone.com) serves this page at its
 * root via a middleware rewrite, while the test domain keeps the classic
 * homepage. The page carries its own header and footer, so no site chrome.
 *
 * Metadata mirrors the classic homepage: to search engines "/" is still
 * one page with one canonical, whichever body a host serves.
 */
export const metadata: Metadata = {
  title: { absolute: "SportsHub One | Youth Basketball Clubs, Leagues, Camps & Live Scores" },
  description:
    "Find youth basketball clubs, leagues, camps and tryouts near you. Live scores, standings, stat leaders and game recaps.",
  alternates: { canonical: "/" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function LaunchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
