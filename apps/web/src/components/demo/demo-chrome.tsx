"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

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
  const [popupOpen, setPopupOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [entering, setEntering] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Owner ruling 2026-08-13: the pop-up greets the HOME PAGE only, for
    // signed-out visitors only, on every load (frequency tuned later —
    // SEEN_KEY plumbing stays ready). The drawer stays everywhere.
    if (!inDemoSession && !signedIn && pathname === "/") setPopupOpen(true)
    else setPopupOpen(false)
  }, [inDemoSession, signedIn, pathname])

  function dismissPopup() {
    setPopupOpen(false)
  }

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

      {/* First-visit welcome pop-up — the wow version (owner 2026-08-13):
          court hero, two lines of copy, persona chips, two bold moves. */}
      {popupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-label="Welcome">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismissPopup} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-2xl">
            {/* Court hero */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#101c36] via-[#1b2a4a] to-[#0d1526] px-8 pb-8 pt-9 text-white">
              {/* Center-court arcs */}
              <svg
                className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 opacity-25"
                viewBox="0 0 200 200"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                aria-hidden
              >
                <circle cx="100" cy="100" r="96" />
                <circle cx="100" cy="100" r="58" />
                <circle cx="100" cy="100" r="14" fill="#f59e0b" stroke="none" opacity="0.9" />
                <path d="M4 100h192" />
              </svg>
              <svg
                className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 opacity-15"
                viewBox="0 0 100 100"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="50" cy="50" r="48" />
                <path d="M50 2c18 14 18 82 0 96M2 50c14-18 82-18 96 0" />
              </svg>
              <p className="relative text-[11px] font-bold uppercase tracking-[0.22em] text-amber-400">
                Preview season · Launching this fall
              </p>
              <h2 className="relative mt-2 text-3xl font-black leading-tight sm:text-4xl">
                A whole season,
                <br />
                <span className="text-amber-400">already live.</span>
              </h2>
              <p className="relative mt-3 max-w-sm text-sm leading-6 text-white/80">
                Real screens, live games ticking right now, standings, playoffs, the works —
                all demo data, all yours to explore.
              </p>
            </div>

            {/* Moves */}
            <div className="p-6">
              <div className="mb-5 flex flex-wrap gap-1.5">
                {["Parents", "Players", "Coaches", "Clubs", "Leagues"].map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-200"
                  >
                    {r}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <button
                  onClick={() => {
                    dismissPopup()
                    setDrawerOpen(true)
                  }}
                  className="flex-1 rounded-2xl bg-amber-500 px-5 py-3.5 text-[15px] font-bold text-amber-950 shadow-md transition hover:bg-amber-400"
                >
                  Try it as a parent, player, or club →
                </button>
                <button
                  onClick={dismissPopup}
                  className="border-ink-200 text-ink-700 hover:border-ink-400 rounded-2xl border px-5 py-3.5 text-[15px] font-semibold transition"
                >
                  Just look around
                </button>
              </div>
              <p className="text-ink-400 mt-4 text-center text-xs">
                When the real season starts, your account is ready.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
