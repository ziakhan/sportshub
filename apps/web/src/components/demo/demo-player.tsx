"use client"

/**
 * DemoPlayer — the marketing "watch how it works" walkthrough shell
 * (owner spec 2026-07-18: autoplay video-feel, but a live design system —
 * pause, play, step, jump; every scene is rendered UI with demo data, not
 * a screenshot). Scenes are server-rendered nodes passed in as props, so
 * each journey file stays a plain server component.
 */

import { useEffect, useRef, useState, type ReactNode } from "react"
import { DemoAdvanceContext } from "./demo-advance-context"

export type DemoRole = "CLUB" | "PARENT" | "COACH" | "LEAGUE" | "SCOREKEEPER" | "EVERYONE"

export interface DemoScene {
  /** Short chip label, e.g. "Post tryout" */
  label: string
  /** One-sentence narration under the frame */
  caption: string
  screen: ReactNode
  /** Whose hands are on the keyboard (shown as a chip; enables the role filter) */
  role?: DemoRole
  /** Autoplay dwell for this scene in ms (denser screens hold longer) */
  hold?: number
}

const ROLE_TONES: Record<DemoRole, string> = {
  CLUB: "bg-play-50 text-play-700",
  PARENT: "bg-hoop-50 text-hoop-700",
  COACH: "bg-violet-50 text-violet-700",
  LEAGUE: "bg-ink-100 text-ink-700",
  SCOREKEEPER: "bg-amber-100 text-amber-800",
  EVERYONE: "bg-emerald-50 text-emerald-700",
}

const TICK_MS = 50
// Owner 2026-07-19: scenes ran too fast. Long enough to read the payoff.
const SCENE_MS = 8000

export function DemoPlayer({
  scenes: allScenes,
  title,
}: {
  scenes: DemoScene[]
  /** Accessible name for the player region */
  title: string
}) {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  // Role filter (ONE SEASON): shows pills when scenes carry roles.
  const [roleFilter, setRoleFilter] = useState<DemoRole | null>(null)
  const roles = Array.from(new Set(allScenes.map((s) => s.role).filter(Boolean))) as DemoRole[]
  const scenes = roleFilter
    ? allScenes.filter((s) => !s.role || s.role === roleFilter || s.role === "EVERYONE")
    : allScenes

  // Click-driven by default (owner 2026-07-19): the visitor reads at their
  // own pace and the scene's glowing button does the transition. Autoplay
  // is opt-in via the Watch button, with a per-scene dwell.
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!playing) return
    const hold = scenes[Math.min(i, scenes.length - 1)]?.hold ?? SCENE_MS
    const step = (TICK_MS / hold) * 100
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
  }, [playing, i, scenes])

  const goto = (n: number) => {
    setI(((n % scenes.length) + scenes.length) % scenes.length)
    setProgress(0)
  }

  // A scene button click behaves like the real app: press, then the next
  // screen. Any manual click also takes over from autoplay.
  const advance = () => {
    setPlaying(false)
    goto(i + 1)
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
      {/* how to use it — nobody should have to guess */}
      <div className="border-ink-50 bg-play-50/50 text-ink-600 border-b px-4 py-2 text-[12.5px] font-medium">
        Go at your own pace. <span className="text-ink-950 font-bold">Click the glowing button</span>{" "}
        on each screen to do that step, or use <span className="text-ink-950 font-bold">Next step</span>{" "}
        below. Prefer to sit back? Press <span className="text-ink-950 font-bold">Watch</span>.
      </div>
      {/* role filter (only when scenes carry roles, i.e. the ONE SEASON tour) */}
      {roles.length > 1 && (
        <div className="border-ink-50 flex flex-wrap items-center gap-1.5 border-b px-3 py-2.5">
          <span className="text-ink-400 mr-1 text-[11px] font-bold uppercase tracking-wider">Show</span>
          <button
            type="button"
            onClick={() => {
              setRoleFilter(null)
              setPlaying(false)
              setI(0)
              setProgress(0)
            }}
            aria-pressed={roleFilter === null}
            className={`cursor-pointer rounded-full px-3 py-1 text-[11.5px] font-bold transition-colors ${
              roleFilter === null ? "bg-ink-950 text-white" : "bg-ink-50 text-ink-500 hover:bg-ink-100"
            }`}
          >
            The whole season
          </button>
          {roles.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRoleFilter(r)
                setPlaying(false)
                setI(0)
                setProgress(0)
              }}
              aria-pressed={roleFilter === r}
              className={`cursor-pointer rounded-full px-3 py-1 text-[11.5px] font-bold transition-colors ${
                roleFilter === r ? "bg-ink-950 text-white" : ROLE_TONES[r] + " hover:opacity-80"
              }`}
            >
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      )}

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
      {/* the stage: buttons inside the scene advance it; a tap pauses autoplay */}
      <div
        onClick={() => {
          if (playing) setPlaying(false)
        }}
        className={`bg-ink-50/60 relative flex min-h-[430px] items-center justify-center overflow-hidden px-2 py-7 sm:px-8 ${playing ? "demo-auto cursor-pointer" : ""}`}
      >
        <DemoAdvanceContext.Provider value={advance}>
          <div key={`${roleFilter ?? "all"}-${i}`} className="demo-scene-enter w-full max-w-2xl">
            {scene.screen}
          </div>
        </DemoAdvanceContext.Provider>
      </div>

      {/* controls + caption */}
      <div className="border-ink-50 flex items-center gap-3 border-t px-4 py-3.5">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          className="border-ink-200 text-ink-700 hover:bg-ink-50 flex h-10 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-bold transition-colors"
        >
          {playing ? (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 4h4v16H7zM13 4h4v16h-4z" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4l14 8-14 8z" />
              </svg>
              Watch
            </>
          )}
        </button>
        <p aria-live="polite" className="text-ink-600 min-w-0 flex-1 text-sm font-medium leading-snug">
          {scene.role ? (
            <span className={`mr-1.5 inline-block rounded-full px-2 py-0.5 align-middle text-[10px] font-black uppercase tracking-wide ${ROLE_TONES[scene.role]}`}>
              {scene.role}
            </span>
          ) : null}
          {scene.caption}
        </p>
        <span className="text-ink-300 flex-none text-xs font-bold tabular-nums">
          {i + 1}/{scenes.length}
        </span>
        <button
          type="button"
          onClick={advance}
          className="bg-ink-950 hover:bg-ink-800 flex h-10 flex-none cursor-pointer items-center gap-1 rounded-full px-4 text-[12.5px] font-bold text-white transition-colors"
        >
          Next step
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <style>{`
        .demo-scene-enter { animation: demoSceneIn 320ms ease; }
        @keyframes demoSceneIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

        /* rows arriving one by one */
        .demo-cascade > * { opacity: 0; animation: demoRowIn 0.4s ease forwards; }
        ${Array.from({ length: 14 }, (_, n) => `.demo-cascade > *:nth-child(${n + 1}) { animation-delay: ${0.15 + n * 0.13}s; }`).join("\n        ")}
        @keyframes demoRowIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }

        /* the glowing button: pulses while waiting for the visitor's click;
           presses on its own only during autoplay (.demo-auto) */
        .demo-pulse, .demo-press { animation: demoPulse 1.8s ease-in-out infinite; }
        @keyframes demoPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(242,78,30,0.35); } 50% { box-shadow: 0 0 0 7px rgba(242,78,30,0); } }
        .demo-auto .demo-press { animation: demoPulse 1.8s ease-in-out infinite, demoPress 0.45s ease 0.7s 1; }
        @keyframes demoPress { 0% { transform: none; } 40% { transform: scale(0.92); } 100% { transform: none; } }
        .demo-pressed-now { animation: demoPress 0.32s ease both; }

        /* payoffs that land after the press (ticks, "sent" chips) */
        .demo-late { opacity: 0; animation: demoTickIn 0.32s cubic-bezier(0.2, 1.4, 0.4, 1) forwards; }
        @keyframes demoTickIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }

        /* value flips (score changing after a console press) */
        .demo-swap-old { animation: demoHide 0.2s ease 1.25s forwards; }
        .demo-swap-new { opacity: 0; animation: demoTickIn 0.3s cubic-bezier(0.2, 1.4, 0.4, 1) 1.35s forwards; color: #059669; }
        @keyframes demoHide { to { opacity: 0; visibility: hidden; } }

        @media (prefers-reduced-motion: reduce) {
          .demo-scene-enter, .demo-cascade > *, .demo-late { animation: none; opacity: 1; }
          .demo-pulse, .demo-press { animation: none; }
        }
      `}</style>
    </div>
  )
}
