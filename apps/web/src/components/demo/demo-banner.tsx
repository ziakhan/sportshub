"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

const PERSONA_LABEL: Record<string, string> = {
  parent: "Sam, a parent of two",
  player: "Marcus, a Grade 10 player",
  coach: "Coach Dre",
  club: "Jordan, a club owner",
  league: "Alex, the league operator",
}

/**
 * Frames every screen while a persona demo session is active
 * (limited-launch-demo-build-2026-08.md §2). Mirrors the impersonation
 * banner pattern; amber = the demo colour everywhere.
 */
export function DemoBanner({ personaKey }: { personaKey: string }) {
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)

  async function exitDemo() {
    setLeaving(true)
    try {
      await fetch("/api/demo/exit", { method: "POST" })
    } finally {
      router.push("/")
      router.refresh()
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950">
      <span>
        You&apos;re exploring the demo as {PERSONA_LABEL[personaKey] ?? "a demo user"} · demo data
      </span>
      <button
        onClick={exitDemo}
        disabled={leaving}
        className="rounded bg-amber-700 px-3 py-1 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-60"
      >
        {leaving ? "Leaving…" : "Exit demo"}
      </button>
    </div>
  )
}
