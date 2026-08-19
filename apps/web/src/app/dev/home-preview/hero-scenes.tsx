"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { NotifyForm } from "@/components/launch/notify-form"
import { BrandWordmark } from "@/components/brand/wordmark"
import { CourtBackdrop } from "@/components/ui/court-backdrop"

/**
 * Hero B — the scene hero (2026-08-19, owner-requested A/B).
 *
 * v2 after the owner's review of v1, which he was right to call sloppy:
 *   · no left/right arrows and no pause, so a reader could not drive it
 *   · 6s rotation moved on before an artifact could be read
 *   · the "phone" was a 212x300 box, which is not a phone shape, so the
 *     capture inside it read as distorted
 *   · the handle chip truncated on a phone, cutting off the handle, which was
 *     the one thing that scene exists to show
 *   · artifacts were thin: a bare stat row, a bare list. The creatives they
 *     came from were full cards with headers, meta lines and context, and the
 *     hero versions had been stripped to nothing
 *
 * The fix that matters most is CONTEXT. A stat line floating in a box is not
 * evidence of anything; the same stat line inside a live game, under a score
 * and a running clock with a Player of the Game badge on it, is the product.
 * Every artifact now sits in the surface it really lives on.
 *
 * Still not images. Artifacts are live DOM ported from the creatives' markup,
 * so text reflows and indexes and the LCP element stays type. The one bitmap
 * is the real product capture in the family scene, which is the point of it.
 */

/* ── Shared artifact chrome ──────────────────────────────────────────────── */

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`w-full max-w-[380px] overflow-hidden rounded-2xl border border-white/14 bg-gradient-to-br from-[#18263f] to-[#0c1526] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] md:max-w-[460px] ${className}`}
    >
      {children}
    </div>
  )
}

/** The strip every product card carries, so an artifact reads as a screen. */
function CardHead({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.06] px-4 py-2.5 md:px-5 md:py-3">
      <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/45 md:text-[13px]">
        {left}
      </span>
      {right ? <span className="ml-auto">{right}</span> : null}
    </div>
  )
}

function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-live-500/50 bg-live-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#ff9ba3]">
      <span className="h-1.5 w-1.5 rounded-full bg-live-500" />
      Live
    </span>
  )
}

/* ── 1 · Clubs: the pile, with what each one costs ───────────────────────── */

function PileArtifact() {
  const rows = [
    { name: "Registration + payments", note: "$79 / mo", phone: true },
    { name: "Team chat and RSVPs", note: "$8 / team", phone: true },
    { name: "Live scoring and stats", note: "$300 / yr", phone: true },
    { name: "Website builder", note: "$25 / mo" },
    { name: "The spreadsheet", note: "Free, and it shows" },
  ]
  return (
    <Card>
      <CardHead left="What you pay for now" />
      <div className="space-y-2 p-4 md:p-5">
        {rows.map((r) => (
          <div
            key={r.name}
            className={`flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 md:px-4 md:py-3 ${
              r.phone ? "" : "max-md:hidden"
            }`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-live-500/20 text-[13px] font-bold text-live-500">
              &times;
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white/70 line-through decoration-live-500/45 md:text-[15px]">
              {r.name}
            </span>
            <span className="shrink-0 text-[12px] font-semibold text-white/35 md:text-[13px]">
              {r.note}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-3 rounded-xl bg-hoop-500 px-3.5 py-3 shadow-lg md:px-4">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/25 text-[13px] font-bold text-white">
            &#10003;
          </span>
          <span className="flex-1 text-[15px] font-extrabold text-white md:text-[16px]">
            One app
          </span>
          <span className="text-[12px] font-bold uppercase tracking-wide text-white/80">
            One login
          </span>
        </div>
      </div>
    </Card>
  )
}

/* ── 2 · Parents: the group chat spiral ──────────────────────────────────── */

function ChatArtifact() {
  return (
    <Card>
      <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.06] px-4 py-3 md:px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[12px] font-bold text-white">
          G9
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold text-white">Grade 9 Parents</span>
          <span className="block text-[12px] text-white/40">23 members</span>
        </span>
        <span className="ml-auto shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/30">
          Sat 8:41
        </span>
      </div>
      <div className="flex flex-col gap-2 p-4 md:p-5">
        <Bubble time="8:41">A team pulled out, so the whole weekend changed</Bubble>
        <Bubble me time="8:44">Is Saturday still on?</Bubble>
        <Bubble time="9:02" hideOnPhone>
          I heard 2pm now. Or 4?
        </Bubble>
        <Bubble time="9:15">
          <span className="inline-flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-court-600 text-[9px] font-bold text-white">
              XLS
            </span>
            <span className="truncate">schedule_FINAL_v4.xlsx</span>
          </span>
        </Bubble>
        <Bubble time="9:16">that&rsquo;s the old one sorry</Bubble>
      </div>
    </Card>
  )
}

function Bubble({
  children,
  me,
  time,
  hideOnPhone,
}: {
  children: React.ReactNode
  me?: boolean
  time?: string
  hideOnPhone?: boolean
}) {
  return (
    <span
      className={`max-w-[88%] rounded-2xl border px-4 py-3 text-[16px] leading-snug md:text-[17px] ${
        me
          ? "self-end border-play-300/45 bg-play-600/45 text-white"
          : "border-white/14 bg-white/[0.12] text-white"
      } ${hideOnPhone ? "max-md:hidden" : ""}`}
    >
      {children}
      {time ? (
        <span className="mt-1 block text-[11px] font-medium text-white/45">{time}</span>
      ) : null}
    </span>
  )
}

/* ── 3 · Players: the stat line WHERE IT LIVES, inside a live game ───────── */

function LiveStatlineArtifact() {
  return (
    <Card>
      <CardHead left="NPH Summer League" right={<LivePill />} />

      {/* Scoreboard */}
      <div className="border-b border-white/10 px-4 py-3.5 md:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-play-600 text-[13px] font-extrabold text-white">
            F
          </span>
          <span className="flex-1 text-[17px] font-bold text-white md:text-[18px]">Force</span>
          <span className="text-[30px] font-extrabold leading-none tabular-nums text-gold-300 md:text-[34px]">
            62
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-hoop-500 text-[13px] font-extrabold text-white">
            H
          </span>
          <span className="flex-1 text-[17px] font-bold text-white md:text-[18px]">Huskies</span>
          <span className="text-[30px] font-extrabold leading-none tabular-nums text-white md:text-[34px]">
            58
          </span>
        </div>
        <p className="mt-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/35">
          Q4 &middot; 2:14 &middot; Haber Recreation Centre
        </p>
      </div>

      {/* The player card, in the game it came from */}
      <div className="bg-gold-500/[0.07] px-4 py-4 md:px-5">
        <span className="inline-flex items-center gap-2 rounded-full bg-gold-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-950">
          <svg viewBox="0 0 24 24" className="h-3 w-3 fill-ink-950" aria-hidden="true">
            <path d="M12 2l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.2 6.1 20.3l1.2-6.6L2.5 9l6.6-.9z" />
          </svg>
          Player of the Game
        </span>
        <div className="mt-3 flex items-center gap-3.5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-gold-500 text-[24px] font-extrabold tabular-nums text-gold-300 md:h-16 md:w-16 md:text-[28px]">
            23
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[19px] font-extrabold tracking-tight text-white md:text-[21px]">
              Jayden T.
            </span>
            <span className="mt-0.5 block text-[13px] font-semibold text-white/45">
              Grade 10 Boys &middot; #23 Guard
            </span>
          </span>
        </div>
        <div className="mt-3.5 grid grid-cols-4 gap-1.5">
          {[
            ["21", "Pts", true],
            ["7", "Reb", false],
            ["4", "Ast", false],
            ["3", "Stl", false],
          ].map(([v, k, hero]) => (
            <span
              key={k as string}
              className="rounded-lg border border-white/10 bg-white/[0.05] py-2 text-center"
            >
              <span
                className={`block text-[22px] font-extrabold leading-none tabular-nums md:text-[24px] ${
                  hero ? "text-gold-300" : "text-white"
                }`}
              >
                {v as string}
              </span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                {k as string}
              </span>
            </span>
          ))}
        </div>
      </div>
    </Card>
  )
}

/* ── 4 · Leagues: the burden ladder ──────────────────────────────────────── */

function LadderArtifact() {
  const rungs: {
    what: string
    verdict: string
    tone: "best" | "ok" | "bad" | "no"
    hideOnPhone?: boolean
  }[] = [
    { what: "Two to four slots between games", verdict: "Target", tone: "best" },
    { what: "Only one slot to rest", verdict: "Costs", tone: "ok", hideOnPhone: true },
    { what: "A five-slot wait, or back a second day", verdict: "Same cost", tone: "bad" },
    { what: "Two games in a row", verdict: "Not allowed", tone: "no" },
  ]
  const tone: Record<string, string> = {
    best: "border-court-600/45 bg-court-600/10",
    ok: "border-white/14 bg-white/[0.05]",
    bad: "border-gold-500/40 bg-gold-500/10",
    no: "border-live-500/50 bg-live-500/12",
  }
  const chip: Record<string, string> = {
    best: "bg-court-600 text-white",
    ok: "bg-white/15 text-white/80",
    bad: "bg-gold-500 text-ink-950",
    no: "bg-live-500 text-white",
  }
  return (
    <Card>
      <CardHead left="What a weekend costs a team" />
      <div className="space-y-2 p-4 md:p-5">
        {rungs.map((r) => (
          <div
            key={r.what}
            className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 md:px-4 ${tone[r.tone]} ${
              r.hideOnPhone ? "max-md:hidden" : ""
            }`}
          >
            <span className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-white/90 md:text-[15px]">
              {r.what}
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] md:text-[11px] ${chip[r.tone]}`}
            >
              {r.verdict}
            </span>
          </div>
        ))}
        <p className="pt-1 text-[12px] leading-snug text-white/40 md:text-[13px]">
          And each one costs more on a team that already carried one.
        </p>
      </div>
    </Card>
  )
}

/* ── 5 · Family: the real capture, in a phone-shaped phone ───────────────── */

function PhoneArtifact({ src, alt }: { src: string; alt: string }) {
  /* THE FRAME IS 390:844 AND NOTHING OVERRIDES IT. v1 used 212x300, v2
     claimed 390:844 while coding 390:620; both read as a squashed box.
     A true-ratio phone that fits the hero vertically would have to be so
     narrow the screen became unreadable, which is the same complaint in a
     different form. So the phone is drawn WIDE at the correct ratio and the
     section CLIPS it: you see the top of a real phone, cut off by the fold,
     with the cut dissolved rather than hard-edged. Shape stays honest and
     the screen stays legible. */
  return (
    <div className="relative mx-auto w-[228px] md:w-[300px]">
      <div className="h-[332px] overflow-hidden md:h-[524px]">
        <div className="w-full rounded-[2rem] border border-white/15 bg-ink-950 p-1.5 shadow-[0_40px_90px_-28px_rgba(0,0,0,0.95)] md:rounded-[2.6rem] md:p-2">
          <div className="relative aspect-[390/844] overflow-hidden rounded-[1.6rem] bg-white md:rounded-[2.2rem]">
            <Image
              src={src}
              alt={alt}
              width={780}
              height={1688}
              className="absolute left-0 top-0 w-full"
            />
          </div>
        </div>
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#0b1628]"
      />
    </div>
  )
}

/* ── 6 · Players: the page, not a chip ───────────────────────────────────── */

function PlayerPageArtifact() {
  return (
    <Card>
      {/* The URL is the point of this scene, so it never truncates. */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/30 px-3 py-2.5 md:px-4">
        <span className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
        </span>
        <span className="ml-1 min-w-0 flex-1 rounded-md bg-white/[0.07] px-2.5 py-1 text-[11px] font-semibold text-white/45 md:text-[13px]">
          sportshubone.com/p/<span className="font-extrabold text-gold-300">jaydent</span>
        </span>
      </div>

      <div className="px-4 py-4 md:px-5">
        <div className="flex items-center gap-3.5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-play-600 text-[20px] font-extrabold text-white md:h-16 md:w-16">
            23
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[19px] font-extrabold tracking-tight text-white md:text-[22px]">
              Jayden T.
            </span>
            <span className="mt-0.5 block text-[13px] font-semibold text-gold-300">@jaydent</span>
            <span className="mt-0.5 block truncate text-[12px] text-white/40">
              North York Force &middot; Grade 10
            </span>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["14.2", "PPG"],
            ["5.1", "RPG"],
            ["3.4", "APG"],
          ].map(([v, k]) => (
            <span
              key={k}
              className="rounded-xl border border-white/10 bg-white/[0.05] py-2.5 text-center"
            >
              <span className="block text-[20px] font-extrabold leading-none tabular-nums text-white md:text-[22px]">
                {v}
              </span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                {k}
              </span>
            </span>
          ))}
        </div>

        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">
          Last game
        </p>
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
          <span className="text-[13px] font-bold text-white">vs Huskies</span>
          <span className="text-[13px] font-semibold text-white/50">W 62-58</span>
          <span className="ml-auto text-[13px] font-extrabold tabular-nums text-gold-300">
            21 PTS
          </span>
        </div>
      </div>
    </Card>
  )
}

/* ── Scenes ──────────────────────────────────────────────────────────────── */

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
        Some nights <span className="text-gold-300">it&rsquo;s you</span>.
      </>
    ),
    sub: (
      <>
        Counted at the scorer&rsquo;s table while you play, and posted before you reach the car.
      </>
    ),
    artifact: <LiveStatlineArtifact />,
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
      <>Every wait, early start and second trip is priced, team by team, before a game is placed.</>
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
    sub: <>She sees the three the second it drops. No account, no app store.</>,
    artifact: <PhoneArtifact src="/shots/phone-game.png" alt="The live game screen" />,
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
    artifact: <PlayerPageArtifact />,
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
    artifact: <PhoneArtifact src="/shots/phone-home.png" alt="The app home screen" />,
  },
]

/** 10s, not 6s. An artifact has to be readable before it is replaced. */
const ROTATE_MS = 10000

export function HeroScenes() {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)

  const go = useCallback((next: number) => {
    setActive((i) => {
      const n = typeof next === "number" ? next : i
      return ((n % SCENES.length) + SCENES.length) % SCENES.length
    })
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const t = window.setInterval(() => setActive((i) => (i + 1) % SCENES.length), ROTATE_MS)
    return () => window.clearInterval(t)
  }, [playing])

  /* Arrow keys, but only while this hero is the thing on screen. */
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let inView = false
    const io = new IntersectionObserver(([e]) => (inView = e.intersectionRatio > 0.4), {
      threshold: [0, 0.4, 1],
    })
    io.observe(el)
    const onKey = (e: KeyboardEvent) => {
      if (!inView) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        drive(active - 1)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        drive(active + 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      io.disconnect()
      window.removeEventListener("keydown", onKey)
    }
  }, [active, drive])

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
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy)) drive(active + (dx < 0 ? 1 : -1))
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
      <div className="border-b border-white/10 bg-gold-500/10 px-5 py-2 text-center">
        <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-gold-300">
          Hero B &middot; scene version
        </span>
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-5">
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
        className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 py-6 [touch-action:pan-y]"
      >
        {/* Full-height arrows, matching Hero A's affordance. */}
        <button
          type="button"
          onClick={() => drive(active - 1)}
          aria-label="Previous scene"
          className="absolute inset-y-0 left-0 z-20 hidden w-10 cursor-pointer items-center justify-center text-white/40 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 md:flex lg:w-14"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-9 w-9">
            <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => drive(active + 1)}
          aria-label="Next scene"
          className="absolute inset-y-0 right-0 z-20 hidden w-10 cursor-pointer items-center justify-center text-white/40 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 md:flex lg:w-14"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-9 w-9">
            <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="grid items-center gap-6 md:grid-cols-[1fr_minmax(0,460px)] md:gap-12 md:px-12">
          <div className="text-center md:text-left">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-gold-400 md:text-[13px]">
              {scene.eyebrow}
            </p>
            <h2 className="mt-2.5 text-balance text-[30px] font-bold leading-[1.07] tracking-tight text-white sm:text-[42px] lg:text-[52px]">
              {scene.title}
            </h2>
            <p className="mx-auto mt-3.5 max-w-lg text-[16px] font-medium leading-relaxed text-white/70 md:mx-0 md:text-[19px]">
              {scene.sub}
            </p>
          </div>
          <div className="flex justify-center md:justify-end">{scene.artifact}</div>
        </div>

        {/* Dots plus an explicit pause, so autoplay is never something that
            just happens to you. */}
        <div className="mt-5 flex items-center justify-center gap-3 md:mt-6 md:justify-start md:px-12">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause the scenes" : "Play the scenes"}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/25 text-white/70 transition-colors hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <div className="flex items-center gap-2" role="tablist" aria-label="Scenes">
            {SCENES.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => drive(i)}
                aria-label={`Scene ${i + 1}`}
                aria-current={i === active}
                className={`h-2.5 cursor-pointer rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
                  i === active ? "w-7 bg-gold-400" : "w-2.5 bg-white/25 hover:bg-white/45"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 w-full max-w-xl max-md:rounded-3xl max-md:bg-white max-md:px-4 max-md:py-4 max-md:shadow-2xl md:mt-6 md:px-12">
          <p className="mb-2.5 text-center text-[17px] font-bold text-ink-950 md:hidden">
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
            <p className="mb-2.5 text-[17px] font-semibold text-white/85">Save your spot.</p>
            <NotifyForm
              source="landing-hero-b"
              identityAfter
              finePrint
              clubNudgeHref="#claim"
              tone="dark"
            />
          </div>
        </div>
      </div>
    </CourtBackdrop>
  )
}
