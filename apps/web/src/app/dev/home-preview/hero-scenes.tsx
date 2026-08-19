"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { NotifyForm } from "@/components/launch/notify-form"
import { BrandWordmark } from "@/components/brand/wordmark"
import { CourtBackdrop } from "@/components/ui/court-backdrop"

/**
 * Hero B — the scene hero (2026-08-19, owner-requested A/B).
 *
 * Sits directly under the existing hero on the same page so the two can be
 * read back to back and shown to other people. NOTHING IS REMOVED: Hero A is
 * untouched and this is purely additive until the owner picks one.
 *
 * WHY IT EXISTS. Hero A rotates fourteen slogans of text at 4.2s, which is
 * 59 seconds to see them all when a visitor gives a hero about ten. It also
 * asserts without evidence: the proof lives in the Screenshots section, a
 * full screen below the claim it proves. The social creatives landed harder
 * because each pairs ONE claim with ONE artifact in the same eyeful, so this
 * hero does that: seven scenes, four pains and two prides and the thesis, each
 * carrying the artifact that makes it true.
 *
 * NOT IMAGES. Every artifact here is live DOM, not a PNG of the creative. The
 * creatives are 4:5 because Instagram is; a hero is wide and short on desktop
 * and tall and narrow on a phone, so only the markup transfers, never the
 * layout. Real text keeps reflowing and stays indexable, and the LCP element
 * stays type rather than a bitmap. The one bitmap is the live-game screenshot
 * in scene 5, which is a real product capture and the point of that scene.
 *
 * DESKTOP is text left, artifact right. PHONES stack, and every artifact
 * carries a compact mode (fewer chat bubbles, fewer ladder rungs) because the
 * mobile hero is already full. The open question the owner is judging: on a
 * phone the artifact pushes the signup form down, and that is a conversion
 * trade no layout can argue away.
 */

/* ── Artifacts ───────────────────────────────────────────────────────────── */

/** s1 — the pile of things a club is paying for instead. */
function PileArtifact() {
  const rows = [
    { name: "Registration spreadsheet", cut: true },
    { name: "Team chat app", cut: true },
    { name: "Live scoring app", cut: true },
    { name: "E-transfer chasing", cut: true },
    { name: "A website builder", cut: true },
  ]
  return (
    <ArtifactCard>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={r.name}
            /* Compact mode: the last two rows are desktop-only. */
            className={`flex items-center gap-3 rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 ${
              i >= 3 ? "max-md:hidden" : ""
            }`}
          >
            <span className="text-[15px] font-bold text-live-500">&times;</span>
            <span className="text-[15px] font-medium text-white/60 line-through decoration-live-500/50">
              {r.name}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-3 rounded-xl bg-hoop-500 px-4 py-2.5">
          <span className="text-[15px] font-bold text-white">&#10003;</span>
          <span className="text-[15px] font-bold text-white">One app</span>
        </div>
      </div>
    </ArtifactCard>
  )
}

/** s18 — the group chat spiral after a team drops out. */
function ChatArtifact() {
  return (
    <ArtifactCard padded={false}>
      <div className="flex items-center gap-3 border-b border-white/10 bg-white/5 px-5 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[12px] font-bold text-white">
          G9
        </span>
        <span className="text-[15px] font-bold text-white">Grade 9 Parents</span>
        <span className="ml-auto text-[13px] text-white/40">23 members</span>
      </div>
      <div className="flex flex-col gap-2 px-5 py-4">
        <Bubble>A team pulled out, so the whole weekend changed</Bubble>
        <Bubble me>Is Saturday still on?</Bubble>
        <Bubble className="max-md:hidden">I heard 2pm now. Or 4?</Bubble>
        <Bubble>
          <span className="inline-flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-court-600 text-[9px] font-bold text-white">
              XLS
            </span>
            schedule_FINAL_v4.xlsx
          </span>
        </Bubble>
        <Bubble>that&rsquo;s the old one sorry</Bubble>
      </div>
    </ArtifactCard>
  )
}

function Bubble({
  children,
  me,
  className = "",
}: {
  children: React.ReactNode
  me?: boolean
  className?: string
}) {
  return (
    <span
      className={`max-w-[85%] rounded-2xl border px-4 py-2.5 text-[14px] leading-snug ${
        me
          ? "self-end border-play-300/30 bg-play-600/30 text-white/90"
          : "border-white/10 bg-white/8 text-white/85"
      } ${className}`}
    >
      {children}
    </span>
  )
}

/** s9 — the stat line, no faces, name as an unconsented card renders it. */
function StatlineArtifact() {
  const stats = [
    { v: "21", k: "Pts", hero: true },
    { v: "7", k: "Reb" },
    { v: "4", k: "Ast" },
    { v: "3", k: "Stl" },
  ]
  return (
    <ArtifactCard>
      <div className="flex items-center gap-5">
        <span className="font-display text-[64px] font-extrabold leading-none tracking-tight text-transparent [-webkit-text-stroke:2.5px_theme(colors.gold.500)]">
          23
        </span>
        <span>
          <span className="block text-[26px] font-extrabold tracking-tight text-white">
            Jayden T.
          </span>
          <span className="mt-1 block text-[14px] font-semibold text-white/50">
            Grade 10 Boys &middot; vs Huskies
          </span>
        </span>
      </div>
      <div className="mt-5 flex justify-between border-t border-white/12 pt-4">
        {stats.map((s) => (
          <span key={s.k} className="text-center">
            <span
              className={`block text-[38px] font-extrabold leading-none tabular-nums ${
                s.hero ? "text-gold-300" : "text-white"
              }`}
            >
              {s.v}
            </span>
            <span className="mt-1.5 block text-[12px] font-bold uppercase tracking-[0.18em] text-white/40">
              {s.k}
            </span>
          </span>
        ))}
      </div>
    </ArtifactCard>
  )
}

/** s17 — the burden ladder, which is what the scheduler actually prices. */
function LadderArtifact() {
  const rungs: { what: string; verdict: string; tone: string; compactHide?: boolean }[] = [
    { what: "Two to four slots between games", verdict: "Target", tone: "best" },
    { what: "Only one slot to rest", verdict: "Costs", tone: "ok", compactHide: true },
    { what: "A five-slot wait, or back a second day", verdict: "Same cost", tone: "bad", compactHide: true },
    { what: "Two games in a row", verdict: "Not allowed", tone: "no" },
  ]
  const tones: Record<string, string> = {
    best: "border-court-600/45 bg-court-600/10",
    ok: "border-white/14 bg-white/5",
    bad: "border-gold-500/40 bg-gold-500/8",
    no: "border-live-500/50 bg-live-500/10",
  }
  const chips: Record<string, string> = {
    best: "bg-court-600 text-white",
    ok: "bg-white/15 text-white/80",
    bad: "bg-gold-500 text-ink-950",
    no: "bg-live-500 text-white",
  }
  return (
    <ArtifactCard>
      <div className="space-y-2">
        {rungs.map((r) => (
          <div
            key={r.what}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${tones[r.tone]} ${
              r.compactHide ? "max-md:hidden" : ""
            }`}
          >
            <span className="text-[14px] font-semibold leading-snug text-white/88">{r.what}</span>
            <span
              className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${chips[r.tone]}`}
            >
              {r.verdict}
            </span>
          </div>
        ))}
      </div>
    </ArtifactCard>
  )
}

/** s15 — the real live game capture. The one bitmap, and the point of it. */
function LiveGameArtifact() {
  return (
    <div className="mx-auto w-[212px] rounded-[2rem] border border-white/14 bg-ink-950 p-2 shadow-2xl md:w-[268px]">
      <div className="relative h-[300px] overflow-hidden rounded-[1.5rem] bg-white md:h-[400px]">
        <Image
          src="/shots/phone-game.png"
          alt="Live game screen with the score, the clock and scoring by period"
          width={780}
          height={1688}
          className="w-full"
          priority={false}
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-white" />
      </div>
    </div>
  )
}

/** s10 — the handle, which is the page a player puts in their own bio. */
function HandleArtifact() {
  return (
    <div className="flex flex-col items-center gap-4 md:items-start">
      <span className="inline-flex max-w-full items-center rounded-full bg-ink-950 px-6 py-4 shadow-2xl ring-1 ring-white/15">
        <span className="truncate text-[17px] font-semibold text-white/45 md:text-[20px]">
          sportshubone.com/p/
        </span>
        <span className="text-[19px] font-extrabold tracking-tight text-gold-300 md:text-[22px]">
          jaydent
        </span>
      </span>
      <div className="flex flex-wrap justify-center gap-2 md:justify-start">
        {["Every box score", "Season averages", "Player of the Game"].map((c) => (
          <span
            key={c}
            className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[13px] font-semibold text-white/70"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}

function ArtifactCard({
  children,
  padded = true,
}: {
  children: React.ReactNode
  padded?: boolean
}) {
  return (
    <div
      className={`w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-br from-[#16233d] to-[#0d1729] shadow-2xl ${
        padded ? "p-5" : ""
      }`}
    >
      {children}
    </div>
  )
}

/* ── The scenes ──────────────────────────────────────────────────────────── */

interface Scene {
  key: string
  eyebrow: string
  title: React.ReactNode
  sub: React.ReactNode
  artifact: React.ReactNode | null
}

const SCENES: Scene[] = [
  {
    key: "pile",
    eyebrow: "For clubs",
    title: (
      <>
        Still running the season on <span className="text-gold-300">five apps</span> and a
        spreadsheet?
      </>
    ),
    sub: <>One login, from registration to the final buzzer.</>,
    artifact: <PileArtifact />,
  },
  {
    key: "dropout",
    eyebrow: "Sound familiar?",
    title: (
      <>
        One team drops out. <span className="text-gold-300">Forty messages later</span>, still no
        answer.
      </>
    ),
    sub: <>Here the schedule redraws itself, and most games never move.</>,
    artifact: <ChatArtifact />,
  },
  {
    key: "statline",
    eyebrow: "For players",
    title: (
      <>
        Your name in the <span className="text-gold-300">box score</span>.
      </>
    ),
    sub: <>Counted at the table while you play. Yours to post before you get to the car.</>,
    artifact: <StatlineArtifact />,
  },
  {
    key: "burden",
    eyebrow: "For leagues",
    title: (
      <>
        Nobody&rsquo;s team gets the <span className="text-gold-300">bad weekend twice</span>.
      </>
    ),
    sub: (
      <>
        Every wait, early start and second trip is priced, and it costs more on a team that already
        carried one.
      </>
    ),
    artifact: <LadderArtifact />,
  },
  {
    key: "grandma",
    eyebrow: "For the family",
    title: (
      <>
        Grandma is <span className="text-gold-300">three provinces away</span>.
      </>
    ),
    sub: <>She sees the three the second it drops.</>,
    artifact: <LiveGameArtifact />,
  },
  {
    key: "handle",
    eyebrow: "For players",
    title: (
      <>
        Your own page. <span className="text-gold-300">One link</span>, everything you did.
      </>
    ),
    sub: <>Put it in your bio. Send it to a coach. It updates itself every time you play.</>,
    artifact: <HandleArtifact />,
  },
  {
    key: "thesis",
    eyebrow: "Launching this fall",
    title: (
      <>
        Youth basketball. <span className="text-play-300">All of it.</span>{" "}
        <span className="rounded-lg bg-hoop-500 px-2 py-0.5 text-white">One</span> app.
      </>
    ),
    sub: <>Every seat in the gym, on one login and one database.</>,
    artifact: null,
  },
]

const ROTATE_MS = 6000

export function HeroScenes() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const go = (i: number) => {
    setPaused(true)
    setActive(((i % SCENES.length) + SCENES.length) % SCENES.length)
  }

  /* Auto-advance until the reader touches it, then it is theirs. Longer than
     Hero A's 4.2s because a scene carries an artifact to read, not one line. */
  useEffect(() => {
    if (paused) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const t = window.setInterval(
      () => setActive((i) => (i + 1) % SCENES.length),
      ROTATE_MS
    )
    return () => window.clearInterval(t)
  }, [paused])

  /* Swipe, matching Hero A's gesture so a phone comparison is like for like. */
  const touch = useRef<{ x: number; y: number } | null>(null)
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => {
      touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = touch.current
      if (!s) return
      const dx = e.changedTouches[0].clientX - s.x
      const dy = e.changedTouches[0].clientY - s.y
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) go(active + (dx < 0 ? 1 : -1))
      touch.current = null
    },
  }

  const scene = SCENES[active]

  return (
    <CourtBackdrop
      variant="navy"
      floor="planks"
      intensity="immersive"
      className="hp-flat-navy flex min-h-[100dvh] flex-col"
      contentClassName="flex flex-1 flex-col"
    >
      {/* Labelled on purpose: this is a comparison surface, and whoever the
          owner shows it to should know which one they are looking at. */}
      <div className="border-b border-white/10 bg-gold-500/10 px-5 py-2 text-center">
        <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-gold-300">
          Hero B &middot; scene version
        </span>
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6">
        <BrandWordmark size="xl" variant="reverse" />
        <nav className="flex items-center gap-6">
          <Link
            href="/demos"
            className="hidden text-[15px] font-semibold text-white/80 transition-colors hover:text-white md:inline"
          >
            Watch the demos
          </Link>
          <Link
            href="/sign-in"
            className="text-[15px] font-semibold text-white/60 transition-colors hover:text-white"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <div
        ref={rootRef}
        {...swipe}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 py-8 [touch-action:pan-y]"
      >
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-12">
          {/* Claim */}
          <div className="text-center md:text-left">
            <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-gold-400">
              {scene.eyebrow}
            </p>
            <h2 className="mt-3 text-balance text-[34px] font-bold leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-[56px]">
              {scene.title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[17px] font-medium leading-relaxed text-white/70 md:mx-0 sm:text-[21px]">
              {scene.sub}
            </p>
          </div>

          {/* Proof */}
          {scene.artifact ? (
            <div className="flex justify-center md:justify-end">{scene.artifact}</div>
          ) : (
            <div aria-hidden="true" className="hidden md:block" />
          )}
        </div>

        {/* Dots */}
        <div
          className="mt-7 flex items-center justify-center gap-2 md:justify-start"
          role="tablist"
          aria-label="Scenes"
        >
          {SCENES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(i)}
              aria-label={`Scene ${i + 1}`}
              aria-current={i === active}
              className={`h-2.5 cursor-pointer rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
                i === active ? "w-7 bg-gold-400" : "w-2.5 bg-white/25 hover:bg-white/45"
              }`}
            />
          ))}
        </div>

        {/* The ask, identical to Hero A so the comparison is about the hero. */}
        <div className="mt-7 w-full max-w-xl max-md:rounded-3xl max-md:bg-white max-md:px-4 max-md:py-5 max-md:shadow-2xl">
          <p className="mb-3 text-center text-lg font-bold text-ink-950 md:hidden">
            Save your spot.
          </p>
          <div className="md:hidden">
            <NotifyForm
              source="landing-hero-b"
              identityAfter
              finePrint
              clubNudgeHref="#claim"
              buttonClassName="bg-gold-500 text-ink-950 shadow-lg hover:bg-gold-400 focus-visible:ring-gold-600"
            />
          </div>
          <div className="hidden md:block">
            <p className="mb-3 text-[17px] font-semibold text-white/85">Save your spot.</p>
            <NotifyForm source="landing-hero-b" identityAfter finePrint clubNudgeHref="#claim" tone="dark" />
          </div>
        </div>
      </div>
    </CourtBackdrop>
  )
}
