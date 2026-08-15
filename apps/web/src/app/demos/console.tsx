"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState, type ReactNode } from "react"
import { ChipGroup, cn } from "@/components/ui"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import { BrandWordmark } from "@/components/brand/wordmark"
import { DEMOS, type DemoAudience, type DemoEntry } from "./registry"

/**
 * The demo console shell (owner ruling 2026-08-15: "navigation has to be inside
 * the actual recording").
 *
 * Left rail on court navy: brand mark, search, audience filter, the demo list.
 * Right stage: nothing but the selected demo, letterboxed on an ambient court.
 * Below lg the rail folds into a top bar with the same three controls and a
 * horizontal strip of demos, because a 300px column on a phone is a wall.
 *
 * Selection is the URL. Every list item is a real link to /demos/<slug>, so
 * back and forward work, links are shareable, and a cold open lands on the
 * right demo with the rail already showing it as selected.
 */

const FILTERS = [
  { value: "all", label: "All" },
  { value: "parents", label: "Parents" },
  { value: "clubs", label: "Clubs" },
  { value: "leagues", label: "Leagues" },
]

export function DemoConsole({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const activeSlug = useMemo(() => {
    const match = /^\/demos\/([^/?#]+)/.exec(pathname ?? "")
    return match ? match[1] : null
  }, [pathname])

  const [audience, setAudience] = useState<DemoAudience | "all">("all")
  const [query, setQuery] = useState("")

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return DEMOS.filter((demo) => {
      if (audience !== "all" && !demo.audiences.includes(audience)) return false
      if (!q) return true
      return `${demo.title} ${demo.promise}`.toLowerCase().includes(q)
    })
  }, [audience, query])

  const search = (
    <SearchField value={query} onChange={setQuery} />
  )

  const filter = (
    <ChipGroup
      ariaLabel="Filter demos by audience"
      options={FILTERS}
      value={audience}
      onChange={(v) => setAudience((v || "all") as DemoAudience | "all")}
      className="gap-1.5"
    />
  )

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0b1628] text-white lg:flex-row">
      {/* ── Left rail (lg and up) ─────────────────────────────────────────── */}
      <aside className="relative isolate hidden w-[300px] shrink-0 flex-col border-r border-white/10 lg:flex">
        <CourtBackdropLayer variant="navy" intensity="band" className="opacity-60" />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="border-b border-white/10 px-5 pb-4 pt-5">
            <Link
              href="/"
              className="inline-flex items-center rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-gold-400/70"
              aria-label="SportsHub One home"
            >
              <BrandWordmark size="sm" variant="reverse" />
            </Link>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">
              Demo console
            </p>
          </div>

          <div className="space-y-3.5 px-5 py-4">
            {search}
            {filter}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
            <p className="px-2 pb-2 text-[11px] font-semibold text-white/40">
              {shown.length} {shown.length === 1 ? "demo" : "demos"}
            </p>
            {shown.length === 0 ? (
              <p className="px-2 py-6 text-[13px] leading-relaxed text-white/50">
                Nothing matches that search. Clear it to see all ten walkthroughs.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {shown.map((demo) => (
                  <li key={demo.slug}>
                    <DemoItem demo={demo} active={demo.slug === activeSlug} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="border-t border-white/10 px-5 py-3 text-[11px] leading-relaxed text-white/35">
            Sample club and league. Real rosters and payments are never shown.
          </p>
        </div>
      </aside>

      {/* ── Top bar (below lg) ────────────────────────────────────────────── */}
      <div className="relative isolate shrink-0 border-b border-white/10 lg:hidden">
        <CourtBackdropLayer variant="navy" intensity="band" className="opacity-60" />

        <div className="relative z-10 space-y-3 px-4 pb-3 pt-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="shrink-0 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-gold-400/70"
              aria-label="SportsHub One home"
            >
              <BrandWordmark size="sm" variant="reverse" />
            </Link>
            <div className="min-w-0 flex-1">{search}</div>
          </div>

          <div className="-mx-4 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="w-max">{filter}</div>
          </div>

          <div className="-mx-4 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {shown.length === 0 ? (
              <p className="py-2 text-[13px] text-white/50">
                Nothing matches that search.
              </p>
            ) : (
              <ul className="flex w-max gap-2">
                {shown.map((demo) => (
                  <li key={demo.slug}>
                    <DemoItem demo={demo} active={demo.slug === activeSlug} compact />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Stage ─────────────────────────────────────────────────────────── */}
      <main className="relative isolate min-h-0 flex-1 overflow-y-auto bg-[#0b1628]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(120% 85% at 50% 0%, rgba(59,101,178,0.20) 0%, rgba(11,22,40,0) 62%)",
          }}
        />
        <CourtBackdropLayer variant="navy" intensity="ambient" />
        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          {children}
        </div>
      </main>
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
    <div className="relative">
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
 * One row in the rail, or one card in the phone strip. Coming-soon demos stay
 * selectable on purpose: picking one puts its promise on the stage, which is
 * the honest answer to "what will this show me".
 */
function DemoItem({
  demo,
  active,
  compact = false,
}: {
  demo: DemoEntry
  active: boolean
  compact?: boolean
}) {
  const soon = demo.status !== "live"
  const isStory = demo.kind === "story"

  return (
    <Link
      href={`/demos/${demo.slug}`}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group relative block overflow-hidden rounded-xl border px-3.5 py-3 outline-none transition-colors duration-200",
        "focus-visible:ring-2 focus-visible:ring-gold-400/70",
        active
          ? "border-gold-400/60 bg-white/[0.10]"
          : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.07]",
        soon && !active && "opacity-65 hover:opacity-90",
        compact && "w-[228px]"
      )}
    >
      {active && (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-gold-400" />
      )}

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]",
            isStory ? "text-gold-400" : "text-white/55"
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
        <span className="text-[10px] font-semibold tabular-nums text-white/40">
          {demo.durationLabel}
        </span>
        <span
          className={cn(
            "ml-auto text-[10px] font-bold uppercase tracking-[0.12em]",
            soon ? "text-white/40" : "text-play-300"
          )}
        >
          {soon ? "Soon" : "Play"}
        </span>
      </div>

      <p
        className={cn(
          "mt-1.5 text-[13.5px] font-semibold leading-snug",
          active ? "text-white" : "text-white/85 group-hover:text-white"
        )}
      >
        {demo.title}
      </p>

      {!compact && (
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-white/45">
          {demo.promise}
        </p>
      )}
    </Link>
  )
}
