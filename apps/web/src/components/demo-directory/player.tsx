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
  endMode = "invite",
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
  /**
   * What the closing card offers.
   *
   * "invite" is the public demo directory: the soft ask plus links onward.
   * "replay" is for a demo embedded inside something you must not navigate
   * away from, like a pitch deck, where "Get notified at launch" and "All
   * demos" would walk the viewer out of the presentation. It offers only a
   * replay, so the slide never looks like it died either.
   */
  endMode?: "invite" | "replay"
}) {
  const { beats, chapters } = script
  const reduced = usePrefersReducedMotion()
  const rate = useDemoRate()

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(autoStart)
  const [elapsed, setElapsed] = useState(0)
  const [done, setDone] = useState(false)

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

  const [flash, setFlash] = useState<"pause" | "play" | null>(null)
  const flashTimer = useRef<number | null>(null)
  const pressOrigin = useRef<{ x: number; y: number } | null>(null)
  useEffect(
    () => () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current)
    },
    []
  )
  const pulse = useCallback((kind: "pause" | "play") => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    setFlash(kind)
    flashTimer.current = window.setTimeout(() => setFlash(null), 700)
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
        if (done) restart()
        else if (!reduced)
          setPlaying((p) => {
            pulse(p ? "pause" : "play")
            return !p
          })
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
  }, [done, reduced, restart, jumpTo, index, pulse])

  /**
   * The active actor, resolved by replaying the handoff signals up to the
   * current beat: an explicit `actor` wins; a hard stage switch to one
   * surface implies its own actor; `split` says nothing and keeps whoever
   * was already driving. Jump-safe by construction — the walk starts from
   * the beginning every time, so chapter 3 answers the same whether chapter
   * 2 was watched or skipped.
   */
  const activeActor = useMemo(() => {
    const init = script.initialStage
    let actor: "desktop" | "phone" | null =
      init === "phone" ? "phone" : init === "desktop" ? "desktop" : null
    for (let i = 0; i <= index && i < beats.length; i++) {
      const b = beats[i]
      if (b.stage === "phone") actor = "phone"
      else if (b.stage === "desktop") actor = "desktop"
      if (b.actor) actor = b.actor
    }
    return actor
  }, [index, beats, script.initialStage])
  const surfaceRole = (activeActor && script.roles?.[activeActor]) || null
  const activeRole = surfaceRole?.label ?? role
  const activeTone = surfaceRole?.tone ?? roleTone

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
  /**
   * Stage click = pause/resume (owner 2026-08-19, UX-reviewed).
   *
   * The YouTube interaction without the YouTube chrome: the viewer's eyes are
   * on the stage, so the pause is where they are already looking, and the
   * persistent transport top-left stays as the DISCOVERABLE, accessible
   * control (gesture-alternative: a gesture never replaces a visible button).
   *
   * Three guards keep the click from doing something the viewer did not mean:
   *  - a ~10px movement threshold, so panning a scene on a phone is never
   *    read as a tap (drag-threshold);
   *  - clicks on real controls inside the stage (a phone switcher, a link)
   *    are ignored rather than doubled into a pause;
   *  - reduced motion and the end card disable it entirely, matching the
   *    transport's own disabled states.
   * The centre glyph flashes on every toggle so the state change is confirmed
   * at the point of gaze (press-feedback), then fades fully (opacity-threshold).
   */
  /**
   * The launch cue (owner 2026-08-19, second pass). The first pass taught the
   * stage click behind the SAME session flag as the old keyboard chip, so
   * anyone who had ever paused was never taught — the owner opened a demo and
   * saw nothing. Teaching the surface is not a one-shot: the cue now shows on
   * EVERY launch, the way YouTube shows its state glyph on every video, and
   * costs three seconds of corner-of-the-eye at most.
   *
   * Two cues, one visual language, both pointer-events-none:
   *  - at launch: the centred translucent PAUSE glyph with one caption line,
   *    self-fading by ~3.4s;
   *  - on hover (any hover device, all the time): the same glyph, showing the
   *    action a click would take right now — pause while playing, play while
   *    paused. Touch devices have no hover; the launch cue plus the caption
   *    line under the stage carry them.
   */
  const [launchCue, setLaunchCue] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setLaunchCue(false), 3400)
    return () => window.clearTimeout(t)
  }, [])

  /**
   * Idle fade (owner 2026-08-19): a resting cursor is someone WATCHING, and
   * the glyph must not sit over the story they are watching. Any movement
   * counts as renewed intent and brings it back. State flips only at the two
   * edges — the ref carries the current value so the pointermove storm never
   * causes a render, and the timer is the only thing that ever re-renders.
   */
  const [cursorLive, setCursorLive] = useState(false)
  const cursorLiveRef = useRef(false)
  const idleTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
    },
    []
  )
  const wake = useCallback(() => {
    if (!cursorLiveRef.current) {
      cursorLiveRef.current = true
      setCursorLive(true)
    }
    if (idleTimer.current) window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => {
      cursorLiveRef.current = false
      setCursorLive(false)
    }, 2200)
  }, [])

  const stagePress = {
    onPointerDown: (e: React.PointerEvent) => {
      pressOrigin.current = { x: e.clientX, y: e.clientY }
    },
    onPointerMove: wake,
    onPointerEnter: wake,
    onPointerLeave: () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
      cursorLiveRef.current = false
      setCursorLive(false)
    },
    onPointerUp: (e: React.PointerEvent) => {
      const o = pressOrigin.current
      pressOrigin.current = null
      if (!o || done || reduced) return
      if (Math.hypot(e.clientX - o.x, e.clientY - o.y) > 10) return // a drag is a pan
      const t = e.target as HTMLElement | null
      if (t?.closest("button, a, [role='button']")) return // real controls stay real
      setPlaying((prev) => {
        pulse(prev ? "pause" : "play")
        return !prev
      })
    },
  }

  /* Solid, full-strength role colours for the stage bug. The caption pill
     below the stage keeps its pastel voice; the bug is IDENTITY and has to
     survive being glanced at over a busy mock UI. Gold takes ink text —
     white on gold fails contrast. */
  const BUG_TONES: Record<string, string> = {
    club: "bg-court-600 text-white",
    league: "bg-play-600 text-white",
    parent: "bg-hoop-500 text-white",
    referee: "bg-gold-500 text-ink-950",
  }

  const overlays = (
    <>
      {/* Who is driving, ON the thing being watched (owner 2026-08-19): the
          broadcast bug. Keyed by role so any future per-beat handoff remounts
          it and the pulse announces the change; today it also pulses once at
          launch, which is the introduction. */}
      <div
        key={`bug-${activeRole}`}
        className="pointer-events-none absolute left-2.5 top-2.5 z-40 sm:left-3 sm:top-3"
      >
        <span
          className={cn(
            "demo-rolebug flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] shadow-lg",
            BUG_TONES[activeTone] ?? BUG_TONES.club
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80 motion-safe:animate-pulse" />
          {activeRole}
        </span>
      </div>
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
      {launchCue && !reduced && !done && (
        <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-3">
          <span className="demo-launchcue flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-ink-950/70 text-white shadow-xl backdrop-blur-sm">
            <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </span>
          <span className="demo-launchcue bg-ink-950/70 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-white backdrop-blur-sm">
            <span className="sm:hidden">Tap anywhere to pause</span>
            <span className="hidden sm:inline">Click anywhere or press Space to pause</span>
          </span>
        </div>
      )}
      {/* The YouTube hover: whenever the pointer is over the stage, the glyph
          for what a click would DO right now. Hover devices only, by media
          feature rather than viewport width, and never while the launch cue or
          the click flash already owns the centre. */}
      {!reduced && !done && !launchCue && !flash && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-30 hidden items-center justify-center opacity-0 transition-opacity [@media(hover:hover)]:flex",
            cursorLive
              ? "duration-200 group-hover:opacity-100" // movement: prompt arrival
              : "duration-700" // rest: a slow, quiet exit that clears the stage
          )}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-950/55 text-white backdrop-blur-[2px]">
            {playing ? (
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 fill-current" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </span>
        </div>
      )}
      {/* State flash at the point of gaze. Purely confirmatory; the live
          state is always readable on the transport button top-left. */}
      {flash && !reduced && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
          <span className="demo-flash flex h-16 w-16 items-center justify-center rounded-full bg-ink-950/75 text-white backdrop-blur-sm">
            {flash === "pause" ? (
              <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </span>
        </div>
      )}
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

      {/* Every control in ONE place, above the stage (owner 2026-08-19). The
          transport used to sit below the caption at the very bottom of the
          player, which on most laptops is below the fold: you either watched
          the story or knew where the buttons were, not both, and jumping
          between them meant looking away from the stage. Back/Pause/Next now
          LEAD the row, top left, with the chapter chips beside them — the eye
          holds the controls and the stage in a single glance and nothing is
          ever cut off the bottom of the frame.
          The phone padding on the chip scroller is not decoration: a sideways
          scroller CLIPS in both axes, so without it the 44px touch overlay on
          each chip would be cut back to the chip's own 29px. */}
      <div className="mb-2 flex w-full min-w-0 flex-wrap items-center gap-2 sm:mb-3">
        {!done && (
          <div className="flex shrink-0 items-center gap-1.5">
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
              onClick={() => setPlaying((p) => !p)}
              disabled={reduced}
              aria-pressed={!playing}
              aria-label={playing ? "Pause" : "Play"}
              className={cn(
                TRANSPORT,
                reduced
                  ? "bg-ink-100 text-ink-400"
                  : playing
                    ? "bg-court-600 text-white"
                    : "bg-ink-900 text-white"
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
          </div>
        )}
        {/* Two kinds of control share this row — the transport DOES, the chips
            GO TO. One hairline keeps them two groups instead of seven pills. */}
        {!done && <span aria-hidden="true" className="bg-ink-200 hidden h-6 w-px shrink-0 sm:block" />}
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto py-2 sm:flex-wrap sm:overflow-x-visible sm:py-0">
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
                  ? "bg-[color:var(--brand,#1a73e8)] text-white shadow-sm"
                  : "text-ink-500 hover:bg-ink-100 bg-white"
              )}
            >
              {ci + 1}. {c.title}
            </button>
          )
        })}
        </div>
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
      <div {...stagePress} className={cn("group", !done && !reduced && "cursor-pointer")}>
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
      </div>

      {/* One line for phones, and what it says depends on what the stage did.
          A scene keeps its authored size and pans, so the line is an
          invitation. A framed story still scales its browser window down, so
          the line is still an apology. A phone-only demo, and the handset pair
          with its own switcher, have nothing to explain. */}
      {/* The tap affordance is invisible by nature, so it is SAID on phones
          (owner 2026-08-19: the feature must be known, not discovered by
          accident). Under reduced motion pause is disabled, so the line
          stays silent about it rather than promising a dead control. */}
      <p className="text-ink-400 mt-2 text-[14px] font-medium sm:hidden">
        {script.soloPhone || script.scenePhones
          ? reduced
            ? null
            : "Tap the demo to pause or resume."
          : scene
            ? reduced
              ? "Swipe sideways to look around."
              : "Swipe sideways to look around. Tap the demo to pause."
            : reduced
              ? "The desktop screen is scaled down to fit your phone. Turn it sideways, or open this on a laptop, to read every detail."
              : "The desktop screen is scaled down to fit your phone. Turn it sideways to read every detail, and tap the demo to pause."}
      </p>

      {/* Caption. ONE VOICE (owner ruling 2026-08-16): when the beat explains
          itself at the point of action, the bar under the stage stops talking
          over it and shows the chapter alone. Reduced motion keeps the
          sentence, because there the caption IS the narration. */}
      <div className="mt-2.5 sm:mt-4">
        <StepCaption
          role={activeRole}
          roleTone={activeTone}
          chapterTitle={chapters.find((c) => c.id === activeChapter)?.title}
          quiet={Boolean(beat?.callout) && !reduced}
        >
          {beat?.callout && !reduced
            ? chapters.find((c) => c.id === activeChapter)?.title
            : beat?.caption}
        </StepCaption>
      </div>

      {/* End of story. The transport lives at the top of the player now; the
          only thing that ever renders down here is the closing card, where the
          stage has gone quiet and attention is free for one calm invitation. */}
      {done && (
        <div className="border-ink-200 mt-3 flex flex-wrap items-center gap-3 rounded-2xl border bg-white px-4 py-3">
          <p className="text-ink-700 text-[15px] font-semibold">That is the whole story.</p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {endMode === "replay" ? (
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
            ) : (
              <>
                {/* The soft ask (owner 2026-08-17): demos stay open, and the
                    person who just watched one gets one calm invitation,
                    never a gate. */}
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
