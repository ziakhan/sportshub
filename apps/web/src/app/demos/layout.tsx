import type { Metadata, Viewport } from "next"

/**
 * Bare layout for the demo surface (owner rulings 2026-08-15).
 *
 * The directory used to live under the (public) route group, so every
 * walkthrough played inside the site header, pill row, footer and bottom tabs.
 * The owner's verdict: a demo is a recording, and the navigation belongs INSIDE
 * the recording. So this segment sits at the top level with no chrome at all,
 * no SiteHeader, no footer, no bottom tabs, no chat dock.
 *
 * The second ruling killed the persistent rail that used to live here. There is
 * nothing to hold between pages any more: /demos is a gallery, /demos/<slug> is
 * a player that owns the whole viewport, and each page paints its own court. So
 * the layout carries the metadata and gets out of the way.
 */
export const metadata: Metadata = {
  title: "Product demos",
  description:
    "Watch how clubs, leagues and families use SportsHub. Short walkthroughs of the real screens, no account needed.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function DemosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
