import type { Metadata } from "next"
import { DemoLanesPreview } from "./lanes-preview"

/**
 * DEV PREVIEW ONLY (owner review, 2026-08-19): the reorganized demo directory.
 *
 * The ruling being previewed: "who are you" becomes the front door of /demos.
 * Three large doors in the MAIN PANEL (not chips on top); picking one shows a
 * short numbered path of four or five demos in a deliberate order with a
 * plain "what you'll watch" line under each title, and the rest of that
 * audience's demos folded underneath. All thirteen stay one tap away.
 *
 * Nothing here is wired into /demos. If the owner approves the look, the
 * gallery itself adopts it and /demos/clubs·/leagues·/families deep links
 * open their lane directly.
 */

export const metadata: Metadata = {
  title: "Demo lanes preview",
  robots: { index: false, follow: false },
}

export default function DemoLanesPreviewPage() {
  return <DemoLanesPreview />
}
