"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { cn } from "@/components/ui/cn"
import { DemoPlayer } from "@/components/demo-directory/player"
import { claimStory } from "@/components/demo-directory/stories/claim-story"
import { gameDayStory } from "@/components/demo-directory/stories/game-day-story"
import { loopStory } from "@/components/demo-directory/stories/loop-story"
import { moneyStory } from "@/components/demo-directory/stories/money-story"
import { playersSeasonStory } from "@/components/demo-directory/stories/players-season-story"
import { playoffsStory } from "@/components/demo-directory/stories/playoffs-story"
import { rosterStory } from "@/components/demo-directory/stories/roster-story"
import { scheduleChangeStory } from "@/components/demo-directory/stories/schedule-change-story"
import { seasonStory } from "@/components/demo-directory/stories/season-story"
import { teamDropsOutStory } from "@/components/demo-directory/stories/team-drops-out-story"
import { theRefereesStory } from "@/components/demo-directory/stories/the-referees-story"
import { waiversStory } from "@/components/demo-directory/stories/waivers-story"
import { yourWeekStory } from "@/components/demo-directory/stories/your-week-story"
import type { DemoScript } from "@/components/demo-directory/types"
import { AUDIENCE_LABELS, DEMOS, type DemoEntry } from "./registry"

/**
 * The stage: read, then play (owner ruling 2026-08-15).
 *
 * Opening a demo no longer drops the viewer into a running recording. It opens
 * an INTRO: what this demo is, who it is for, how long it runs, the sentences
 * that describe what will happen, and the chapters it moves through. One amber
 * Play button starts it. That press is the only thing that mounts the player,
 * which is why the player's scroll-into-view autoplay is gone: a demo runs
 * because somebody asked for it.
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
  "everyone-in-the-loop": { script: loopStory, role: "Club", roleTone: "club" },
  "season-planned-to-published": { script: seasonStory, role: "League", roleTone: "league" },
  "schedule-change": { script: scheduleChangeStory, role: "League", roleTone: "league" },
  "game-day": { script: gameDayStory, role: "Scorer's table", roleTone: "referee" },
  "claim-your-club": { script: claimStory, role: "Club", roleTone: "club" },
  "your-week": { script: yourWeekStory, role: "Parent", roleTone: "parent" },
  "players-season": { script: playersSeasonStory, role: "Player", roleTone: "parent" },
  "money-picture": { script: moneyStory, role: "Club", roleTone: "club" },
  "standings-to-playoffs": { script: playoffsStory, role: "League", roleTone: "league" },
  waivers: { script: waiversStory, role: "League", roleTone: "league" },
  "team-drops-out": { script: teamDropsOutStory, role: "League", roleTone: "league" },
  "the-referees": { script: theRefereesStory, role: "League", roleTone: "referee" },
}

export function DemoStage({ demo }: { demo: DemoEntry }) {
  const entry = SCRIPTS[demo.slug]
  const playable = demo.status === "live" && Boolean(entry)
  const [playing, setPlaying] = useState(false)

  /* Moving from one demo to another always lands on that demo's intro. */
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
      // The panel is padded thinly on purpose: with the rail gone this box is
      // what the stage measures, and its padding comes straight off the scale.
      <div className="rounded-2xl border border-white/12 bg-[#f8f9fb] p-2.5 shadow-[0_50px_130px_-60px_rgba(0,0,0,0.95)] sm:rounded-3xl sm:p-3.5">
        <DemoPlayer
          script={entry.script}
          role={entry.role}
          roleTone={entry.roleTone}
          autoStart
          /* What actually sits under the stage in this view: the caption bar,
             the transport row and the panel's own bottom padding. The player's
             default reserves more, for pages that carry other things below. */
          reserveBelow={132}
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

/**
 * The read-then-play intro, rebuilt to the readability standard (2026-08-16).
 *
 * The 08-15 version was a wall: a 150-word description at 14.5px, five 11px
 * labels, and the numbered chapter list in 11px pills. Nobody read it, and the
 * machine gate fails every line of it.
 *
 * What replaced it is the shape a viewer actually needs before pressing play:
 * the promise in one large sentence, THREE moments as bullets, the chapters as
 * a numbered row, and the button. Nothing under 15px, and the long description
 * from the registry now serves the gallery card and the page metadata, which is
 * where prose belongs.
 */
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
  const bullets = demo.bullets.slice(0, 3)

  return (
    <div className="flex flex-1 items-center justify-center py-2">
      <div className="relative isolate w-full max-w-[1000px] overflow-hidden rounded-3xl border border-white/12 bg-white/[0.05] px-7 py-9 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.9)] sm:px-12 sm:py-12">
        {/* House motif: the amber arc, not decoration for its own sake. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full border-[10px] border-gold-400/15"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-play-500/10 blur-3xl"
        />

        <div className="relative">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 text-[15px] font-bold uppercase tracking-[0.14em]",
                isStory ? "text-gold-400" : "text-white/60"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 rounded-full",
                  isStory ? "bg-gold-400" : "border border-white/50"
                )}
              />
              {isStory ? "Story" : "Chapter"}
            </span>
            <span aria-hidden="true" className="h-3.5 w-px bg-white/20" />
            <span className="text-[15px] font-semibold tabular-nums text-white/60">
              {demo.durationLabel}
            </span>
            {demo.audiences.map((a) => (
              <span
                key={a}
                className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[15px] font-semibold text-white/75"
              >
                {AUDIENCE_LABELS[a]}
              </span>
            ))}
          </div>

          <h1 className="font-display mt-4 text-[34px] font-extrabold leading-[1.06] tracking-tight text-white sm:text-[42px]">
            {demo.title}
          </h1>

          <p className="mt-4 max-w-[62ch] text-[18px] font-semibold leading-relaxed text-white/85">
            {demo.promise}
          </p>

          <ul className="mt-6 space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-gold-400"
                />
                <span className="max-w-[68ch] text-[16px] leading-relaxed text-white/70">{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 border-t border-white/10 pt-5">
            <p className="text-[15px] font-bold uppercase tracking-[0.14em] text-white/45">
              {playable ? "Chapters" : "Planned chapters"}
            </p>
            {chapters.length === 0 ? (
              <p className="mt-2.5 text-[16px] leading-relaxed text-white/55">
                The running order for this one is still being written.
              </p>
            ) : (
              <ol className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2">
                {chapters.map((title, i) => (
                  <li key={title} className="flex items-center gap-2.5">
                    {i > 0 && (
                      <span aria-hidden="true" className="text-[15px] text-white/25">
                        /
                      </span>
                    )}
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[14px] font-bold tabular-nums",
                          playable ? "bg-gold-400/15 text-gold-400" : "bg-white/[0.07] text-white/45"
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="text-[16px] font-semibold text-white/80">{title}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {playable ? (
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={onPlay}
                className="inline-flex items-center gap-3 rounded-2xl bg-gold-400 px-8 py-4 text-[17px] font-bold text-[#0b1628] outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transform-none"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0b1628]/10">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                Play the demo
              </button>
              <p className="text-[15px] font-medium text-white/50">
                Pause, step and jump between chapters once it starts. Nothing here needs an account.
              </p>
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3.5 text-[16px] font-bold text-white/70">
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
                  className="inline-flex items-center gap-2 rounded-2xl bg-gold-400 px-5 py-3.5 text-[16px] font-bold text-[#0b1628] outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transform-none"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Watch: {firstLive.title}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
