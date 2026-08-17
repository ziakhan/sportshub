"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/components/ui/cn"
import { SceneStage, SplitStage } from "./frames"
import {
  AnimatedCursor,
  BeatCallout,
  CURSOR_ARRIVE_MS,
  DemoOverlayStyles,
  EMPHASIS_HOLD_MS,
  EmphasisRing,
  StepCaption,
  useDemoRate,
  usePrefersReducedMotion,
} from "./motion"
import type { DemoBeat, DemoScript, StageMode } from "./types"
import { trackEvent } from "@/components/launch/launch-tracker"

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
 * The element the beat is ACTING on: what the hand is going to, else what the
 * ring is around, else what the balloon is pointing at.
 *
 * A computer shows the whole scene at once and ignores this. A phone cannot, so
 * the mobile presentations follow it: the keyhole pans it to the middle, and
 * the handset pair brings the phone it lives in to the front.
 */
function activeTarget(beat: DemoBeat | undefined): string | undefined {
  if (!beat) return undefined
  return beat.cursor ?? emphasisTarget(beat) ?? beat.hover
}

/**
 * A 44px touch target, on a phone, without a 44px control.
 *
 * The transport bar is a row of compact chips by design, and growing them for
 * a finger would push the stage down the screen. So the target is an invisible
 * pseudo element centred on the chip, and it exists only under `sm`: on a
 * computer these overlays would sit between two wrapped rows of chapter chips
 * and quietly steal each other's clicks.
 */
const TOUCH_44 =
  "max-sm:after:absolute max-sm:after:inset-x-0 max-sm:after:top-1/2 max-sm:after:h-11 max-sm:after:-translate-y-1/2 max-sm:after:content-['']"

/** Session flag for the one-time keyboard hint. */
const HINT_KEY = "sportshub.demo.spacehint"

/** The transport buttons: real buttons, 44px tall, on every screen size. */
const TRANSPORT =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 text-[14px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-court-600 focus-visible:ring-offset-1 disabled:opacity-40 motion-reduce:transition-none"

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
  reserveBelow,
}: {
  script: DemoScript
  /** Who is acting, shown on the caption chip. */
  role: string
  roleTone?: "club" | "league" | "parent" | "referee"
  className?: string
  /** Start playing as soon as the player mounts (the Play press did this). */
  autoStart?: boolean
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

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(autoStart)
  const [elapsed, setElapsed] = useState(0)
  const [done, setDone] = useState(false)
  /* The keyboard hint is a one-time read, so the session remembers it. */
  const [hint, setHint] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  /* Watch telemetry (owner 2026-08-17): the beacon learns when a demo is
     started, which chapters get reached and whether it played to the end.
     The path IS the demo (/demos/<slug>), so nothing needs threading. */
  const startedRef = useRef(false)
  useEffect(() => {
    if (playing && !startedRef.current) {
      startedRef.current = true
      trackEvent("demo", window.location.pathname, { action: "play" })
    }
  }, [playing])
  const trackedChapterRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const chapter = beats[index]?.chapter
    if (!startedRef.current || !chapter || chapter === trackedChapterRef.current) return
    trackedChapterRef.current = chapter
    trackEvent("demo", window.location.pathname, { action: "chapter", chapter })
  }, [index, beats])
  useEffect(() => {
    if (done) trackEvent("demo", window.location.pathname, { action: "done" })
  }, [done])

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

  /* The hint appears once per session, and pressing the key it teaches is
     what retires it. */
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(HINT_KEY)) return
    } catch {
      /* private browsing: the hint simply shows again next time */
    }
    setHint(true)
  }, [])

  const retireHint = useCallback(() => {
    setHint(false)
    try {
      window.sessionStorage.setItem(HINT_KEY, "1")
    } catch {
      /* nothing to remember it with */
    }
  }, [])

  /**
   * Keyboard transport: space pauses and plays, the arrows step.
   *
   * It never fires while somebody is typing (an input, a textarea, a select or
   * anything contenteditable), and it leaves modified presses alone so browser
   * shortcuts still work. Space is prevented because otherwise it scrolls the
   * page, and would fire a focused button a second time.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (el?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault()
        retireHint()
        if (done) restart()
        else if (!reduced) setPlaying((p) => !p)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        jumpTo(index + 1)
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        jumpTo(index - 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [done, reduced, restart, jumpTo, index, retireHint])

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
      {/* The toast belongs to the VIEW, not to a target, so on a phone it is
          centred on the part of the scene the keyhole is showing rather than on
          the whole composed region. The stage publishes that window as CSS
          variables; a computer never sets them and gets `inset-x-0`. */}
      {beat?.toast && !reduced && (
        <div
          className="pointer-events-none absolute top-4 z-40 flex justify-center"
          style={{
            left: "var(--demo-view-left, 0px)",
            width: "var(--demo-view-w, 100%)",
          }}
        >
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

      {/* Chapter jumps. The transport itself lives under the stage now, with
          the progress bar between them, so the top of the player is nothing
          but a way to skip to a part of the story.
          The phone padding is not decoration: a sideways scroller CLIPS in
          both axes, so without it the 44px touch overlay on each chip would
          be cut back to the chip's own 29px. */}
      <div className="mb-2 flex w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto py-2 sm:mb-3 sm:flex-wrap sm:overflow-x-visible sm:py-0">
        {chapters.map((c, ci) => {
          const first = beats.findIndex((b) => b.chapter === c.id)
          const active = c.id === activeChapter
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => jumpTo(first)}
              className={cn(
                "relative shrink-0 rounded-full px-3 py-1 text-[14px] font-semibold transition-colors",
                TOUCH_44,
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

      {/* Progress */}
      <div className="bg-ink-100 mb-2.5 h-1 overflow-hidden rounded-full sm:mb-4">
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
          /* What a phone follows: the keyhole pans it to the middle, the
             handset pair brings its phone to the front. Ignored on a
             computer, where the whole scene is already on screen. */
          focusTarget={activeTarget(beat)}
          beatKey={beatKey}
          reduced={reduced}
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

      {/* One line for phones, and what it says depends on what the stage did.
          A scene keeps its authored size and pans, so the line is an
          invitation. A framed story still scales its browser window down, so
          the line is still an apology. A phone-only demo, and the handset pair
          with its own switcher, have nothing to explain. */}
      {!script.soloPhone && !script.scenePhones && (
        <p className="text-ink-400 mt-2 text-[14px] font-medium sm:hidden">
          {scene
            ? "Swipe sideways to look around."
            : "The desktop screen is scaled down to fit your phone. Turn it sideways, or open this on a laptop, to read every detail."}
        </p>
      )}

      {/* Caption. ONE VOICE (owner ruling 2026-08-16): when the beat explains
          itself at the point of action, the bar under the stage stops talking
          over it and shows the chapter alone. Reduced motion keeps the
          sentence, because there the caption IS the narration. */}
      <div className="mt-2.5 sm:mt-4">
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

      {/* The transport: Back, Pause and Next, as real buttons with real touch
          targets, and the same three things the keyboard does. When the story
          runs out they are replaced by one calm card. */}
      {done ? (
        <div className="border-ink-200 mt-3 flex flex-wrap items-center gap-3 rounded-2xl border bg-white px-4 py-3">
          <p className="text-ink-700 text-[15px] font-semibold">That is the whole story.</p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* The soft ask (owner 2026-08-17): demos stay open, and the person
                who just watched one gets one calm invitation, never a gate. */}
            <Link
              href="/#notify"
              className={cn(TRANSPORT, "bg-gold-500 text-ink-950 hover:bg-gold-400")}
            >
              Get notified at launch
            </Link>
            <button
              type="button"
              onClick={restart}
              className={cn(TRANSPORT, "bg-ink-900 text-white hover:bg-ink-800")}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch again
            </button>
            <Link
              href="/demos"
              className={cn(TRANSPORT, "border-ink-200 text-ink-700 border bg-white hover:bg-ink-50")}
            >
              All demos
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center gap-2 sm:mt-2">
          <button
            type="button"
            onClick={() => jumpTo(index - 1)}
            disabled={index === 0}
            aria-label="Back"
            className={cn(TRANSPORT, "border-ink-200 text-ink-700 border bg-white hover:bg-ink-50")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              aria-hidden="true"
              className="h-3.5 w-3.5"
            >
              <path d="M14 6l-6 6 6 6" />
            </svg>
            Back
          </button>

          <button
            type="button"
            onClick={() => {
              retireHint()
              setPlaying((p) => !p)
            }}
            disabled={reduced}
            aria-pressed={!playing}
            aria-label={playing ? "Pause" : "Play"}
            className={cn(
              TRANSPORT,
              reduced ? "bg-ink-100 text-ink-400" : playing ? "bg-court-600 text-white" : "bg-ink-900 text-white"
            )}
          >
            {playing ? (
              <>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => jumpTo(index + 1)}
            disabled={index >= beats.length - 1}
            aria-label="Next"
            className={cn(TRANSPORT, "border-ink-200 text-ink-700 border bg-white hover:bg-ink-50")}
          >
            Next
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              aria-hidden="true"
              className="h-3.5 w-3.5"
            >
              <path d="M10 6l6 6-6 6" />
            </svg>
          </button>

          {hint && !reduced && (
            <span className="border-ink-200 text-ink-500 hidden rounded-full border bg-white px-3 py-1 text-[14px] font-semibold sm:inline">
              Space to pause
            </span>
          )}

          <p className="text-ink-400 ml-auto hidden text-[14px] font-medium sm:block">
            {reduced
              ? "Motion is reduced on this device, so each step shows its finished screen."
              : "Jump to any chapter above. Nothing here needs an account."}
          </p>
        </div>
      )}
    </div>
  )
}
