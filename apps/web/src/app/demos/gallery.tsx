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
 * The demo gallery, light and compact (owner ruling 2026-08-17).
 *
 * The dark pitch-block round said too much: tagline, promise, bullets and a
 * chapter scrubber per card, three layers deep before the demo even played.
 * The owner's verdict was white is easier on the eyes, and the first screen
 * should be small cards with just the very descriptive title. So a card is now
 * exactly that: kicker with duration, title, audience pills, a play glyph.
 *
 * The detail did not vanish, it moved down a layer: the player's read-then-play
 * intro already carries the promise, the three moments and the chapter list,
 * and it is the screen you land on when a card is pressed. Each layer says its
 * thing once.
 *
 * Every card is a real link to /demos/<slug>: tab order is reading order,
 * browser back returns here with scroll restored.
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

/** "1 min 35 sec" → "1:35", for the card kicker. */
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
    <div className="min-h-[100dvh] bg-ink-50 text-ink-950">
      {/* ── Header band ─────────────────────────────────────────────────── */}
      <header className="relative isolate overflow-hidden border-b border-ink-100 bg-white">
        <CourtBackdropLayer variant="daylight" intensity="band" />

        <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 pb-6 pt-5 sm:px-7 sm:pb-8 sm:pt-6">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-gold-500/70"
            aria-label="SportsHub One home"
          >
            <BrandWordmark size="sm" />
          </Link>

          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
            <div className="min-w-0">
              <p className="text-[14px] font-bold uppercase tracking-[0.2em] text-hoop-600">
                See it work
              </p>
              <h1 className="font-display mt-2 text-[32px] font-extrabold leading-[1.05] tracking-tight text-ink-950 sm:text-[42px]">
                Product demos
              </h1>
              <p className="mt-2.5 max-w-xl text-[16px] leading-relaxed text-ink-600">
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
        <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-7 sm:py-10">
          {nothing ? (
            <div className="rounded-3xl border border-ink-200 bg-white px-6 py-12 text-center">
              <p className="text-[17px] font-bold text-ink-950">Nothing matches that</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ink-500">
                Clear the search, or pick All, to see every walkthrough again.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setAudience("all")
                }}
                className="mt-6 inline-flex items-center rounded-xl bg-gold-500 px-5 py-3 text-sm font-bold text-ink-950 outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ink-950/40 motion-reduce:transform-none"
              >
                Show all {countWord(DEMOS.length)}
              </button>
            </div>
          ) : (
            <div className="space-y-10">
              {stories.length > 0 && (
                <section aria-labelledby="shelf-stories">
                  <ShelfHeading
                    id="shelf-stories"
                    title="The big stories"
                    blurb="One moment, both ends of it: the workspace on one side, the family phone on the other, running together."
                    count={stories.length}
                  />
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {stories.map((demo) => (
                      <CompactCard key={demo.slug} demo={demo} big />
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
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {shelf.demos.map((demo) => (
                      <CompactCard key={demo.slug} demo={demo} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <p className="mt-12 border-t border-ink-200 pt-5 text-[14px] leading-relaxed text-ink-400">
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
    <div className="flex flex-col gap-1.5 border-l-[3px] border-gold-500 pl-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="font-display text-[22px] font-extrabold tracking-tight text-ink-950 sm:text-[26px]">
          {title}
        </h2>
        <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-ink-400">
          {count} {count === 1 ? "demo" : "demos"}
        </span>
      </div>
      <p className="max-w-2xl text-[14.5px] leading-relaxed text-ink-500">{blurb}</p>
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
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
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
        className="h-11 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm font-medium text-ink-950 outline-none transition-colors placeholder:text-ink-400 focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/25"
      />
    </div>
  )
}

/** Audience pill tones on white: parents indigo, clubs orange, leagues green. */
const PILL_TONE: Record<DemoAudience, string> = {
  parents: "bg-play-50 text-play-700 ring-play-200",
  clubs: "bg-hoop-50 text-hoop-700 ring-hoop-200",
  leagues: "bg-court-50 text-court-700 ring-court-200",
}

function AudiencePills({ demo }: { demo: DemoEntry }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {demo.audiences.map((a) => (
        <span
          key={a}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em] ring-1",
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
 * One compact card: kicker with duration, the descriptive title, pills, and a
 * play glyph riding the card's hover state. The whole card is the link; the
 * pitch lives on the player's intro screen, one press away.
 */
function CompactCard({ demo, big = false }: { demo: DemoEntry; big?: boolean }) {
  const live = demo.status === "live"

  return (
    <Link
      href={`/demos/${demo.slug}`}
      className={cn(
        "group relative flex flex-col rounded-2xl bg-white p-5 ring-1 ring-ink-100",
        "shadow-sm outline-none transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg hover:ring-gold-500/60",
        "focus-visible:ring-2 focus-visible:ring-gold-500",
        "motion-reduce:transform-none motion-reduce:transition-none",
        big && "sm:p-6"
      )}
    >
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-ink-400">
        {demo.thumbEyebrow} · {shortDuration(demo.durationLabel)}
        {!live && <span className="ml-2 text-hoop-600">coming soon</span>}
      </p>
      <h3
        className={cn(
          "font-display mt-1.5 font-bold leading-tight text-ink-950 transition-colors group-hover:text-play-700",
          big ? "text-[22px] sm:text-[25px]" : "text-[19px] sm:text-[21px]"
        )}
      >
        {demo.title}
      </h3>
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <AudiencePills demo={demo} />
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
            live
              ? "bg-gold-500 text-ink-950 group-hover:bg-gold-400"
              : "bg-ink-100 text-ink-400"
          )}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </div>
    </Link>
  )
}
