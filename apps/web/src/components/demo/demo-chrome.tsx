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

const PERSONAS: { key: string; title: string; blurb: string }[] = [
  { key: "parent", title: "Demo as a parent", blurb: "Two kids, one calendar, live games, an offer waiting." },
  { key: "coach", title: "Demo as a coach", blurb: "Your roster, RSVPs, team chat, game day." },
  { key: "club", title: "Demo as a club owner", blurb: "Teams, tryouts, offers, and getting paid." },
]

export function DemoChrome({ signedIn }: { signedIn: boolean }) {
  const [popupOpen, setPopupOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [entering, setEntering] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setPopupOpen(true)
    } catch {
      // Storage unavailable — skip the pop-up rather than nag every page.
    }
  }, [])

  function dismissPopup() {
    try {
      localStorage.setItem(SEEN_KEY, "1")
    } catch {}
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
                  onClick={() => enterDemo(p.key)}
                  disabled={entering !== null}
                  className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-left transition hover:border-amber-400 disabled:opacity-60"
                >
                  <span className="text-ink-950 block font-bold">
                    {entering === p.key ? "Starting…" : p.title}
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

      {/* First-visit welcome pop-up */}
      {popupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-label="Welcome">
          <div className="absolute inset-0 bg-black/50" onClick={dismissPopup} />
          <div className="relative w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Welcome</p>
            <h2 className="text-ink-950 mt-2 text-2xl font-bold">Welcome to SportsHub</h2>
            <p className="text-ink-600 mt-3 text-sm leading-6">
              We launch this fall with our first leagues. Until then, this whole site is an open
              preview: browse a complete season, scores, standings, news, even live games.
            </p>
            <p className="text-ink-600 mt-2 text-sm leading-6">
              Want to try the real thing? Create a free account and experience the full app as a
              parent, coach, or club owner, with demo data. When the season starts, your account
              will be ready.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={dismissPopup}
                className="border-ink-200 text-ink-700 hover:border-ink-400 rounded-xl border px-4 py-2.5 text-sm font-semibold"
              >
                Look around
              </button>
              <button
                onClick={() => {
                  dismissPopup()
                  setDrawerOpen(true)
                }}
                className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-amber-950 hover:bg-amber-400"
              >
                Try the demo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
