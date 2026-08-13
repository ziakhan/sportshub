"use client"

import { useState } from "react"

/**
 * Home-page welcome (owner rulings 2026-08-13): server-rendered open so it
 * paints with the first HTML; BIGGER; "this fall" loud; one line for
 * everybody; and the role picker is STEP TWO of the same modal (no drawer
 * hop) with the registration ask stated plainly. "Demo" is downplayed in
 * visitor copy — this is "experience the live season".
 */

const ROLES: { key: string; title: string; blurb: string; soon?: boolean }[] = [
  { key: "parent", title: "Parent", blurb: "Your kids, one calendar, live games." },
  { key: "player", title: "Player", blurb: "Your team, your stats, your season." },
  { key: "coach", title: "Coach", blurb: "Roster, RSVPs, chat, game day." },
  { key: "club", title: "Club owner", blurb: "Teams, tryouts, offers, payments." },
  { key: "league", title: "League", blurb: "Schedule, standings, playoffs." },
  { key: "referee", title: "Referee", blurb: "Shifts and sign-offs.", soon: true },
  { key: "trainer", title: "Trainer", blurb: "Listings and bookings.", soon: true },
  { key: "media", title: "Photo & video", blurb: "Shoot and tag the games.", soon: true },
]

export function WelcomePopup() {
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState<1 | 2>(1)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-label="Welcome">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
        {/* Court hero — shared by both steps */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#101c36] via-[#1b2a4a] to-[#0d1526] px-8 pb-8 pt-9 text-white sm:px-10">
          <svg
            className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 opacity-25"
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
          <p className="relative inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-black uppercase tracking-[0.14em] text-amber-950 shadow">
            Launching this fall
          </p>
          {step === 1 ? (
            <>
              <h2 className="relative mt-4 text-4xl font-black leading-tight sm:text-5xl">
                A whole season,
                <br />
                <span className="text-amber-400">already live.</span>
              </h2>
              <p className="relative mt-4 max-w-md text-[15px] leading-7 text-white/85">
                Scores, schedules, standings and stories — see exactly what your season here
                will feel like.
              </p>
            </>
          ) : (
            <>
              <h2 className="relative mt-4 text-3xl font-black leading-tight sm:text-4xl">
                Pick your seat <span className="text-amber-400">in the gym.</span>
              </h2>
              <p className="relative mt-3 max-w-md text-[15px] leading-7 text-white/85">
                Choose a role and step into the live season. You&apos;ll create a free account
                first — it takes a minute, and it&apos;s ready when the real season starts.
              </p>
            </>
          )}
        </div>

        {step === 1 ? (
          <div className="p-7 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-2xl bg-amber-500 px-6 py-4 text-[17px] font-bold text-amber-950 shadow-md transition hover:bg-amber-400"
              >
                Experience the live season →
              </button>
              <button
                onClick={() => setOpen(false)}
                className="border-ink-200 text-ink-700 hover:border-ink-400 rounded-2xl border px-6 py-4 text-[17px] font-semibold transition"
              >
                Look around first
              </button>
            </div>
            <p className="text-ink-400 mt-4 text-center text-[13px]">
              Looking around is open to everyone — no account needed.
            </p>
          </div>
        ) : (
          <div className="p-7 sm:p-8">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {ROLES.map((r) =>
                r.soon ? (
                  <div
                    key={r.key}
                    className="border-ink-100 rounded-2xl border bg-white p-3.5 opacity-60"
                  >
                    <span className="text-ink-900 block text-[15px] font-bold">{r.title}</span>
                    <span className="text-ink-500 mt-0.5 block text-xs leading-4">{r.blurb}</span>
                    <span className="text-ink-500 mt-2 inline-block rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                      Coming soon
                    </span>
                  </div>
                ) : (
                  <a
                    key={r.key}
                    href={`/demo/start?persona=${r.key}`}
                    className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md"
                  >
                    <span className="text-ink-950 block text-[15px] font-bold">{r.title}</span>
                    <span className="text-ink-600 mt-0.5 block text-xs leading-4">{r.blurb}</span>
                    <span className="mt-2 inline-block text-[12px] font-bold text-amber-700">
                      Start free →
                    </span>
                  </a>
                )
              )}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="text-ink-500 hover:text-ink-800 text-sm font-semibold"
              >
                ← Back
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-500 hover:text-ink-800 text-sm font-semibold"
              >
                Just look around
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
