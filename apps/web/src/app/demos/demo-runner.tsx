"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { cn } from "@/components/ui/cn"
import { DemoPlayer } from "@/components/demo-directory/player"
import { rosterStory } from "@/components/demo-directory/stories/roster-story"
import type { DemoScript } from "@/components/demo-directory/types"
import { AUDIENCE_LABELS, DEMOS, type DemoEntry } from "./registry"

/**
 * The stage: read, then play (owner ruling 2026-08-15).
 *
 * Clicking a demo in the rail no longer drops the viewer into a running
 * recording. It opens an INTRO: what this demo is, who it is for, how long it
 * runs, the sentences that describe what will happen, and the chapters it moves
 * through. One amber Play button starts it. That press is the only thing that
 * mounts the player, which is why the player's scroll-into-view autoplay is
 * gone: a demo runs because somebody asked for it.
 *
 * A demo that is not filmed yet gets the same intro, with its planned chapters
 * from the registry and an honest note in place of the button.
 */

/** Slug to script. A demo goes live the moment it appears in this map. */
const SCRIPTS: Record<
  string,
  { script: DemoScript; role: string; roleTone: "club" | "league" | "parent" | "referee" }
> = {
  "roster-story": { script: rosterStory, role: "Club", roleTone: "club" },
}

export function DemoStage({ demo }: { demo: DemoEntry }) {
  const entry = SCRIPTS[demo.slug]
  const playable = demo.status === "live" && Boolean(entry)
  const [playing, setPlaying] = useState(false)

  /* Moving between demos in the rail always lands on that demo's intro. */
  useEffect(() => {
    setPlaying(false)
  }, [demo.slug])

  const chapters = playable
    ? entry.script.chapters.map((c) => c.title)
    : (demo.plannedChapters ?? [])

  if (playing && entry) {
    return (
      // The player keeps its own light chrome (captions, chapter chips,
      // progress), so it sits on a lit panel rather than straight on navy.
      <div className="rounded-3xl border border-white/12 bg-[#f8f9fb] p-3 shadow-[0_50px_130px_-60px_rgba(0,0,0,0.95)] sm:p-5">
        <DemoPlayer
          script={entry.script}
          role={entry.role}
          roleTone={entry.roleTone}
          autoStart
          onExit={() => setPlaying(false)}
        />
      </div>
    )
  }

  return (
    <DemoIntro
      demo={demo}
      chapters={chapters}
      playable={playable}
      onPlay={() => setPlaying(true)}
    />
  )
}

function DemoIntro({
  demo,
  chapters,
  playable,
  onPlay,
}: {
  demo: DemoEntry
  chapters: string[]
  playable: boolean
  onPlay: () => void
}) {
  const isStory = demo.kind === "story"
  const firstLive = DEMOS.find((d) => d.status === "live" && d.slug !== demo.slug)

  return (
    <div className="flex flex-1 items-center justify-center py-2">
      <div className="relative isolate w-full max-w-[1080px] overflow-hidden rounded-3xl border border-white/12 bg-white/[0.05] px-6 py-8 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.9)] sm:px-10 sm:py-11">
        {/* House motif: the amber arc, not decoration for its own sake. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full border-[10px] border-gold-400/20"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-play-500/10 blur-3xl"
        />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em]",
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
              <span aria-hidden="true" className="h-3 w-px bg-white/15" />
              <span className="text-[11px] font-semibold tabular-nums text-white/50">
                {demo.durationLabel}
              </span>
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
            </div>

            <h1 className="font-display mt-3 text-[30px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[38px]">
              {demo.title}
            </h1>

            <p className="mt-3 max-w-2xl text-[16px] font-semibold leading-relaxed text-white/80">
              {demo.promise}
            </p>

            <div className="mt-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-400">
                What you will see
              </p>
              <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-white/60">
                {demo.description}
              </p>
            </div>

            {playable ? (
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onPlay}
                  className="inline-flex items-center gap-2.5 rounded-2xl bg-gold-400 px-7 py-4 text-[15px] font-bold text-[#0b1628] outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transform-none"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0b1628]/10">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  Play the demo
                </button>
                <p className="text-[12.5px] font-medium text-white/45">
                  Pause, step and jump between chapters once it starts.
                </p>
              </div>
            ) : (
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3.5 text-[13.5px] font-bold text-white/70">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4 text-gold-400"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  Being filmed
                </span>
                {firstLive && (
                  <Link
                    href={`/demos/${firstLive.slug}`}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gold-400 px-5 py-3.5 text-[13.5px] font-bold text-[#0b1628] outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transform-none"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Watch: {firstLive.title}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Chapters */}
          <div className="min-w-0">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                {playable ? "Chapters" : "Planned chapters"}
              </p>
              {chapters.length === 0 ? (
                <p className="mt-3 text-[13.5px] leading-relaxed text-white/50">
                  The running order for this one is still being written.
                </p>
              ) : (
                <ol className="mt-3.5 space-y-3">
                  {chapters.map((title, i) => (
                    <li key={title} className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                          playable
                            ? "bg-gold-400/15 text-gold-400"
                            : "bg-white/[0.07] text-white/45"
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="text-[14px] font-semibold leading-snug text-white/75">
                        {title}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-5 border-t border-white/10 pt-4 text-[11.5px] leading-relaxed text-white/35">
                Sample club and league. Nothing here needs an account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
