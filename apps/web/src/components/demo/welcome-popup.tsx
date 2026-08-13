"use client"

import { useState } from "react"

/**
 * The home-page welcome pop-up (owner rulings 2026-08-13: home page only,
 * signed-out only, every load, visible WITHIN A SECOND). Rendered
 * server-side by the home page with initial state OPEN, so it paints with
 * the first HTML — no waiting on hydration. The buttons hydrate a moment
 * later; the visual lands instantly.
 */
export function WelcomePopup() {
  const [open, setOpen] = useState(true)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-label="Welcome">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#101c36] via-[#1b2a4a] to-[#0d1526] px-8 pb-8 pt-9 text-white">
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
                setOpen(false)
                window.dispatchEvent(new CustomEvent("sh-open-demo-drawer"))
              }}
              className="flex-1 rounded-2xl bg-amber-500 px-5 py-3.5 text-[15px] font-bold text-amber-950 shadow-md transition hover:bg-amber-400"
            >
              Try it as a parent, player, or club →
            </button>
            <button
              onClick={() => setOpen(false)}
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
  )
}
