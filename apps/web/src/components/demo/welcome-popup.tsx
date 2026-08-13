"use client"

import { useState } from "react"

/**
 * Home-page welcome (owner rulings 2026-08-13): server-rendered open so it
 * paints with the first HTML; BIGGER; "this fall" loud; one line for
 * everybody; and the role picker is STEP TWO of the same modal (no drawer
 * hop) with the registration ask stated plainly.
 *
 * ⚠ OWNER-RULING CONFLICT (tester 2026-08-13): the ruling above said "demo"
 * should be DOWNPLAYED in visitor copy ("experience the live season"). The
 * tester's read is the opposite — demo language sets the right expectation
 * (you're being shown a working product, not signed up for one) and the
 * drawer tab already says "Try the demo", so downplaying it here was
 * inconsistent. CTA now reads "Try the live demo". Needs owner sign-off.
 */

/**
 * The six promises (2026-08-13). Was a 30-item checkmark wall; research —
 * the "feature-rich showcase" pattern (4-6 cards, one message each), modal
 * cognitive-load findings, and the category leaders (TeamSnap shows 3,
 * SportsEngine 5, both benefit-led) — all say a first-visit modal converts
 * on a short outcome list, not a spec sheet. The exhaustive list belongs on
 * a feature page. Labels lead with the terms families and operators actually
 * search (live scores, calendar, registration, payments, scheduling,
 * standings, playoffs) so the copy earns its SEO keep too.
 */
const PROMISES: { title: string; proof: string; icon: JSX.Element }[] = [
  {
    title: "Live scores & stats",
    proof: "Box scores, play-by-play, player stats",
    icon: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  },
  {
    title: "One family calendar",
    proof: "RSVPs, practices, instant alerts",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2.5" />
        <path d="M3 10.5h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    title: "Registration & payments",
    proof: "Tryouts, offers, waivers, installments",
    icon: (
      <>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
        <path d="M2.5 10.5h19" />
      </>
    ),
  },
  {
    title: "Team chat",
    proof: "Coaches and parents, one thread",
    icon: <path d="M20 11.5a7 7 0 0 1-7 7H8l-4 3v-6.2a7 7 0 0 1 7-9.3h2a7 7 0 0 1 7 5.5Z" />,
  },
  {
    title: "Automatic scheduling",
    proof: "A whole season in one click",
    icon: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
  },
  {
    title: "Standings & playoffs",
    proof: "Brackets, right through to a champion",
    icon: (
      <>
        <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0V4Z" />
        <path d="M7.5 6H5a2.5 2.5 0 0 0 2.5 3M16.5 6H19a2.5 2.5 0 0 1-2.5 3" />
        <path d="M12 13.5V17M9 20h6" />
      </>
    ),
  },
]

/**
 * Second tier (2026-08-13): grey on purpose — it needs CONTRAST against the
 * amber promise tiles, not a smaller copy of them (an icon-tile version read
 * as the same thing twice). Between this list and the six proof lines above,
 * every capability the old thirty-item wall claimed is still represented.
 */
const ALSO_INCLUDED = [
  "Player pages",
  "Club pages",
  "Game recaps",
  "Stat leaders",
  "Rosters",
  "Divisions",
  "Referee assignments",
  "Announcements",
  "Follows",
  "Stories",
  "E-transfers",
]

/**
 * Step two (2026-08-13). Was eight cards, three of them dead "coming soon"
 * boxes that stranded League — a live persona — in a row of disabled ones.
 * Now the five that actually work.
 *
 * ONE accent, not five (tester call): per-persona colours only earn their
 * keep if the product uses them consistently elsewhere, and it doesn't — a
 * parent is not "green" anywhere in SportsHub, so five hues fragmented a
 * small modal for decoration. Amber is the demo's own identity (drawer tab,
 * badge, CTAs); the icons carry the differentiation.
 */
const ROLES: {
  key: string
  title: string
  blurb: string
  icon: JSX.Element
}[] = [
  {
    key: "parent",
    title: "Parent",
    blurb: "Your kids, one calendar, live games.",
    icon: (
      <>
        <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M8 14c-3 0-5 1.5-5 4v1h10v-1c0-2.5-2-4-5-4Z" />
        <path d="M16 13c2.2 0 4 1.1 4 3v1h-4" />
      </>
    ),
  },
  {
    key: "player",
    title: "Player",
    blurb: "Your team, your stats, your season.",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5a14 14 0 0 1 0 17M12 3.5a14 14 0 0 0 0 17M3.5 12h17" />
      </>
    ),
  },
  {
    key: "coach",
    title: "Coach",
    blurb: "Roster, RSVPs, chat, game day.",
    icon: (
      <>
        <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
        <path d="M9 3.5h6v3H9z" />
        <path d="M9 11h6M9 15h4" />
      </>
    ),
  },
  {
    key: "club",
    title: "Club owner",
    blurb: "Teams, tryouts, offers, payments.",
    icon: (
      <>
        <path d="M3 10 12 4l9 6" />
        <path d="M5 10v9.5h14V10" />
        <path d="M9.5 19.5V14h5v5.5" />
      </>
    ),
  },
  {
    key: "league",
    title: "League",
    blurb: "Schedule, standings, playoffs.",
    icon: (
      <>
        <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0V4Z" />
        <path d="M7.5 6H5a2.5 2.5 0 0 0 2.5 3M16.5 6H19a2.5 2.5 0 0 1-2.5 3" />
        <path d="M12 13.5V17M9 20h6" />
      </>
    ),
  },
]

/** Not built yet — one flagged line, not three dead cards. */
const COMING_SOON = "Referee, trainer and photographer demos are on the way."

export function WelcomePopup() {
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState<1 | 2>(1)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-label="Welcome">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[32px] bg-white shadow-2xl">
        {/* Court hero — shared by both steps */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#101c36] via-[#1b2a4a] to-[#0d1526] px-8 pb-8 pt-9 text-white sm:px-10">
          {/* A shaded basketball, bleeding off the corner (tester 2026-08-13 —
              line-art court diagrams read as noise here). Radial shading plus
              a specular highlight give it volume against the navy. */}
          <svg
            className="pointer-events-none absolute -right-10 -top-14 h-56 w-56 opacity-[0.55] sm:h-64 sm:w-64"
            viewBox="0 0 200 200"
            aria-hidden
          >
            <defs>
              <radialGradient id="sh-ball" cx="34%" cy="28%" r="78%">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="45%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#9a3412" />
              </radialGradient>
            </defs>
            <circle cx="100" cy="100" r="90" fill="url(#sh-ball)" />
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
            {/* specular highlight */}
            <ellipse cx="68" cy="58" rx="26" ry="17" fill="#fffbeb" opacity="0.22" transform="rotate(-28 68 58)" />
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
                Real scores, schedules, standings and stories from a full youth basketball
                season. Look around freely, or try it as a parent, coach or league.
              </p>
            </>
          ) : (
            <>
              <h2 className="relative mt-4 text-3xl font-black leading-tight sm:text-4xl">
                Which one <span className="text-amber-400">are you?</span>
              </h2>
              <p className="relative mt-3 max-w-md text-[15px] leading-7 text-white/85">
                Pick a role and try the demo as them. You&apos;ll make a free account first —
                a minute, and it&apos;s ready for the real season.
              </p>
            </>
          )}
        </div>

        {step === 1 ? (
          <div className="p-7 sm:p-8">
            <p className="text-ink-400 font-condensed mb-4 text-[12px] font-bold uppercase tracking-[0.18em]">
              Everything a season needs
            </p>
            <div className="mb-6 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              {PROMISES.map((f, i) => (
                <div
                  key={f.title}
                  className="reveal flex items-start gap-3.5"
                  style={{ animationDelay: `${i * 55}ms` }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200/70">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      {f.icon}
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="text-ink-900 block text-[16px] font-bold leading-5">
                      {f.title}
                    </span>
                    <span className="text-ink-500 mt-1 block text-[13.5px] leading-5">
                      {f.proof}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            {/* Second tier: same visual language as the promises, one size
                down — tile, icon, label, no proof line. Hierarchy comes from
                SIZE, not from draining the colour out (the grey-chip version
                read as leftovers). */}
            <div className="reveal mb-6" style={{ animationDelay: "300ms" }}>
              <p className="text-ink-400 font-condensed mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.18em]">
                Also included
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALSO_INCLUDED.map((x) => (
                  <span
                    key={x}
                    className="bg-ink-50 text-ink-700 ring-ink-200/70 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold leading-none ring-1 ring-inset"
                  >
                    {x}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-2xl bg-amber-500 px-6 py-4 text-[17px] font-bold text-amber-950 shadow-md transition hover:bg-amber-400"
              >
                Try the live demo →
              </button>
              <button
                onClick={() => setOpen(false)}
                className="border-ink-200 text-ink-700 hover:border-ink-400 rounded-2xl border px-6 py-4 text-[17px] font-semibold transition"
              >
                Look around first
              </button>
            </div>
            <p className="text-ink-400 mt-4 text-center text-[13px]">
              Looking around is open to everyone, no account needed.
            </p>
          </div>
        ) : (
          <div className="p-7 sm:p-8">
            {/* The choice sits on its own tinted panel so it reads as one
                deliberate group, and flex-wrap centres the rows — five cards
                in a 3-col grid leave an orphan, and that orphan was League. */}
            <div className="border-amber-200/60 bg-amber-50/60 rounded-[22px] border p-3 sm:p-3.5">
              <div className="flex flex-wrap justify-center gap-2.5">
                {ROLES.map((r, i) => (
                  <a
                    key={r.key}
                    href={`/demo/start?persona=${r.key}`}
                    className="group reveal relative basis-[calc(50%-0.32rem)] rounded-2xl border border-amber-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-lg sm:basis-[calc(33.333%-0.67rem)]"
                    style={{ animationDelay: `${i * 55}ms` }}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200/70 transition group-hover:bg-amber-500 group-hover:text-white group-hover:ring-amber-500">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        {r.icon}
                      </svg>
                    </span>
                    <span className="text-ink-950 mt-3 block text-[15.5px] font-bold leading-5">
                      {r.title}
                    </span>
                    <span className="text-ink-500 mt-1 block text-[12.5px] leading-4">
                      {r.blurb}
                    </span>
                    <span
                      className="absolute right-3.5 top-4 text-amber-300 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600"
                      aria-hidden
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </span>
                  </a>
                ))}
              </div>
            </div>
            <p className="text-ink-500 mt-3.5 text-center text-[12.5px]">
              <span className="bg-ink-100 text-ink-600 mr-1.5 rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide">
                Soon
              </span>
              {COMING_SOON}
            </p>
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
