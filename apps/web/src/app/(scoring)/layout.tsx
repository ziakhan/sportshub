import React from "react"
import type { Metadata, Viewport } from "next"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"

// Add-to-Home-Screen launches the console standalone — no browser chrome at
// all (the real "full screen" on iPhones, where the fullscreen API is absent).
export const metadata: Metadata = {
  title: "Scoring",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Scoring" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

/**
 * Bare layout for the scorer's-table console: signed-in required, but NO
 * sidebar, top nav, or footer — the scoring surface owns the whole screen
 * (docs/live-scoring-design.md). The console adds a browser-fullscreen
 * toggle on top of this.
 */
export default async function ScoringLayout({ children }: { children: React.ReactNode }) {
  const dbUser = await getCurrentUser()
  if (!dbUser) redirect("/sign-in")
  return (
    // viewport-fit=cover extends under the notch/Dynamic Island; these
    // env() paddings pull the content back into the safe area on every edge.
    // 100dvh (not 100vh): iOS Safari's 100vh is the toolbar-HIDDEN height,
    // which forces a phantom scroll of empty background while bars show.
    <div className="bg-ink-50 min-h-[100dvh] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
      {children}
    </div>
  )
}
