"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Public-site demo chrome (limited-launch-demo-build-2026-08.md §4):
 * the first-visit welcome pop-up and the always-visible right-edge Demo
 * drawer. Rendered only when the platform demo switch is on (the server
 * layout gates the mount). Copy follows the world spec / owner rulings.
 */

const SEEN_KEY = "sh-demo-welcome-seen"

const PERSONAS: { key: string; title: string; blurb: string; soon?: boolean }[] = [
  { key: "parent", title: "Demo as a parent", blurb: "Two kids, one calendar, live games, an offer waiting." },
  { key: "player", title: "Demo as a player", blurb: "Your team, your stats, your season." },
  { key: "coach", title: "Demo as a coach", blurb: "Your roster, RSVPs, team chat, game day." },
  { key: "club", title: "Demo as a club owner", blurb: "Teams, tryouts, offers, and getting paid." },
  { key: "league", title: "Demo as a league", blurb: "The season console: teams, schedule, standings, playoffs." },
  { key: "referee", title: "Demo as a referee", blurb: "Shifts, assignments, scoresheet sign-off.", soon: true },
  { key: "trainer", title: "Demo as a trainer", blurb: "Your listings, bookings, and clients.", soon: true },
  { key: "media", title: "Demo as a photographer or videographer", blurb: "Shoot the games, tag the players.", soon: true },
]

export function DemoChrome({ signedIn, inDemoSession = false }: { signedIn: boolean; inDemoSession?: boolean }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [entering, setEntering] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // The SSR welcome pop-up (welcome-popup.tsx) asks us to open the
    // drawer via this event — it can't reach our state directly.
    const open = () => setDrawerOpen(true)
    window.addEventListener("sh-open-demo-drawer", open)
    return () => window.removeEventListener("sh-open-demo-drawer", open)
  }, [])

  async function enterDemo(persona: string) {
    setEntering(persona)
    try {
      const res = await fetch("/api/demo/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        window.location.href = data.landing || "/dashboard"
        return
      }
      if (res.status === 401) {
        // Signup is the gate (owner ruling). Come back here after.
        window.location.href = `/sign-up?callbackUrl=${encodeURIComponent(`/demo/start?persona=${persona}`)}`
        return
      }
      setEntering(null)
    } catch {
      setEntering(null)
    }
  }

  return (
    <>
      {/* Right-edge drawer tab — unmissable by design (owner ruling). */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-2xl bg-amber-500 px-2.5 py-6 text-sm font-bold uppercase tracking-[0.14em] text-amber-950 shadow-lg hover:bg-amber-400"
        style={{ writingMode: "vertical-rl" }}
        aria-label="Open the demo"
      >
        Try the demo
      </button>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Try the demo">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col gap-4 overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Preview</p>
                <h2 className="text-ink-950 mt-1 text-xl font-bold">Try the full app</h2>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-ink-400 hover:text-ink-600 text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <p className="text-ink-500 text-sm leading-6">
              Step into a role and use SportsHub with demo data: real screens, a real season,
              nothing to set up. {signedIn ? "" : "You'll create a free account first."}
            </p>
            <div className="flex flex-col gap-3">
              {PERSONAS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => !p.soon && enterDemo(p.key)}
                  disabled={entering !== null || p.soon}
                  className={
                    p.soon
                      ? "border-ink-100 cursor-default rounded-2xl border bg-white p-4 text-left opacity-70"
                      : "rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-left transition hover:border-amber-400 disabled:opacity-60"
                  }
                >
                  <span className="text-ink-950 flex items-center gap-2 font-bold">
                    {entering === p.key ? "Starting…" : p.title}
                    {p.soon && (
                      <span className="text-ink-500 rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                        Coming soon
                      </span>
                    )}
                  </span>
                  <span className="text-ink-500 mt-0.5 block text-sm">{p.blurb}</span>
                </button>
              ))}
            </div>
            <p className="text-ink-400 text-xs leading-5">
              Everything in the demo is artificial data and resets nightly. Your account and
              anything real you add are never touched.
            </p>
          </div>
        </div>
      )}

    </>
  )
}
