"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/components/ui/cn"
import { SplitStage } from "./frames"
import { AnimatedCursor, StepCaption, usePrefersReducedMotion } from "./motion"
import type { DemoScript, StageMode } from "./types"

/**
 * The demo directory player (2026-08-15).
 *
 * Wraps the fixed stage with the controls a scripted product tour needs:
 * play and pause, chapter jump chips, a progress bar, and a caption bar that
 * names the beat.
 *
 * Owner ruling 2026-08-15 (read then play): the player no longer starts itself
 * when it scrolls into view. The intro stage mounts it with `autoStart` the
 * moment the viewer presses Play, so a demo only ever runs because someone
 * asked for it. Nothing else about the timeline changed.
 *
 * Everything is derived from the beat index, so jumping is exact: chapter 2
 * looks the same whether you watched chapter 1 or skipped it.
 */
export function DemoPlayer({
  script,
  role,
  roleTone = "club",
  className,
  autoStart = false,
  onExit,
  exitLabel = "Back to intro",
  reserveBelow,
}: {
  script: DemoScript
  /** Who is acting, shown on the caption chip. */
  role: string
  roleTone?: "club" | "league" | "parent" | "referee"
  className?: string
  /** Start playing as soon as the player mounts (the Play press did this). */
  autoStart?: boolean
  /** Shows a small link back to the intro stage. */
  onExit?: () => void
  exitLabel?: string
  /**
   * Height the stage must leave under itself for the caption and the beat
   * stepper. The default is generous because the player can sit on a page with
   * other things under it; a full screen player view knows exactly what its own
   * chrome costs and can hand back the difference as scale.
   */
  reserveBelow?: number
}) {
  const { beats, chapters } = script
  const reduced = usePrefersReducedMotion()

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(autoStart)
  const [elapsed, setElapsed] = useState(0)
  const [done, setDone] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  /* Reduced motion resolves after the first paint, so an autostarted demo
     stops itself and hands over to the beat stepper. */
  useEffect(() => {
    if (reduced) setPlaying(false)
  }, [reduced])

  const beat = beats[index]

  /* Cumulative timing, for the progress bar and the chapter markers. */
  const { total, starts } = useMemo(() => {
    const s: number[] = []
    let acc = 0
    for (const b of beats) {
      s.push(acc)
      acc += b.hold
    }
    return { total: acc, starts: s }
  }, [beats])

  /* State is every patch up to and including the current beat. */
  const state = useMemo(() => {
    const s: Record<string, unknown> = {}
    for (let i = 0; i <= index && i < beats.length; i += 1) {
      const b = beats[i]
      if (b.set) Object.assign(s, b.set)
      if (b.type) s[b.type.key] = b.type.text
    }
    return s
  }, [beats, index])

  const stage: StageMode = useMemo(() => {
    let mode = script.initialStage
    for (let i = 0; i <= index && i < beats.length; i += 1) {
      if (beats[i].stage) mode = beats[i].stage as StageMode
    }
    return mode
  }, [beats, index, script.initialStage])

  const hasPhone = useMemo(
    () => beats.some((b) => b.stage === "split" || b.stage === "phone"),
    [beats]
  )

  /* The address bar follows the workspace screen, same accumulate-and-jump
     rule as the stage mode. */
  const url = useMemo(() => {
    let current = script.desktopUrl
    for (let i = 0; i <= index && i < beats.length; i += 1) {
      if (beats[i].url) current = beats[i].url as string
    }
    return current
  }, [beats, index, script.desktopUrl])

  /* Autoplay: advance when the beat's hold runs out. */
  useEffect(() => {
    if (!playing || reduced || done) return
    const t = setTimeout(() => {
      setIndex((i) => {
        if (i + 1 >= beats.length) {
          setDone(true)
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, beat?.hold ?? 2000)
    return () => clearTimeout(t)
  }, [playing, reduced, done, index, beat, beats.length])

  /* Progress. Coarse on purpose: a bar does not need 60fps. */
  useEffect(() => {
    setElapsed(starts[index] ?? 0)
    if (!playing || reduced) return
    const started = Date.now()
    const id = setInterval(() => {
      const within = Math.min(Date.now() - started, beat?.hold ?? 0)
      setElapsed((starts[index] ?? 0) + within)
    }, 120)
    return () => clearInterval(id)
  }, [index, playing, reduced, starts, beat])

  const jumpTo = useCallback(
    (next: number) => {
      setDone(false)
      setIndex(Math.max(0, Math.min(beats.length - 1, next)))
    },
    [beats.length]
  )

  const restart = useCallback(() => {
    setDone(false)
    setIndex(0)
    setPlaying(!reduced)
  }, [reduced])

  const chapterOf = (i: number) => beats[i]?.chapter
  const activeChapter = chapterOf(index)
  const progress = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0

  const ctx = {
    get: <T,>(key: string, fallback: T): T =>
      (state[key] as T | undefined) ?? fallback,
    typingKey: reduced ? null : (beat?.type?.key ?? null),
    reduced,
  }
  const surfaces = script.render(ctx)

  return (
    <div ref={rootRef} className={cn("select-none", className)}>
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="text-ink-400 hover:text-ink-800 inline-flex items-center gap-1 text-[11px] font-semibold transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              aria-hidden="true"
              className="h-3 w-3"
            >
              <path d="M14 6l-6 6 6 6" />
            </svg>
            {exitLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (done) restart()
            else setPlaying((p) => !p)
          }}
          disabled={reduced}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-colors",
            reduced
              ? "bg-ink-100 text-ink-400"
              : playing
                ? "bg-court-600 text-white"
                : "bg-ink-900 text-white"
          )}
        >
          {done ? (
            "Watch again"
          ) : playing ? (
            <>
              <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </>
          )}
        </button>

        <div className="flex flex-wrap items-center gap-1.5">
          {chapters.map((c, ci) => {
            const first = beats.findIndex((b) => b.chapter === c.id)
            const active = c.id === activeChapter
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => jumpTo(first)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                  active
                    ? "bg-court-50 text-court-700 ring-court-200 ring-1 ring-inset"
                    : "text-ink-500 hover:bg-ink-100 bg-white"
                )}
              >
                {ci + 1}. {c.title}
              </button>
            )
          })}
        </div>

        <span className="text-ink-400 ml-auto text-[11px] font-semibold tabular-nums">
          Beat {index + 1} of {beats.length}
        </span>
      </div>

      {/* Progress */}
      <div className="bg-ink-100 mb-4 h-1 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full bg-[color:var(--brand,#1a73e8)] transition-[width] duration-150 ease-linear motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stage */}
      <SplitStage
        mode={stage}
        hasPhone={hasPhone}
        soloPhone={script.soloPhone}
        desktop={surfaces.desktop}
        phone={surfaces.phone}
        url={url}
        stageRef={stageRef}
        reserveBelow={reserveBelow}
      >
        <AnimatedCursor
          stageRef={stageRef}
          target={beat?.cursor}
          hover={beat?.hover}
          press={beat?.press}
          beatKey={`${index}-${beat?.id ?? ""}`}
          reduced={reduced}
        />
        {beat?.toast && !reduced && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center">
            <div className="demo-toast bg-ink-950 flex items-center gap-3 rounded-2xl px-5 py-3 text-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.6)]">
              <span className="bg-court-500 flex h-6 w-6 items-center justify-center rounded-full">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="h-3.5 w-3.5"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-[13px] font-semibold">{beat.toast}</span>
            </div>
          </div>
        )}
      </SplitStage>

      {/* Small screens show the desktop surface small. Say so rather than
          panning or zooming around it. A phone-only demo has nothing to
          apologise for, so it says nothing. */}
      {!script.soloPhone && (
        <p className="text-ink-400 mt-3 text-[11px] font-medium sm:hidden">
          The desktop screen is scaled down to fit your phone. Turn it sideways, or open
          this on a laptop, to read every detail.
        </p>
      )}

      {/* Caption */}
      <div className="mt-4">
        <StepCaption
          role={role}
          roleTone={roleTone}
          chapterTitle={chapters.find((c) => c.id === activeChapter)?.title}
        >
          {beat?.caption}
        </StepCaption>
      </div>

      {/* Manual stepping. The only way through in reduced motion. */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => jumpTo(index - 1)}
          className={cn(
            "text-ink-400 hover:text-ink-700 text-xs font-semibold",
            index === 0 && "invisible"
          )}
        >
          Back a beat
        </button>
        {reduced ? (
          <p className="text-ink-400 text-[11px] font-medium">
            Motion is reduced on this device, so each beat shows its finished screen.
          </p>
        ) : (
          <p className="text-ink-400 text-[11px] font-medium">
            Jump to any chapter above. Nothing here needs an account.
          </p>
        )}
        <button
          type="button"
          onClick={() => jumpTo(index + 1)}
          className={cn(
            "text-ink-600 hover:text-ink-900 text-xs font-semibold",
            index >= beats.length - 1 && "invisible"
          )}
        >
          Next beat
        </button>
      </div>
    </div>
  )
}
