"use client"

/**
 * DemoPlayer — the marketing "watch how it works" walkthrough shell
 * (owner spec 2026-07-18: autoplay video-feel, but a live design system —
 * pause, play, step, jump; every scene is rendered UI with demo data, not
 * a screenshot). Scenes are server-rendered nodes passed in as props, so
 * each journey file stays a plain server component.
 */

import { useEffect, useRef, useState, type ReactNode } from "react"

export interface DemoScene {
  /** Short chip label, e.g. "Post tryout" */
  label: string
  /** One-sentence narration under the frame */
  caption: string
  screen: ReactNode
}

const TICK_MS = 50
const SCENE_MS = 4500

export function DemoPlayer({
  scenes,
  title,
  autoPlay = true,
}: {
  scenes: DemoScene[]
  /** Accessible name for the player region */
  title: string
  autoPlay?: boolean
}) {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const started = useRef(false)

  // Autoplay only once the player scrolls into view, and never for
  // reduced-motion users — they drive it with the controls instead.
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!autoPlay || started.current) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const el = rootRef.current
    if (!el || !("IntersectionObserver" in window)) {
      setPlaying(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          started.current = true
          setPlaying(true)
          obs.disconnect()
        }
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [autoPlay])

  useEffect(() => {
    if (!playing) return
    const step = (TICK_MS / SCENE_MS) * 100
    const t = setInterval(() => {
      setProgress((p) => {
        if (p + step >= 100) {
          setI((x) => (x + 1) % scenes.length)
          return 0
        }
        return p + step
      })
    }, TICK_MS)
    return () => clearInterval(t)
  }, [playing, scenes.length])

  const goto = (n: number) => {
    setI(((n % scenes.length) + scenes.length) % scenes.length)
    setProgress(0)
  }

  const scene = scenes[i]

  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription="product walkthrough"
      aria-label={title}
      className="border-ink-100 shadow-soft overflow-hidden rounded-[28px] border bg-white"
    >
      {/* step chips */}
      <div className="border-ink-50 flex gap-1.5 overflow-x-auto border-b px-3 py-2.5 [scrollbar-width:none]">
        {scenes.map((s, n) => (
          <button
            key={s.label}
            type="button"
            onClick={() => {
              setPlaying(false)
              goto(n)
            }}
            aria-current={n === i ? "step" : undefined}
            className={`flex-none cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              n === i
                ? "bg-ink-950 text-white"
                : n < i
                  ? "bg-play-50 text-play-700 hover:bg-play-100"
                  : "bg-ink-50 text-ink-500 hover:bg-ink-100"
            }`}
          >
            {n + 1}. {s.label}
          </button>
        ))}
      </div>

      {/* progress */}
      <div className="bg-ink-50 h-1" aria-hidden="true">
        <div
          className="bg-hoop-500 h-full"
          style={{ width: `${progress}%`, transition: playing ? "none" : "width 200ms" }}
        />
      </div>

      {/* stage */}
      <div className="bg-ink-50/60 flex min-h-[430px] items-center justify-center overflow-hidden px-4 py-8 sm:px-8">
        <div key={i} className="demo-scene-enter w-full max-w-xl">
          {scene.screen}
        </div>
      </div>

      {/* controls + caption */}
      <div className="border-ink-50 flex items-center gap-3 border-t px-4 py-3.5">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? "Pause walkthrough" : "Play walkthrough"}
          className="bg-ink-950 hover:bg-ink-800 flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full text-white transition-colors"
        >
          {playing ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4h4v16H7zM13 4h4v16h-4z" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4l14 8-14 8z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false)
            goto(i - 1)
          }}
          aria-label="Previous step"
          className="border-ink-200 text-ink-600 hover:bg-ink-50 flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full border transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false)
            goto(i + 1)
          }}
          aria-label="Next step"
          className="border-ink-200 text-ink-600 hover:bg-ink-50 flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full border transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <p aria-live="polite" className="text-ink-600 min-w-0 flex-1 text-sm font-medium leading-snug">
          {scene.caption}
        </p>
        <span className="text-ink-300 flex-none text-xs font-bold tabular-nums">
          {i + 1}/{scenes.length}
        </span>
      </div>

      <style>{`
        .demo-scene-enter { animation: demoSceneIn 320ms ease; }
        @keyframes demoSceneIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .demo-scene-enter { animation: none; } }
      `}</style>
    </div>
  )
}
