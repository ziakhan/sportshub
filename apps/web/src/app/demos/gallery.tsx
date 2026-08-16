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
  openingSentences,
  primaryAudienceOf,
  type DemoAudience,
  type DemoEntry,
} from "./registry"

/**
 * The demo gallery (owner ruling 2026-08-15: gallery first, then a full screen
 * player).
 *
 * The persistent rail is gone. A rail cost 320px of every demo forever so that
 * a viewer could switch walkthroughs they were not watching, and it left the
 * cards no room to say anything. This page spends that room instead: a court
 * navy header band with the search and the audience chips in it, then grouped
 * shelves of cards that carry the whole promise, the written description, the
 * duration and the chapter count, so a viewer knows what they are about to
 * watch before they spend two minutes on it.
 *
 * Shelves: the four cross-role stories first, wide, because they are the ones
 * that show two sides of a single moment. Then one shelf per audience, each
 * solo appearing exactly once, on the shelf it is really for.
 *
 * Every card is a real link to /demos/<slug>. Nothing here is a click handler
 * pretending to be navigation, so tab order is the reading order, the browser
 * back button returns to this grid, and Next restores the scroll position.
 */

const FILTERS = [
  { value: "all", label: "All" },
  { value: "parents", label: "Parents" },
  { value: "clubs", label: "Clubs" },
  { value: "leagues", label: "Leagues" },
]

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
      return `${demo.title} ${demo.promise} ${demo.description}`.toLowerCase().includes(q)
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

        <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 pb-6 pt-5 sm:px-7 sm:pb-8 sm:pt-6">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-gold-400/70"
            aria-label="SportsHub One home"
          >
            <BrandWordmark size="sm" variant="reverse" />
          </Link>

          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-400">
                See it work
              </p>
              <h1 className="font-display mt-2 text-[32px] font-extrabold leading-[1.05] tracking-tight text-white sm:text-[42px]">
                Product demos
              </h1>
              <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-white/65">
                Ten short walkthroughs of the real screens. Nothing to install, nothing
                to sign up for.
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

        <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-7 sm:py-10">
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
                Show all ten
              </button>
            </div>
          ) : (
            <div className="space-y-11">
              {stories.length > 0 && (
                <section aria-labelledby="shelf-stories">
                  <ShelfHeading
                    id="shelf-stories"
                    title="The big stories"
                    blurb="One moment, both ends of it: the workspace on one side, the family phone on the other, running together."
                    count={stories.length}
                  />
                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    {stories.map((demo) => (
                      <DemoCard key={demo.slug} demo={demo} size="large" />
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
                  <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {shelf.demos.map((demo) => (
                      <DemoCard key={demo.slug} demo={demo} size="solo" />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <p className="mt-12 border-t border-white/10 pt-5 text-[12px] leading-relaxed text-white/35">
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
        <h2 id={id} className="font-display text-[22px] font-extrabold tracking-tight text-white sm:text-[26px]">
          {title}
        </h2>
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">
          {count} {count === 1 ? "demo" : "demos"}
        </span>
      </div>
      <p className="max-w-2xl text-[13.5px] leading-relaxed text-white/55">{blurb}</p>
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

/**
 * One card. The whole thing is the link, so a keyboard lands on it once and
 * Enter plays it, and the amber Play affordance is decoration that follows the
 * same hover and focus state rather than a second tab stop.
 */
function DemoCard({ demo, size }: { demo: DemoEntry; size: "large" | "solo" }) {
  const large = size === "large"
  const live = demo.status === "live"
  const isStory = demo.kind === "story"
  const blurb = openingSentences(demo.description, large ? 420 : 300)

  return (
    <Link
      href={`/demos/${demo.slug}`}
      className={cn(
        "group relative isolate flex flex-col overflow-hidden rounded-3xl border border-white/12 bg-white/[0.05]",
        "shadow-[0_30px_80px_-50px_rgba(0,0,0,0.95)] outline-none transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08]",
        "focus-visible:ring-2 focus-visible:ring-gold-400/70",
        "motion-reduce:transform-none motion-reduce:transition-none"
      )}
    >
      <DemoThumb demo={demo} large={large} />

      <div className={cn("flex min-h-0 flex-1 flex-col", large ? "px-6 py-5" : "px-5 py-5")}>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em]",
              isStory ? "text-gold-400" : "text-white/50"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isStory ? "bg-gold-400" : "border border-white/50"
              )}
            />
            {isStory ? "Story" : "Chapter"}
          </span>
          <span aria-hidden="true" className="h-2.5 w-px bg-white/15" />
          <span className="text-[11px] font-semibold tabular-nums text-white/50">
            {demo.durationLabel}
          </span>
          <span aria-hidden="true" className="h-2.5 w-px bg-white/15" />
          <span className="text-[11px] font-semibold tabular-nums text-white/50">
            {demo.chapterCount} chapters
          </span>
        </div>

        <h3
          className={cn(
            "font-display mt-2.5 font-extrabold leading-[1.12] tracking-tight text-white",
            large ? "text-[24px] sm:text-[27px]" : "text-[19px]"
          )}
        >
          {demo.title}
        </h3>

        <p
          className={cn(
            "mt-2 font-semibold leading-relaxed text-white/80",
            large ? "text-[15px]" : "text-[13.5px]"
          )}
        >
          {demo.promise}
        </p>

        <p
          className={cn(
            "mt-2.5 leading-relaxed text-white/55",
            large ? "text-[13.5px]" : "text-[12.5px]"
          )}
        >
          {blurb}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {demo.audiences.map((a) => (
              <span
                key={a}
                className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-white/70"
              >
                {AUDIENCE_LABELS[a]}
              </span>
            ))}
          </div>

          <span
            className={cn(
              "ml-auto inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[12.5px] font-bold transition-colors duration-200",
              live
                ? "text-white/70 group-hover:bg-gold-400/12 group-hover:text-gold-400"
                : "text-white/40"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-200",
                live
                  ? "bg-white/10 text-white group-hover:bg-gold-400 group-hover:text-[#0b1628]"
                  : "bg-white/[0.06] text-white/40"
              )}
            >
              {live ? (
                <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  className="h-3 w-3"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7.5V12l3 2" />
                </svg>
              )}
            </span>
            {live ? "Play" : "Being filmed"}
          </span>
        </div>
      </div>
    </Link>
  )
}

/**
 * Thumbnail slot. Until there are real captures, the card shows the SHAPE of
 * the demo on a court band: a browser window, a phone, or both side by side,
 * which is exactly what the stage will look like when it plays.
 *
 * The mock frames carry the REAL aspect ratios of the stage (1120x660 and
 * 320x668) and are sized off the band's height, so a wide story card and a
 * narrow solo card show the same proportions rather than the same pixels.
 */
function DemoThumb({ demo, large }: { demo: DemoEntry; large: boolean }) {
  const showDesktop = demo.stage !== "phone"
  const showPhone = demo.stage !== "desktop"
  const both = showDesktop && showPhone

  return (
    <div
      className={cn(
        "relative isolate shrink-0 overflow-hidden bg-[#0b1628]",
        large ? "aspect-[21/9]" : "aspect-[16/10]"
      )}
    >
      <CourtBackdropLayer variant="navy" intensity="band" />

      <span className="absolute left-4 top-3 z-10 text-[10px] font-bold uppercase tracking-[0.16em] text-gold-400">
        {demo.thumbEyebrow}
      </span>
      {demo.status !== "live" && (
        <span className="absolute right-4 top-3 z-10 rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 ring-1 ring-inset ring-white/20">
          Soon
        </span>
      )}

      {/* inset-0 on purpose: the frames are sized as a share of the band, and a
          percentage height needs a parent with a definite one. */}
      <div className="absolute inset-0 z-10 flex items-end justify-center gap-2 px-5 pt-9 sm:gap-3">
        {showDesktop && (
          <div
            className={cn(
              "aspect-[1120/660] w-auto rounded-t-lg bg-white/[0.92] shadow-[0_-10px_30px_-14px_rgba(0,0,0,0.85)] ring-1 ring-white/30",
              both ? "h-[70%]" : "h-[80%]"
            )}
          >
            <div className="flex h-[11%] items-center gap-1 rounded-t-lg bg-[#eef1f5] px-2">
              <span className="h-1 w-1 rounded-full bg-[#f87171]" />
              <span className="h-1 w-1 rounded-full bg-[#fbbf24]" />
              <span className="h-1 w-1 rounded-full bg-[#34d399]" />
            </div>
            <div className="space-y-1.5 px-3 py-2.5">
              <div className="h-2 w-1/2 rounded-full bg-[#0b1628]/25" />
              <div className="h-1.5 w-3/4 rounded-full bg-[#0b1628]/10" />
              <div className="h-1.5 w-2/3 rounded-full bg-[#0b1628]/10" />
              <div className="h-1.5 w-1/2 rounded-full bg-[#0b1628]/10" />
            </div>
          </div>
        )}
        {showPhone && (
          <div
            className={cn(
              "aspect-[320/668] w-auto rounded-t-[12px] bg-[#0b0b0f] p-[4px] shadow-[0_-10px_30px_-14px_rgba(0,0,0,0.85)]",
              both ? "h-[86%]" : "h-[94%]"
            )}
          >
            <div className="h-full w-full rounded-t-[9px] bg-white/[0.92] px-2 py-1.5">
              <div className="mx-auto h-1 w-1/2 rounded-full bg-[#0b1628]/40" />
              <div className="mt-2.5 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-[#0b1628]/15" />
                <div className="h-1.5 w-3/4 rounded-full bg-[#0b1628]/15" />
                <div className="h-1.5 w-5/6 rounded-full bg-[#0b1628]/10" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Amber wash on hover: the card is about to play something. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 bg-gold-400/0 transition-colors duration-200 group-hover:bg-gold-400/[0.07]"
      />
    </div>
  )
}
