"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/components/ui/cn"
import { AdvanceContext } from "./advance"
import { DesktopFrame, PhoneFrame } from "./frames"
import type { FlowDef, SceneDef } from "./types"

const PERSONA_TONES: Record<string, string> = {
  league: "bg-play-50 text-play-700 ring-play-100",
  club: "bg-court-50 text-court-700 ring-court-100",
  parent: "bg-hoop-50 text-hoop-600 ring-hoop-100",
  referee: "bg-gold-50 text-gold-600 ring-gold-100",
}

/** Autoplay dwell: scales with how much is on the screen. */
function dwellFor(el: HTMLElement | null): number {
  const chars = el?.textContent?.length ?? 400
  return Math.min(26000, Math.max(4500, 3000 + chars * 22))
}

export function DemoPlayer({ flow }: { flow: FlowDef }) {
  const [index, setIndex] = useState(0)
  const [autoplay, setAutoplay] = useState(false)
  const [paused, setPaused] = useState(false)
  const [confirmText, setConfirmText] = useState<string | null>(null)
  const [entering, setEntering] = useState(true)
  const [done, setDone] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<(() => void) | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const busyRef = useRef(false)

  const scene = flow.scenes[index]
  const total = flow.scenes.length
  const chapterIndex = flow.chapters.findIndex((c) => c.id === scene.chapter)

  const goTo = useCallback(
    (next: number) => {
      busyRef.current = false
      setConfirmText(null)
      if (next >= total) {
        setDone(true)
        setAutoplay(false)
        return
      }
      setEntering(false)
      setTimeout(() => {
        setIndex(next)
        setEntering(true)
        // The reader scrolled down to press the control; the next step must
        // greet them at the top, not wherever the last screen left them.
        const root = rootRef.current
        if (root && root.getBoundingClientRect().top < -8) {
          root.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      }, 180)
    },
    [total]
  )

  const advance = useCallback(
    (confirm?: string) => {
      if (busyRef.current) return
      busyRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      if (confirm) {
        setConfirmText(confirm)
        setTimeout(() => goTo(index + 1), 1400)
      } else {
        goTo(index + 1)
      }
    },
    [goTo, index]
  )

  const api = useMemo(
    () => ({
      advance,
      register: (fn: () => void) => {
        triggerRef.current = fn
        return () => {
          if (triggerRef.current === fn) triggerRef.current = null
        }
      },
    }),
    [advance]
  )

  // Autoplay: wait a content-sized dwell, then press the highlighted control.
  useEffect(() => {
    if (!autoplay || paused || done) return
    const dwell = dwellFor(stageRef.current)
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) triggerRef.current()
      else advance()
    }, dwell)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [autoplay, paused, index, done, advance])

  // Keyboard: Enter or the right arrow presses the highlighted control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "ArrowRight") {
        if (triggerRef.current) triggerRef.current()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Clicking the demo itself pauses and resumes autoplay.
  const onStageClick = () => {
    if (autoplay) setPaused((p) => !p)
  }

  const restart = () => {
    setDone(false)
    setIndex(0)
    setEntering(true)
    setPaused(false)
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="bg-court-100 text-court-700 mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-8 w-8">
            <path d="M8 21h8M12 17v4M17 5h3a1 1 0 0 1 1 1c0 2.5-1.5 4.5-4 5M7 5H4a1 1 0 0 0-1 1c0 2.5 1.5 4.5 4 5" />
            <path d="M17 3H7v6a5 5 0 0 0 10 0V3Z" />
          </svg>
        </div>
        <h2 className="text-ink-900 text-2xl font-bold">That is the whole season</h2>
        <p className="text-ink-500 mx-auto mt-3 max-w-md text-sm leading-relaxed">
          Tryout signups to the championship, every step you just clicked through is the real
          product. Set up your club or league and run it the same way.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/sign-up"
            className="brand-focus inline-flex items-center rounded-xl px-5 py-3 text-base font-semibold text-[color:var(--brand-on)]"
            style={{ backgroundColor: "var(--brand)" }}
          >
            Get started free
          </a>
          <button
            onClick={restart}
            className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border bg-white px-5 py-3 text-base font-semibold"
          >
            Watch it again
          </button>
        </div>
      </div>
    )
  }

  return (
    <AdvanceContext.Provider value={api}>
      <div ref={rootRef} className="select-none scroll-mt-28" data-demo-player data-demo-scene={scene.id}>
        {/* Header: chapters, progress, autoplay */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {flow.chapters.map((c, ci) => {
              const first = flow.scenes.findIndex((s) => s.chapter === c.id)
              const active = c.id === scene.chapter
              const past = ci < chapterIndex
              return (
                <button
                  key={c.id}
                  onClick={() => goTo(first)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    active
                      ? "bg-ink-900 text-white"
                      : past
                        ? "bg-ink-100 text-ink-600 hover:bg-ink-200"
                        : "text-ink-400 hover:bg-ink-100 hover:text-ink-600 bg-white"
                  )}
                >
                  {ci + 1}. {c.title}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-ink-400 text-xs font-semibold tabular-nums">
              Step {index + 1} of {total}
            </span>
            <button
              onClick={() => {
                setAutoplay((a) => !a)
                setPaused(false)
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                autoplay
                  ? "border-court-200 bg-court-50 text-court-700"
                  : "border-ink-200 text-ink-600 hover:bg-ink-50 bg-white"
              )}
            >
              {autoplay ? (
                <>
                  <span className="bg-court-500 h-1.5 w-1.5 animate-pulse rounded-full" />
                  {paused ? "Paused" : "Playing"}
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Autoplay
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-ink-100 mb-5 h-1 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${((index + 1) / total) * 100}%`, backgroundColor: "var(--brand)" }}
          />
        </div>

        {/* Caption above the frame so it never gets lost below the fold */}
        <div className="mb-4 flex flex-wrap items-start gap-x-3 gap-y-2">
          <span
            className={cn(
              "mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] ring-1 ring-inset",
              PERSONA_TONES[scene.persona]
            )}
          >
            {scene.personaLabel}
          </span>
          <p className="text-ink-700 min-w-[240px] flex-1 text-sm font-medium leading-relaxed">
            {scene.caption}
          </p>
          {!autoplay && (
            <span className="demo-next-chip bg-hoop-500 shadow-hoop-200 mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white shadow-md">
              Click the glowing button
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </span>
          )}
        </div>

        {/* Stage */}
        <div
          ref={stageRef}
          onClick={onStageClick}
          className={cn("relative transition-opacity duration-150", entering ? "opacity-100" : "opacity-0")}
        >
          <div key={scene.id} className="demo-scene-enter">
            <SceneShell scene={scene} />
          </div>

          {/* Status toast: drops from the top like a real notification */}
          {confirmText && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
              <div className="demo-toast bg-ink-950 flex items-center gap-3 rounded-2xl px-5 py-3.5 text-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.6)]">
                <span className="bg-court-500 flex h-7 w-7 items-center justify-center rounded-full text-white">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-sm font-semibold">{confirmText}</span>
              </div>
            </div>
          )}

          {/* Autoplay paused veil */}
          {autoplay && paused && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/55">
              <span className="border-ink-200 text-ink-700 rounded-full border bg-white px-4 py-2 text-sm font-semibold shadow-sm">
                Paused. Click anywhere to keep going.
              </span>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={() => index > 0 && goTo(index - 1)}
            className={cn(
              "text-ink-400 hover:text-ink-600 flex items-center gap-1 text-xs font-semibold",
              index === 0 && "invisible"
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
          <p className="text-ink-400 text-xs font-medium">
            {autoplay
              ? "Playing on its own. Click the demo to pause."
              : "Go at your own pace. Click the glowing button to continue."}
          </p>
        </div>
      </div>
    </AdvanceContext.Provider>
  )
}

function SceneShell({ scene }: { scene: SceneDef }) {
  const Screen = scene.screen
  if (scene.frame === "phone") {
    return (
      <PhoneFrame sceneKey={scene.id}>
        <Screen />
      </PhoneFrame>
    )
  }
  if (scene.frame === "interstitial" || scene.frame === "duo") {
    // Duo scenes and chapter dividers lay themselves out fully.
    return <Screen />
  }
  return (
    <DesktopFrame url={scene.url ?? "/"} sceneKey={scene.id}>
      <Screen />
    </DesktopFrame>
  )
}
