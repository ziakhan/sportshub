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
          <div className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#101c36] via-[#1b2a4a] to-[#0d1526] px-6 pb-6 pt-7 text-white">
              {/* Same shaded basketball as the welcome modal, small in the
                  corner — the drawer was still wearing the old concentric-
                  circle mark, which read as a target (tester 2026-08-13).
                  Own gradient id: both can be mounted at once. */}
              <svg
                className="pointer-events-none absolute -right-6 -top-8 h-36 w-36 opacity-[0.55]"
                viewBox="0 0 200 200"
                aria-hidden
              >
                <defs>
                  <radialGradient id="sh-ball-drawer" cx="34%" cy="28%" r="78%">
                    <stop offset="0%" stopColor="#fde68a" />
                    <stop offset="45%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#9a3412" />
                  </radialGradient>
                </defs>
                <circle cx="100" cy="100" r="90" fill="url(#sh-ball-drawer)" />
                <g
                  fill="none"
                  stroke="#7c2d12"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  opacity="0.85"
                >
                  <path d="M100 10v180" />
                  <path d="M10 100h180" />
                  <path d="M42 31c36 34 36 104 0 138" />
                  <path d="M158 31c-36 34-36 104 0 138" />
                </g>
                <ellipse
                  cx="68"
                  cy="58"
                  rx="26"
                  ry="17"
                  fill="#fffbeb"
                  opacity="0.22"
                  transform="rotate(-28 68 58)"
                />
              </svg>
              <div className="relative flex items-start justify-between gap-3">
                <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-amber-950">
                  Launching this fall
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-white/70 hover:text-white text-sm font-semibold"
                >
                  Close ✕
                </button>
              </div>
              <h2 className="relative mt-3 text-2xl font-black leading-tight">
                Pick your seat <span className="text-amber-400">in the gym.</span>
              </h2>
              <p className="relative mt-2 text-sm leading-6 text-white/80">
                Step into the live season with real screens and a real schedule.
                {signedIn ? "" : " You'll create a free account first."}
              </p>
            </div>
            <div className="flex flex-col gap-4 p-5">
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
              Everything here is preview data and resets nightly. Your account and anything
              real you add are never touched.
            </p>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
