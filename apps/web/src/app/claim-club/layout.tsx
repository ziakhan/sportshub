import type { Metadata, Viewport } from "next"
import { LaunchTracker } from "@/components/launch/launch-tracker"

/**
 * Bare layout for the pre-launch claim flow (owner 2026-08-17): the landing
 * page sends club operators here to claim their listing, and nothing else.
 * No site header, no pill row, no footer navigation — before launch the
 * claim flow must not hand a visitor the rest of the website to browse.
 * Sits at the top level like /demos for exactly that reason.
 */
export const metadata: Metadata = {
  title: "Claim your club",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function ClaimClubLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LaunchTracker />
      {children}
    </>
  )
}
