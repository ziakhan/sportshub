import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import { BrandWordmark } from "@/components/brand/wordmark"
import { DEMOS, getDemo } from "../registry"
import { DemoStage } from "../demo-runner"
import { DemoBackControl } from "./back-control"
import { DemoSwitcher } from "./demo-switcher"

export function generateStaticParams() {
  return DEMOS.map((d) => ({ slug: d.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const demo = getDemo(params.slug)
  if (!demo) return { title: "Demo" }
  return { title: demo.title, description: demo.description }
}

/**
 * The full screen player view (owner ruling 2026-08-15).
 *
 * The rail is gone, and everything it used to hold is on the gallery instead.
 * What is left here is a slim bar (back, title, how long this runs) and then
 * the stage, which now gets the entire width. That is the whole point of the
 * restructure: the fit-to-panel scale is measured off this box, so the 320px
 * the rail used to hold is 320px of legible product on every demo.
 *
 * The view opens on the read-then-play intro. Playback replaces it in the same
 * space, so nothing jumps around when the viewer presses Play.
 */
/** Outreach aliases (owner 2026-08-19): a link sent to a club owner opens the
 *  gallery already focused on their lane. Family/parent both work because both
 *  get typed. */
const AUDIENCE_ALIASES: Record<string, string> = {
  clubs: "clubs",
  club: "clubs",
  leagues: "leagues",
  league: "leagues",
  families: "parents",
  family: "parents",
  parents: "parents",
  players: "parents",
}

export default function DemoPlayerPage({ params }: { params: { slug: string } }) {
  const audience = AUDIENCE_ALIASES[params.slug.toLowerCase()]
  if (audience) redirect(`/demos?for=${audience}`)

  const demo = getDemo(params.slug)
  if (!demo) notFound()

  const isStory = demo.kind === "story"

  return (
    /* Light chrome (owner 2026-08-17): the gallery went white and the player
       follows, so pressing a card no longer drops the viewer into a dark
       room. The stage panels were already white; only the frame around them
       changes. */
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-ink-50 text-ink-950">
      {/* ── Slim bar ────────────────────────────────────────────────────── */}
      <header className="relative isolate z-20 shrink-0 border-b border-ink-100 bg-white">
        <CourtBackdropLayer variant="daylight" intensity="band" className="opacity-60" />

        <div className="relative z-10 flex items-center gap-3 px-2 py-1.5 sm:px-4">
          <DemoBackControl />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-2.5">
              <h1 className="truncate text-[15px] font-bold leading-tight tracking-[-0.01em] text-ink-950 sm:text-[16px]">
                {demo.title}
              </h1>
              <span className="hidden shrink-0 items-center gap-1.5 text-[14px] font-bold uppercase tracking-[0.12em] text-ink-400 sm:inline-flex">
                <span
                  aria-hidden="true"
                  className={
                    isStory
                      ? "h-1.5 w-1.5 rounded-full bg-gold-500"
                      : "h-1.5 w-1.5 rounded-full border border-ink-400"
                  }
                />
                {isStory ? "Story" : "Chapter"}
              </span>
              <span className="shrink-0 text-[14px] font-semibold tabular-nums text-ink-400">
                {demo.durationLabel}
              </span>
            </div>
          </div>

          <DemoSwitcher current={demo.slug} />

          {/* The soft ask (owner 2026-08-17): one quiet button, no gate. */}
          <Link
            href="/#notify"
            className="shrink-0 rounded-lg bg-gold-500 px-3 py-1.5 text-[14px] font-bold text-ink-950 outline-none transition-colors hover:bg-gold-400 focus-visible:ring-2 focus-visible:ring-ink-950/40"
          >
            Get notified
          </Link>

          <Link
            href="/"
            className="hidden shrink-0 items-center rounded-lg px-1 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-gold-500/70 sm:inline-flex"
            aria-label="SportsHub One home"
          >
            <BrandWordmark size="sm" />
          </Link>
        </div>
      </header>

      {/* ── Stage ───────────────────────────────────────────────────────── */}
      <main className="relative isolate min-h-0 flex-1 overflow-y-auto">
        <CourtBackdropLayer variant="daylight" intensity="ambient" />

        {/* Full bleed (owner 2026-08-17: "as big as possible"): no width cap,
            near-zero padding. The player measures this box and scales the
            frames to fill it, so every pixel not spent on margin is readable
            product. */}
        <div className="relative z-10 flex min-h-full w-full flex-col px-1 py-1 sm:px-2 sm:py-1.5">
          <DemoStage demo={demo} />
        </div>
      </main>
    </div>
  )
}
