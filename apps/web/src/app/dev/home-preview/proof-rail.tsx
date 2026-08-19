"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ChatArtifact, PhoneArtifact } from "./hero-scenes"

/**
 * THE PROOF RAIL — the landing page's second act (owner-approved and shipped
 * 2026-08-19): the merge of hero B and the screens band into ONE hero-sized
 * slider. Both parents are retired from the page; this carries their jobs.
 *
 * Shape: nine scenes, each one problem -> solved line -> REAL capture -> a
 * link into the demo that proves it end to end. The one recreation kept on
 * purpose is the group-chat spiral with the spreadsheet screenshot in it
 * (owner: "I really like that idea... make that one of the screens"),
 * serving as the disruption scene's before-picture. One scene at a time,
 * arrows + dots, 10s auto-advance that stops on first touch (hero B's
 * manners). All copy obeys the house rules: no em-dashes, plain words.
 */

interface RailScene {
  key: string
  eyebrow: string
  headline: React.ReactNode
  sub: React.ReactNode
  /** Real capture (preferred) or the kept chat recreation. */
  artifact: React.ReactNode
  demoHref: string
  demoLabel: string
}

const SCENES: RailScene[] = [
  {
    key: "discover",
    eyebrow: "For families and clubs",
    headline: (
      <>
        Every club around you, <span className="text-court-600">already listed</span>.
      </>
    ),
    sub: <>1,325 Canadian clubs with their programs and cities, before launch day.</>,
    artifact: (
      <PhoneArtifact
        src="/home-preview/shots/discover-clubs-phone.png"
        alt="The club directory on a phone"
      />
    ),
    demoHref: "/demos/claim-your-club",
    demoLabel: "Watch a club claim its page",
  },
  {
    key: "website",
    eyebrow: "For clubs",
    headline: (
      <>
        Your club gets a <span className="text-play-600">real website</span>. It runs
        itself.
      </>
    ),
    sub: (
      <>
        Schedule, roster, news and your colours, kept current by the season itself.
        Claim it and it&apos;s yours.
      </>
    ),
    artifact: (
      <PhoneArtifact
        src="/home-preview/shots/club-website-phone.png"
        alt="A club's own page with its colours and programs"
      />
    ),
    demoHref: "/demos/claim-your-club",
    demoLabel: "Watch a club make it theirs",
  },
  {
    key: "tryouts",
    eyebrow: "For clubs",
    headline: (
      <>
        Tryouts become <span className="text-hoop-600">signed, paid rosters</span>.
      </>
    ),
    sub: (
      <>
        Sizes, jersey numbers and the payment plan collected the moment a family
        accepts.
      </>
    ),
    artifact: (
      <PhoneArtifact
        src="/home-preview/shots/tryouts-events-phone.png"
        alt="Public tryout listings on a phone"
      />
    ),
    demoHref: "/demos/roster-story",
    demoLabel: "Watch a roster fill itself",
  },
  {
    key: "week",
    eyebrow: "For the family",
    headline: (
      <>
        Both kids, every practice, <span className="text-play-600">one phone</span>.
      </>
    ),
    sub: (
      <>
        The fee and the waiver arrive on the same phone they get answered on.
      </>
    ),
    artifact: (
      <PhoneArtifact
        src="/home-preview/shots/parent-calendar-phone.png"
        alt="The family calendar on a phone"
      />
    ),
    demoHref: "/demos/your-week",
    demoLabel: "Watch a family's week",
  },
  {
    key: "disruption",
    eyebrow: "Sound familiar?",
    headline: (
      <>
        One team drops out. <span className="text-hoop-600">Forty messages later</span>,
        still no answer.
      </>
    ),
    sub: (
      <>
        Here the schedule redraws itself, and every phone already knows.
      </>
    ),
    artifact: <ChatArtifact />,
    demoHref: "/demos/schedule-change",
    demoLabel: "Watch a game move cleanly",
  },
  {
    key: "grandma",
    eyebrow: "For the family",
    headline: (
      <>
        Grandma is <span className="text-court-600">three provinces away</span>.
      </>
    ),
    sub: (
      <>
        Counted at the scorer&apos;s table while they play; she watches the three drop
        live. No account, no app store.
      </>
    ),
    artifact: (
      <PhoneArtifact
        src="/home-preview/shots/game-live-scorecard-phone.png"
        alt="A live game on a phone"
      />
    ),
    demoHref: "/demos/game-day",
    demoLabel: "Watch a game scored live",
  },
  {
    key: "news",
    eyebrow: "For players and families",
    headline: (
      <>
        <span className="text-hoop-600">Your name in the news.</span> Every game night.
      </>
    ),
    sub: (
      <>
        A written recap of every game, and a page for every player. Stats posted
        before you reach the car.
      </>
    ),
    artifact: (
      <PhoneArtifact
        src="/home-preview/news-recap-phone.png"
        alt="A game recap story on a phone"
      />
    ),
    demoHref: "/demos/players-season",
    demoLabel: "Watch a player's page grow",
  },
  {
    key: "feed",
    eyebrow: "The social side",
    headline: (
      <>
        The season has <span className="text-play-600">a feed</span>.
      </>
    ),
    sub: (
      <>
        Player of the Game cards, recaps and standings moves from the teams you
        follow, in one scroll.
      </>
    ),
    artifact: (
      <PhoneArtifact
        src="/home-preview/shots/social-feed-phone.png"
        alt="The social feed on a phone"
      />
    ),
    demoHref: "/demos?for=parents",
    demoLabel: "See the demos for families",
  },
  {
    key: "thesis",
    eyebrow: "Launching this fall",
    headline: (
      <>
        Youth basketball. <span className="text-play-600">All of it.</span>{" "}
        <span className="rounded-lg bg-hoop-500 px-2 py-0.5 text-white">One</span> app.
      </>
    ),
    sub: <>Every seat in the gym, on one login and one database.</>,
    artifact: (
      <PhoneArtifact src="/shots/phone-home.png" alt="The app home screen on a phone" />
    ),
    demoHref: "/demos",
    demoLabel: "Watch all thirteen demos",
  },
]

/** 10s, matching hero B: an artifact must be readable before it is replaced. */
const ROTATE_MS = 10000

export function ProofRail() {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(true)

  const go = useCallback((next: number) => {
    setActive(((next % SCENES.length) + SCENES.length) % SCENES.length)
  }, [])

  /** Any deliberate move stops autoplay: the reader has taken over. */
  const drive = useCallback(
    (next: number) => {
      setPlaying(false)
      go(next)
    },
    [go]
  )

  useEffect(() => {
    if (!playing) return
    const t = window.setInterval(() => setActive((i) => (i + 1) % SCENES.length), ROTATE_MS)
    return () => window.clearInterval(t)
  }, [playing])

  const scene = SCENES[active]

  return (
    <section
      aria-label="The pain, and the fix, on real screens"
      className="border-y border-ink-100 bg-[#faf8f4]"
    >
      <div className="mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-7 sm:py-12">
        <div className="flex flex-col gap-8 md:min-h-[460px] md:flex-row md:items-center md:gap-12">
          {/* ── Text side ──────────────────────────────────────────────── */}
          <div key={scene.key} className="demo-fade-in min-w-0 md:w-1/2">
            <p className="text-[12.5px] font-bold uppercase tracking-[0.18em] text-ink-400">
              {scene.eyebrow}
            </p>
            <h2 className="font-display mt-1.5 text-[27px] font-extrabold leading-tight tracking-tight text-ink-950 sm:text-[34px]">
              {scene.headline}
            </h2>
            <p className="mt-2.5 max-w-lg text-[15.5px] leading-relaxed text-ink-600">
              {scene.sub}
            </p>
            <Link
              href={scene.demoHref}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink-950 px-4 py-2.5 text-[14px] font-bold text-white outline-none transition-colors hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-gold-500"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              {scene.demoLabel}
            </Link>
          </div>

          {/* ── Artifact side, fixed so the controls never jump ─────────── */}
          <div key={`${scene.key}-art`} className="demo-fade-in md:w-1/2">
            {scene.artifact}
          </div>
        </div>

        {/* ── Transport: arrows + dots, hero B's grammar ─────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => drive(active - 1)}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-white text-ink-700 ring-1 ring-ink-200 outline-none transition-colors hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-4 w-4" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex items-center gap-2" role="tablist" aria-label="Scenes">
            {SCENES.map((s, i) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Scene ${i + 1}`}
                onClick={() => drive(i)}
                className={
                  i === active
                    ? "h-2.5 w-7 cursor-pointer rounded-full bg-ink-950 transition-all"
                    : "h-2.5 w-2.5 cursor-pointer rounded-full bg-ink-300 transition-all hover:bg-ink-400"
                }
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next"
            onClick={() => drive(active + 1)}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-white text-ink-700 ring-1 ring-ink-200 outline-none transition-colors hover:bg-ink-50 focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-4 w-4" aria-hidden="true">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}
