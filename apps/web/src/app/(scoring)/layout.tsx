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
  return <div className="bg-ink-50 min-h-screen">{children}</div>
}
