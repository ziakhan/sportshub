import type { Metadata, Viewport } from "next"
import { DemoConsole } from "./console"

/**
 * Bare layout for the demo console (owner ruling 2026-08-15).
 *
 * The directory used to live under the (public) route group, so every
 * walkthrough played inside the site header, pill row, footer and bottom tabs.
 * The owner's verdict: a demo is a recording, and the navigation belongs INSIDE
 * the recording. So this segment sits at the top level with no chrome at all,
 * no SiteHeader, no footer, no bottom tabs, no chat dock. The console owns the
 * whole viewport: a rail on the left, a stage on the right.
 *
 * The console shell lives in the LAYOUT rather than in each page, which is what
 * keeps the search box and the audience filter alive while the viewer moves
 * from demo to demo. Pages render only what goes on the stage.
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
  return <DemoConsole>{children}</DemoConsole>
}
