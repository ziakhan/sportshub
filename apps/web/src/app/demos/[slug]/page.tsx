import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import { BrandWordmark } from "@/components/brand/wordmark"
import { DEMOS, getDemo } from "../registry"
import { DemoStage } from "../demo-runner"
import { DemoBackControl } from "./back-control"

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
export default function DemoPlayerPage({ params }: { params: { slug: string } }) {
  const demo = getDemo(params.slug)
  if (!demo) notFound()

  const isStory = demo.kind === "story"

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0b1628] text-white">
      {/* ── Slim bar ────────────────────────────────────────────────────── */}
      <header className="relative isolate z-20 shrink-0 border-b border-white/10">
        <CourtBackdropLayer variant="navy" intensity="band" className="opacity-70" />

        <div className="relative z-10 flex items-center gap-3 px-2 py-1.5 sm:px-4">
          <DemoBackControl />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-2.5">
              <h1 className="truncate text-[15px] font-bold leading-tight tracking-[-0.01em] text-white sm:text-[16px]">
                {demo.title}
              </h1>
              <span className="hidden shrink-0 items-center gap-1.5 text-[14px] font-bold uppercase tracking-[0.12em] text-white/50 sm:inline-flex">
                <span
                  aria-hidden="true"
                  className={
                    isStory
                      ? "h-1.5 w-1.5 rounded-full bg-gold-400"
                      : "h-1.5 w-1.5 rounded-full border border-white/50"
                  }
                />
                {isStory ? "Story" : "Chapter"}
              </span>
              <span className="shrink-0 text-[14px] font-semibold tabular-nums text-white/50">
                {demo.durationLabel}
              </span>
            </div>
          </div>

          {/* The soft ask (owner 2026-08-17): one quiet button, no gate. */}
          <Link
            href="/#notify"
            className="shrink-0 rounded-lg bg-gold-500 px-3 py-1.5 text-[13px] font-bold text-ink-950 outline-none transition-colors hover:bg-gold-400 focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Get notified
          </Link>

          <Link
            href="/"
            className="hidden shrink-0 items-center rounded-lg px-1 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-gold-400/70 sm:inline-flex"
            aria-label="SportsHub One home"
          >
            <BrandWordmark size="sm" variant="reverse" />
          </Link>
        </div>
      </header>

      {/* ── Stage ───────────────────────────────────────────────────────── */}
      <main className="relative isolate min-h-0 flex-1 overflow-y-auto">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(120% 85% at 50% 0%, rgba(59,101,178,0.20) 0%, rgba(11,22,40,0) 62%)",
          }}
        />
        <CourtBackdropLayer variant="navy" intensity="ambient" />

        {/* Padding is deliberately thin: the player measures this box and scales
            the frames to fill it, so every 100px we do not spend on margin is
            100px of readable product. */}
        <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[1900px] flex-col px-2 py-2 sm:px-4 sm:py-3 lg:px-5">
          <DemoStage demo={demo} />
        </div>
      </main>
    </div>
  )
}
