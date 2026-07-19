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

  // Keep the active step chip visible as scenes advance. Scrolls ONLY the
  // chip strip (scrollIntoView could vertically yank the page mid-read).
  const chipsRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const wrap = chipsRef.current
    const el = wrap?.querySelector<HTMLElement>(`[data-chip="${i}"]`)
    if (!wrap || !el) return
    wrap.scrollTo({
      left: el.offsetLeft - (wrap.clientWidth - el.offsetWidth) / 2,
      behavior: "smooth",
    })
  }, [i])

  const scene = scenes[i]

  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription="product walkthrough"
      aria-label={title}
      className="border-ink-100 shadow-soft overflow-hidden rounded-[28px] border bg-white"
    >
      {/* step chips — active chip auto-scrolls into view; edge fades signal
          there are more steps than fit (owner 2026-07-18: hidden pills were
          undiscoverable) */}
      <div className="border-ink-50 relative border-b">
        <div ref={chipsRef} className="flex gap-1.5 overflow-x-auto px-3 py-2.5 [scrollbar-width:none]">
          {scenes.map((s, n) => (
            <button
              key={s.label}
              type="button"
              data-chip={n}
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
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-14 items-center justify-end bg-gradient-to-l from-white via-white/80 to-transparent pr-1" aria-hidden="true">
          <span className="text-ink-300 text-[10px] font-black">{scenes.length}&nbsp;steps&nbsp;›</span>
        </div>
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

        /* rows arriving one by one */
        .demo-cascade > * { opacity: 0; animation: demoRowIn 0.4s ease forwards; }
        ${Array.from({ length: 14 }, (_, n) => `.demo-cascade > *:nth-child(${n + 1}) { animation-delay: ${0.15 + n * 0.13}s; }`).join("\n        ")}
        @keyframes demoRowIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }

        /* the button press beat */
        .demo-pulse { animation: demoPulse 1.8s ease-in-out infinite; }
        @keyframes demoPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(242,78,30,0.35); } 50% { box-shadow: 0 0 0 7px rgba(242,78,30,0); } }
        .demo-press { animation: demoPressGlow 1.8s ease-in-out infinite, demoPress 0.45s ease 0.7s 1; }
        @keyframes demoPress { 0% { transform: none; } 40% { transform: scale(0.92); } 100% { transform: none; } }
        @keyframes demoPressGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(242,78,30,0.35); } 50% { box-shadow: 0 0 0 7px rgba(242,78,30,0); } }

        /* payoffs that land after the press (ticks, "sent" chips) */
        .demo-late { opacity: 0; animation: demoTickIn 0.32s cubic-bezier(0.2, 1.4, 0.4, 1) forwards; }
        @keyframes demoTickIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }

        @media (prefers-reduced-motion: reduce) {
          .demo-scene-enter, .demo-cascade > *, .demo-late { animation: none; opacity: 1; }
          .demo-pulse, .demo-press { animation: none; }
        }
      `}</style>
    </div>
  )
}
