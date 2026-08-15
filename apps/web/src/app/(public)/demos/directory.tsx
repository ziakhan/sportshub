"use client"

import Link from "next/link"
import { useState } from "react"
import { ChipGroup, PageBand, cn } from "@/components/ui"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import {
  AUDIENCE_LABELS,
  DEMOS,
  demosForAudience,
  type DemoAudience,
  type DemoEntry,
} from "./registry"

const FILTERS = [
  { value: "all", label: "All" },
  { value: "parents", label: "Parents" },
  { value: "clubs", label: "Clubs" },
  { value: "leagues", label: "Leagues" },
]

export function DemoDirectory() {
  const [audience, setAudience] = useState<DemoAudience | "all">("all")
  const shown = demosForAudience(audience)

  return (
    <>
      <PageBand
        eyebrow="See it work"
        title="Product demos"
        description="Ten short walkthroughs of the real screens. Nothing to install, nothing to sign up for."
      >
        <div className="mt-4">
          <ChipGroup
            ariaLabel="Filter demos by audience"
            options={FILTERS}
            value={audience}
            onChange={(v) => setAudience((v || "all") as DemoAudience | "all")}
          />
        </div>
      </PageBand>

      <div className="container mx-auto px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-ink-500 mb-5 text-sm font-medium">
          {shown.length} {shown.length === 1 ? "demo" : "demos"}
          {audience !== "all" ? ` for ${AUDIENCE_LABELS[audience].toLowerCase()}` : ""}
          . Stories show two sides of the same moment, so they appear under every
          audience they serve.
        </p>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((demo) => (
            <DemoCard key={demo.slug} demo={demo} />
          ))}
        </div>

        <p className="text-ink-400 mt-8 text-xs">
          Demos use a sample club and league. Real accounts, rosters and payments are
          never shown.
        </p>
      </div>
    </>
  )
}

function DemoCard({ demo }: { demo: DemoEntry }) {
  const live = demo.status === "live"
  return (
    <Link
      href={`/demos/${demo.slug}`}
      className={cn(
        "group border-ink-100 flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_10px_30px_-24px_rgba(15,23,42,0.5)] transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-28px_rgba(15,23,42,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand,#1a73e8)]",
        "motion-reduce:transform-none motion-reduce:transition-none"
      )}
    >
      <DemoThumb demo={demo} />

      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {demo.audiences.map((a) => (
            <span
              key={a}
              className="bg-ink-50 text-ink-600 ring-ink-200 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
            >
              {AUDIENCE_LABELS[a]}
            </span>
          ))}
          <span className="text-ink-400 ml-auto text-[11px] font-semibold uppercase tracking-[0.1em]">
            {demo.durationLabel}
          </span>
        </div>

        <h2 className="text-ink-900 text-[17px] font-bold leading-snug tracking-tight">
          {demo.title}
        </h2>
        <p className="text-ink-500 mt-1.5 text-[13px] leading-relaxed">{demo.promise}</p>

        <span
          className={cn(
            "mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold",
            live ? "text-[color:var(--brand,#1a73e8)]" : "text-ink-400"
          )}
        >
          {live ? "Watch it" : "Coming soon"}
          {live && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </span>
      </div>
    </Link>
  )
}

/**
 * Thumbnail slot. Until there are real captures, the card shows the SHAPE of
 * the demo: a browser window, a phone, or both side by side on the court.
 */
function DemoThumb({ demo }: { demo: DemoEntry }) {
  return (
    <div className="relative isolate aspect-[16/9] overflow-hidden bg-[#0b1628]">
      <CourtBackdropLayer variant="navy" intensity="band" />

      <span className="text-gold-400 absolute left-3 top-3 z-10 text-[10px] font-bold uppercase tracking-[0.16em]">
        {demo.thumbEyebrow}
      </span>
      {demo.status !== "live" && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 ring-1 ring-inset ring-white/20">
          Soon
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center gap-2 px-6 pb-4">
        {demo.stage !== "phone" && (
          <div className="h-[54%] w-[66%] rounded-t-lg bg-white/92 shadow-[0_-8px_24px_-14px_rgba(0,0,0,0.8)] ring-1 ring-white/30">
            <div className="flex h-3 items-center gap-1 rounded-t-lg bg-[#eef1f5] px-1.5">
              <span className="h-1 w-1 rounded-full bg-[#f87171]" />
              <span className="h-1 w-1 rounded-full bg-[#fbbf24]" />
              <span className="h-1 w-1 rounded-full bg-[#34d399]" />
            </div>
            <div className="space-y-1 p-2">
              <div className="h-1.5 w-1/2 rounded-full bg-[#0b1628]/25" />
              <div className="h-1 w-3/4 rounded-full bg-[#0b1628]/12" />
              <div className="h-1 w-2/3 rounded-full bg-[#0b1628]/12" />
            </div>
          </div>
        )}
        {demo.stage !== "desktop" && (
          <div className="h-[62%] w-[16%] rounded-t-[10px] bg-[#0b0b0f] p-[3px] shadow-[0_-8px_24px_-14px_rgba(0,0,0,0.8)]">
            <div className="h-full w-full rounded-t-[8px] bg-white/92 p-1">
              <div className="mx-auto h-1 w-1/2 rounded-full bg-[#0b1628]/40" />
              <div className="mt-1.5 space-y-1">
                <div className="h-1 w-full rounded-full bg-[#0b1628]/15" />
                <div className="h-1 w-3/4 rounded-full bg-[#0b1628]/15" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export { DEMOS }
