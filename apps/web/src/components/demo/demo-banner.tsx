"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { roleForPersona } from "@/lib/demo/persona-role"

const PERSONA_LABEL: Record<string, string> = {
  parent: "Sam, a parent of two",
  player: "Marcus, a Grade 10 player",
  coach: "Coach Dre",
  club: "Jordan, a club owner",
  league: "Alex, the league operator",
}

/** Client-readable twin of the signed demo cookie, set by /api/demo/enter. */
function personaFromHint(): string | null {
  if (typeof document === "undefined") return null
  const hit = document.cookie.split("; ").find((c) => c.startsWith("demo-view-hint="))
  return hit ? decodeURIComponent(hit.slice("demo-view-hint=".length)) || null : null
}

/**
 * Frames every screen while a persona demo session is active
 * (limited-launch-demo-build-2026-08.md §2). Mirrors the impersonation
 * banner pattern; amber = the demo colour everywhere.
 *
 * Exit carries the answer forward (owner 2026-08-13): someone who walked the
 * demo as a player has told us what they are, so an account that has not
 * finished setup leaves straight into /onboarding?role=Player instead of being
 * asked the same question a second time. Finished accounts leave as before.
 */
export function DemoBanner({
  personaKey,
  realUserOnboarded = true,
}: {
  personaKey: string
  realUserOnboarded?: boolean
}) {
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)

  async function exitDemo() {
    setLeaving(true)
    try {
      await fetch("/api/demo/exit", { method: "POST" })
    } catch {
      // The cookie clears server-side or it doesn't; either way, leave.
    }

    if (!realUserOnboarded) {
      const role = roleForPersona(personaKey || personaFromHint())
      // A full load, not a router push: the demo cookie just changed and every
      // server layout has to re-read it.
      window.location.href = role ? `/onboarding?role=${encodeURIComponent(role)}` : "/onboarding"
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950">
      <span>
        You&apos;re exploring the demo as {PERSONA_LABEL[personaKey] ?? "a demo user"} · demo data
      </span>
      <button
        onClick={exitDemo}
        disabled={leaving}
        className="cursor-pointer rounded bg-amber-700 px-3 py-1 text-xs font-bold text-white transition-colors duration-200 hover:bg-amber-800 disabled:opacity-60"
      >
        {leaving ? "Leaving…" : "Exit demo"}
      </button>
    </div>
  )
}
