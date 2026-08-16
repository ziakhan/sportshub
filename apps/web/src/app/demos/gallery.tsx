"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ChipGroup, cn } from "@/components/ui"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import { BrandWordmark } from "@/components/brand/wordmark"
import {
  AUDIENCE_LABELS,
  DEMOS,
  SOLO_GROUPS,
  primaryAudienceOf,
  type DemoAudience,
  type DemoEntry,
} from "./registry"

/**
 * The demo gallery, text-first (owner ruling 2026-08-16, preview variant D).
 *
 * Thumbnails are gone: at card size a screenshot decorates instead of
 * informing, so the card spends its room on the pitch. Every card is a pitch
 * block: tagline, one paragraph, then bullets that name the exact painful
 * moments the demo shows, because "jersey sizes collected at accept" sells
 * what a 6px-tall roster table never could.
 *
 * The video affordance is scrubber language, not a play sign stamped over
 * content: a segmented chapter track with a play head, real chapter names
 * under the segments on the wide bands, and the duration at the end. On
 * hover the first segment fills gold.
 *
 * Shelves: the four cross-role stories first as full-width bands (paragraph
 * left, bullets right), then one shelf per audience with its solos 2-up.
 * Every card is a real link to /demos/<slug>: tab order is reading order,
 * browser back returns here with scroll restored.
 *
 * On phones the card compacts deliberately: bullets and scrubber labels are
 * held back (the intro screen inside the player carries them) so the page
 * reads as tagline, promise, track, Watch. The full phone-first pass is its
 * own design round.
 */

const FILTERS = [
  { value: "all", label: "All" },
  { value: "parents", label: "Parents" },
  { value: "clubs", label: "Clubs" },
  { value: "leagues", label: "Leagues" },
]

/**
 * How many walkthroughs there are, in words, counted from the registry rather
 * than typed. The header said "Ten" for three demos longer than it was true.
 */
const COUNT_WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
]
const countWord = (n: number): string => COUNT_WORDS[n] ?? String(n)
const sentenceCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** "1 min 35 sec" → "1:35", for the scrubber and eyebrow. */
function shortDuration(label: string): string {
  const m = /(\d+)\s*min(?:\s*(\d+)\s*sec)?/.exec(label)
  if (!m) return label
  return `${m[1]}:${(m[2] ?? "0").padStart(2, "0")}`
}

export function DemoGallery() {
  const [audience, setAudience] = useState<DemoAudience | "all">("all")
  const [query, setQuery] = useState("")

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return DEMOS.filter((demo) => {
      /* A story serves every audience it is listed under, so an audience chip
         keeps it. A solo keeps its shelf but is only shown to an audience it
         actually serves. */
      if (audience !== "all" && !demo.audiences.includes(audience)) return false
      if (!q) return true
      return `${demo.title} ${demo.promise} ${demo.description} ${demo.bullets.join(" ")}`
        .toLowerCase()
        .includes(q)
    })
  }, [audience, query])

  const stories = shown.filter((d) => d.kind === "story")
  const shelves = SOLO_GROUPS.map((group) => ({
    ...group,
    demos: shown.filter(
      (d) => d.kind !== "story" && primaryAudienceOf(d) === group.audience
    ),
  })).filter((shelf) => shelf.demos.length > 0)

  const nothing = shown.length === 0

  return (
    <div className="min-h-[100dvh] bg-[#0b1628] text-white">
      {/* ── Header band ─────────────────────────────────────────────────── */}
      <header className="relative isolate overflow-hidden border-b border-white/10">
        <CourtBackdropLayer variant="navy" intensity="band" />
        {/* House motif: the amber arc. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-40 h-[26rem] w-[26rem] rounded-full border-[12px] border-gold-400/20"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-play-500/10 blur-3xl"
        />

        <div className="relative z-10 mx-auto w-full max-w-[1520px] px-4 pb-6 pt-5 sm:px-7 sm:pb-8 sm:pt-6">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-gold-400/70"
            aria-label="SportsHub One home"
          >
            <BrandWordmark size="sm" variant="reverse" />
          </Link>

          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
            <div className="min-w-0">
              <p className="text-[14px] font-bold uppercase tracking-[0.2em] text-gold-400">
                See it work
              </p>
              <h1 className="font-display mt-2 text-[32px] font-extrabold leading-[1.05] tracking-tight text-white sm:text-[42px]">
                Product demos
              </h1>
              <p className="mt-2.5 max-w-xl text-[16px] leading-relaxed text-white/70">
                {sentenceCase(countWord(DEMOS.length))} short walkthroughs of the real
                screens. Nothing to install, nothing to sign up for.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:justify-end">
              <SearchField value={query} onChange={setQuery} />
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="w-max sm:w-auto">
                  <ChipGroup
                    ariaLabel="Filter demos by audience"
                    options={FILTERS}
                    value={audience}
                    onChange={(v) => setAudience((v || "all") as DemoAudience | "all")}
                    className="gap-1.5"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Shelves ─────────────────────────────────────────────────────── */}
      <main className="relative isolate">
        <CourtBackdropLayer variant="navy" intensity="ambient" />

        <div className="relative z-10 mx-auto w-full max-w-[1520px] px-4 py-8 sm:px-7 sm:py-10">
          {nothing ? (
            <div className="rounded-3xl border border-white/12 bg-white/[0.04] px-6 py-12 text-center">
              <p className="text-[17px] font-bold text-white">Nothing matches that</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-white/55">
                Clear the search, or pick All, to see every walkthrough again.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setAudience("all")
                }}
                className="mt-6 inline-flex items-center rounded-xl bg-gold-400 px-5 py-3 text-sm font-bold text-[#0b1628] outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transform-none"
              >
                Show all {countWord(DEMOS.length)}
              </button>
            </div>
          ) : (
            <div className="space-y-12">
              {stories.length > 0 && (
                <section aria-labelledby="shelf-stories">
                  <ShelfHeading
                    id="shelf-stories"
                    title="The big stories"
                    blurb="One moment, both ends of it: the workspace on one side, the family phone on the other, running together."
                    count={stories.length}
                  />
                  <div className="mt-5 grid gap-5">
                    {stories.map((demo) => (
                      <PitchCard key={demo.slug} demo={demo} wide />
                    ))}
                  </div>
                </section>
              )}

              {shelves.map((shelf) => (
                <section key={shelf.audience} aria-labelledby={`shelf-${shelf.audience}`}>
                  <ShelfHeading
                    id={`shelf-${shelf.audience}`}
                    title={shelf.title}
                    blurb={shelf.blurb}
                    count={shelf.demos.length}
                  />
                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    {shelf.demos.map((demo) => (
                      <PitchCard key={demo.slug} demo={demo} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <p className="mt-12 border-t border-white/10 pt-5 text-[14px] leading-relaxed text-white/40">
            Every demo runs on a sample club and league. Real accounts, rosters and
            payments are never shown, and nothing here needs a sign in.
          </p>
        </div>
      </main>
    </div>
  )
}

function ShelfHeading({
  id,
  title,
  blurb,
  count,
}: {
  id: string
  title: string
  blurb: string
  count: number
}) {
  return (
    <div className="flex flex-col gap-1.5 border-l-[3px] border-gold-400 pl-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="font-display text-[24px] font-extrabold tracking-tight text-white sm:text-[28px]">
          {title}
        </h2>
        <span className="text-[14px] font-bold uppercase tracking-[0.16em] text-white/40">
          {count} {count === 1 ? "demo" : "demos"}
        </span>
      </div>
      <p className="max-w-2xl text-[14.5px] leading-relaxed text-white/55">{blurb}</p>
    </div>
  )
}

function SearchField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative w-full sm:w-[264px]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search demos"
        aria-label="Search demos"
        className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.07] pl-9 pr-3 text-sm font-medium text-white outline-none transition-colors placeholder:text-white/35 focus:border-gold-400/60 focus:bg-white/[0.12] focus:ring-2 focus:ring-gold-400/25"
      />
    </div>
  )
}

/** Audience pill tones: parents indigo, clubs orange, leagues green. */
const PILL_TONE: Record<DemoAudience, string> = {
  parents: "bg-play-500/15 text-play-300 ring-play-400/30",
  clubs: "bg-hoop-500/15 text-hoop-300 ring-hoop-400/30",
  leagues: "bg-court-500/15 text-court-300 ring-court-400/30",
}

function AudiencePills({ demo }: { demo: DemoEntry }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {demo.audiences.map((a) => (
        <span
          key={a}
          className={cn(
            "rounded-full px-2.5 py-1 text-[14px] font-bold uppercase tracking-[0.08em] ring-1",
            PILL_TONE[a]
          )}
        >
          {AUDIENCE_LABELS[a]}
        </span>
      ))}
    </span>
  )
}

/**
 * The video affordance: a chapter scrubber. A segmented track with a play
 * head reads as video chrome without covering anything, and the real chapter
 * names under the wide bands preview the demo's arc. On hover the first
 * segment fills gold: the card telling you it will play.
 */
function ChapterTrack({ demo, labels }: { demo: DemoEntry; labels: boolean }) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-3 w-3 text-gold-400" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <div className="flex h-1.5 flex-1 gap-1.5">
          {demo.chapterTitles.map((t, i) => (
            <span key={t} className="h-full flex-1 overflow-hidden rounded-full bg-white/15">
              {i === 0 && (
                <span className="block h-full w-0 rounded-full bg-gold-400 transition-all duration-500 group-hover:w-full motion-reduce:transition-none" />
              )}
            </span>
          ))}
        </div>
        <span className="shrink-0 text-[14px] font-bold tabular-nums text-white/60">
          {shortDuration(demo.durationLabel)}
        </span>
      </div>
      {labels ? (
        <div className="mt-2 hidden gap-1.5 pl-10 pr-12 lg:flex">
          {demo.chapterTitles.map((t) => (
            <span key={t} className="flex-1 truncate text-[14px] font-medium text-white/50">
              {t}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 pl-10 text-[14px] font-medium text-white/50">
          {demo.chapterCount} chapters, jump to any of them
        </p>
      )}
    </div>
  )
}

/**
 * One pitch block. The whole card is the link, so a keyboard lands on it once
 * and Enter plays it; the gold Watch button is decoration riding the same
 * hover and focus state, never a second tab stop.
 */
function PitchCard({ demo, wide = false }: { demo: DemoEntry; wide?: boolean }) {
  const live = demo.status === "live"

  return (
    <Link
      href={`/demos/${demo.slug}`}
      className={cn(
        "group relative isolate block overflow-hidden rounded-2xl bg-[#13223f] p-6 ring-1 ring-white/10",
        "shadow-[0_30px_80px_-50px_rgba(0,0,0,0.95)] outline-none transition-all duration-200",
        "hover:-translate-y-0.5 hover:ring-gold-400/50 hover:shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
        "focus-visible:ring-2 focus-visible:ring-gold-400/70",
        "motion-reduce:transform-none motion-reduce:transition-none",
        "sm:p-8"
      )}
    >
      {/* Quiet house motif so the block is never a plain slab. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border-[10px] border-white/[0.04]"
      />

      <div className={wide ? "lg:grid lg:grid-cols-[1.05fr_1fr] lg:gap-12" : ""}>
        <div>
          <p className="text-[14px] font-bold uppercase tracking-[0.18em] text-gold-400">
            {demo.thumbEyebrow} · {shortDuration(demo.durationLabel)}
            {!live && <span className="ml-2 text-white/45">coming soon</span>}
          </p>
          <h3
            className={cn(
              "font-display mt-2 font-extrabold leading-[1.08] text-white",
              wide ? "text-[30px] sm:text-[36px]" : "text-[27px] sm:text-[32px]"
            )}
          >
            {demo.title}
          </h3>
          <p className="mt-3 max-w-[58ch] text-[17px] leading-relaxed text-white/85 sm:text-[18.5px]">
            {demo.promise}
          </p>
        </div>
        {/* On phones the bullets wait inside the player's intro; the card
            stays a glance: tagline, promise, track, Watch. */}
        <ul className={cn("hidden md:block", wide ? "mt-5 space-y-3 lg:mt-1.5" : "mt-4 space-y-3")}>
          {demo.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-[17px] leading-snug text-white/85">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                aria-hidden="true"
                className="mt-0.5 h-[18px] w-[18px] shrink-0 text-gold-400"
              >
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {b}
            </li>
          ))}
        </ul>
      </div>

      <ChapterTrack demo={demo} labels={wide} />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <AudiencePills demo={demo} />
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[17px] font-bold transition-colors duration-200",
            live
              ? "bg-gold-400 text-[#0b1628] group-hover:bg-gold-500"
              : "bg-white/10 text-white/50"
          )}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          {live ? "Watch the demo" : "Being filmed"}
        </span>
      </div>
    </Link>
  )
}
