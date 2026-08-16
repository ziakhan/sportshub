"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/components/ui/cn"
import { SceneStage, SplitStage } from "./frames"
import {
  AnimatedCursor,
  BeatCallout,
  CURSOR_ARRIVE_MS,
  DEMO_RATES,
  DemoOverlayStyles,
  EMPHASIS_HOLD_MS,
  EmphasisRing,
  StepCaption,
  restoreDemoRate,
  setDemoRate,
  useDemoRate,
  usePrefersReducedMotion,
  type DemoRate,
} from "./motion"
import type { DemoBeat, DemoScript, StageMode } from "./types"

/**
 * Total dwell for a beat, in SCRIPT milliseconds (before the playback rate).
 *
 * One function, used by the scheduler, the progress bar and the chapter
 * markers alike, so an emphasized beat's extra seconds are part of the
 * timeline rather than a pause bolted onto autoplay: jumping to a chapter
 * lands on exactly the beat it always did.
 */
function holdOf(beat: DemoBeat | undefined): number {
  if (!beat) return 2000
  const extra = beat.holdMs ?? (beat.emphasize ? EMPHASIS_HOLD_MS : 0)
  return beat.hold + extra
}

/** The element a beat's ring goes around: the cursor target, or the one the
 *  beat named when nothing is being clicked. */
function emphasisTarget(beat: DemoBeat | undefined): string | undefined {
  if (!beat?.emphasize) return undefined
  return typeof beat.emphasize === "string" ? beat.emphasize : beat.cursor
}

/** What a callout points at, in the order a beat means it. */
function calloutTarget(beat: DemoBeat | undefined): string | undefined {
  if (!beat?.callout) return undefined
  return beat.cursor ?? emphasisTarget(beat) ?? beat.hover
}

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
  const rate = useDemoRate()

  /* The rate is a session choice, so a viewer who set 2x on the last demo
     opens this one at 2x. Read on the client, after mount. */
  useEffect(() => {
    restoreDemoRate()
  }, [])

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

  /* Cumulative timing, for the progress bar and the chapter markers. Emphasis
     dwell is part of the timeline, so the bar tells the truth about it. */
  const { total, starts } = useMemo(() => {
    const s: number[] = []
    let acc = 0
    for (const b of beats) {
      s.push(acc)
      acc += holdOf(b)
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

  /* Scene presentation has no address bar, so the context strip carries the
     same duty and accumulates the same way. */
  const context = useMemo(() => {
    let current = script.context
    for (let i = 0; i <= index && i < beats.length; i += 1) {
      if (beats[i].context) current = beats[i].context
    }
    return current
  }, [beats, index, script.context])

  /* Autoplay: advance when the beat's hold runs out. The hold is script time,
     so the wall-clock wait is that divided by the playback rate. */
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
    }, holdOf(beat) / rate)
    return () => clearTimeout(t)
  }, [playing, reduced, done, index, beat, beats.length, rate])

  /* Progress. Coarse on purpose: a bar does not need 60fps. The bar is drawn
     in script time, so it fills at the same place in the story at every
     speed and simply gets there sooner. */
  useEffect(() => {
    setElapsed(starts[index] ?? 0)
    if (!playing || reduced) return
    const started = Date.now()
    const id = setInterval(() => {
      const within = Math.min((Date.now() - started) * rate, holdOf(beat))
      setElapsed((starts[index] ?? 0) + within)
    }, 120)
    return () => clearInterval(id)
  }, [index, playing, reduced, starts, beat, rate])

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
  const beatKey = `${index}-${beat?.id ?? ""}`
  const progress = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0

  const ctx = {
    get: <T,>(key: string, fallback: T): T =>
      (state[key] as T | undefined) ?? fallback,
    typingKey: reduced ? null : (beat?.type?.key ?? null),
    reduced,
  }
  const surfaces = script.render(ctx)
  const scene = script.presentation === "scene"

  /* The overlay pack, built once and handed to whichever stage is presenting:
     the hand, the ring, the balloon and the toast all measure against the same
     `stageRef`, so neither presentation has its own choreography. */
  const overlays = (
    <>
      <AnimatedCursor
        stageRef={stageRef}
        target={beat?.cursor}
        hover={beat?.hover}
        press={beat?.press}
        beatKey={beatKey}
        reduced={reduced}
      />
      {/* The ring goes on from the top of the beat, so the eye is already on
          the right element while the hand is still travelling to it. */}
      <EmphasisRing
        key={`ring-${beatKey}`}
        stageRef={stageRef}
        target={emphasisTarget(beat)}
        beatKey={beatKey}
        reduced={reduced}
      />
      {/* The balloon lands WITH the hand. A beat with nothing to click puts
          it up almost at once, because there is no glide to wait for. */}
      <BeatCallout
        key={`callout-${beatKey}`}
        stageRef={stageRef}
        text={beat?.callout}
        target={calloutTarget(beat)}
        beatKey={beatKey}
        reduced={reduced}
        delayMs={(beat?.cursor ? CURSOR_ARRIVE_MS : 180) / rate}
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
            <span className="text-[14px] font-semibold">{beat.toast}</span>
          </div>
        </div>
      )}
    </>
  )

  return (
    <div
      ref={rootRef}
      className={cn("select-none", className)}
      /* The timeline in script milliseconds. The pacing gate reads this rather
         than watching a demo play out in real time. */
      data-demo-runtime-ms={total}
      data-demo-beats={beats.length}
    >
      <DemoOverlayStyles />

      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="text-ink-400 hover:text-ink-800 inline-flex items-center gap-1 text-[14px] font-semibold transition-colors"
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
            "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[14px] font-bold transition-colors",
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
                  "rounded-full px-3 py-1 text-[14px] font-semibold transition-colors",
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

        <div className="ml-auto flex items-center gap-3">
          <SpeedControl rate={rate} onChange={setDemoRate} disabled={reduced} />
          <span className="text-ink-400 text-[14px] font-semibold tabular-nums">
            Beat {index + 1} of {beats.length}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-ink-100 mb-4 h-1 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full bg-[color:var(--brand,#1a73e8)] transition-[width] duration-150 ease-linear motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stage. Two presentations, one set of overlays: the cursor, the ring,
          the callout and the toast measure against `stageRef` either way. */}
      {scene ? (
        <SceneStage
          mode={stage === "desktop" ? "wide" : "duo"}
          phones={script.scenePhones}
          desktop={surfaces.desktop}
          phone={surfaces.phone}
          context={context}
          frameLabels={surfaces.frameLabels}
          stageRef={stageRef}
          reserveBelow={reserveBelow}
        >
          {overlays}
        </SceneStage>
      ) : (
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
          {overlays}
        </SplitStage>
      )}

      {/* Small screens show the desktop surface small. Say so rather than
          panning or zooming around it. A phone-only demo has nothing to
          apologise for, so it says nothing. */}
      {!script.soloPhone && !script.scenePhones && (
        <p className="text-ink-400 mt-3 text-[11px] font-medium sm:hidden">
          The desktop screen is scaled down to fit your phone. Turn it sideways, or open
          this on a laptop, to read every detail.
        </p>
      )}

      {/* Caption. ONE VOICE (owner ruling 2026-08-16): when the beat explains
          itself at the point of action, the bar under the stage stops talking
          over it and shows the chapter alone. Reduced motion keeps the
          sentence, because there the caption IS the narration. */}
      <div className="mt-4">
        <StepCaption
          role={role}
          roleTone={roleTone}
          chapterTitle={chapters.find((c) => c.id === activeChapter)?.title}
          quiet={Boolean(beat?.callout) && !reduced}
        >
          {beat?.callout && !reduced
            ? chapters.find((c) => c.id === activeChapter)?.title
            : beat?.caption}
        </StepCaption>
      </div>

      {/* Manual stepping. The only way through in reduced motion. */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => jumpTo(index - 1)}
          className={cn(
            "text-ink-400 hover:text-ink-700 text-[14px] font-semibold",
            index === 0 && "invisible"
          )}
        >
          Back a beat
        </button>
        {reduced ? (
          <p className="text-ink-400 text-[14px] font-medium">
            Motion is reduced on this device, so each beat shows its finished screen.
          </p>
        ) : (
          <p className="text-ink-400 text-[14px] font-medium">
            Jump to any chapter above. Nothing here needs an account.
          </p>
        )}
        <button
          type="button"
          onClick={() => jumpTo(index + 1)}
          className={cn(
            "text-ink-600 hover:text-ink-900 text-[14px] font-semibold",
            index >= beats.length - 1 && "invisible"
          )}
        >
          Next beat
        </button>
      </div>
    </div>
  )
}

/* ── Speed ───────────────────────────────────────────────────────────────── */

/**
 * Playback speed (owner ruling 2026-08-16: "let fast viewers speed up").
 *
 * A real radio group, not three buttons that look like one: one tab stop for
 * the whole control, arrow keys and Home / End move between the speeds, and
 * the chosen speed carries `aria-checked`. The chips are visually compact
 * because they sit in a row of compact chips, so each one carries a 44px
 * touch target as an invisible overlay rather than by growing the bar.
 *
 * The gold active state is the same amber the Play button uses, on ink text
 * that clears contrast comfortably. White-on-glass chips would disappear here:
 * this control bar is light.
 */
function SpeedControl({
  rate,
  onChange,
  disabled,
}: {
  rate: DemoRate
  onChange: (rate: DemoRate) => void
  disabled?: boolean
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const activeIndex = Math.max(0, DEMO_RATES.indexOf(rate))

  const move = (next: number) => {
    const i = (next + DEMO_RATES.length) % DEMO_RATES.length
    onChange(DEMO_RATES[i])
    refs.current[i]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="Playback speed"
      className={cn(
        "bg-ink-100 ring-ink-200/70 inline-flex items-center gap-0.5 rounded-full p-0.5 ring-1 ring-inset",
        disabled && "opacity-50"
      )}
    >
      {DEMO_RATES.map((r, i) => {
        const active = r === rate
        return (
          <button
            key={r}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${r} times speed`}
            disabled={disabled}
            tabIndex={i === activeIndex ? 0 : -1}
            onClick={() => onChange(r)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault()
                move(activeIndex + 1)
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault()
                move(activeIndex - 1)
              } else if (e.key === "Home") {
                e.preventDefault()
                move(0)
              } else if (e.key === "End") {
                e.preventDefault()
                move(DEMO_RATES.length - 1)
              }
            }}
            className={cn(
              // The pseudo element is the touch target: 44px tall, centred on
              // the chip, invisible, and it does not change the row's height.
              "relative min-w-[44px] cursor-pointer rounded-full px-2.5 py-1 text-[14px] font-bold tabular-nums transition-colors duration-200",
              "after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']",
              "focus-visible:ring-court-600 outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              "motion-reduce:transition-none",
              active ? "bg-gold-400 text-[#0b1628] shadow-sm" : "text-ink-500 hover:text-ink-800",
              disabled && "cursor-default"
            )}
          >
            {r}x
          </button>
        )
      })}
    </div>
  )
}
