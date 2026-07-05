import React from "react"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"

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
