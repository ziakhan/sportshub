"use client"

/**
 * The live-demo engine. Each scene declares a timeline script; the engine
 * plays it: moves a pointer, opens dropdowns, types into fields, ticks
 * checkboxes, zooms the camera toward what is being touched, then holds on
 * the decisive button for the user to press (autoplay presses it on its own).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { DesktopFrame, PhoneFrame } from "../frames"
import type { Persona } from "../types"

/* ── Script steps ──────────────────────────────────────────────────────── */

export type Step =
  | { cursor: string }
  | { press: string } // pointer click with ripple (no advance semantics)
  | { type: [string, string]; cps?: number } // state key, full text
  | { set: Record<string, unknown> }
  | { wait: number }
  | { zoom: string | null; scale?: number }
  | { hold: string } // waits for the user (or autoplay) to press this element
  | { confirm: string }

export interface LiveScene {
  id: string
  act: string
  persona: Persona
  personaLabel: string
  frame: "desktop" | "phone" | "plain"
  url?: string
  caption: string
  script: Step[]
  render: (g: (key: string, dflt?: unknown) => unknown) => ReactNode
}

export interface LiveAct {
  id: string
  title: string
}

const PERSONA_TONES: Record<string, string> = {
  league: "bg-play-50 text-play-700 ring-play-100",
  club: "bg-court-50 text-court-700 ring-court-100",
  parent: "bg-hoop-50 text-hoop-600 ring-hoop-100",
  referee: "bg-gold-50 text-gold-600 ring-gold-100",
}

/* ── The player ────────────────────────────────────────────────────────── */

export function LivePlayer({ acts, scenes }: { acts: LiveAct[]; scenes: LiveScene[] }) {
  const [index, setIndex] = useState(0)
  const [, setTick] = useState(0)
  const [autoplay, setAutoplay] = useState(false)
  const [paused, setPaused] = useState(false)
  const [holding, setHolding] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState<string | null>(null)
  const [entering, setEntering] = useState(true)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<Record<string, unknown>>({})
  const runRef = useRef(0)
  const pausedRef = useRef(false)
  const autoRef = useRef(false)
  const holdResolveRef = useRef<(() => void) | null>(null)

  pausedRef.current = paused
  autoRef.current = autoplay

  const scene = scenes[index]
  const total = scenes.length
  const actIndex = acts.findIndex((a) => a.id === scene?.act)

  const g = useCallback((key: string, dflt?: unknown) => stateRef.current[key] ?? dflt, [])
  const mutate = useCallback((patch: Record<string, unknown>) => {
    Object.assign(stateRef.current, patch)
    setTick((t) => t + 1)
  }, [])

  const el = (id: string) =>
    stageRef.current?.querySelector<HTMLElement>(`[data-live-id="${id}"]`) ?? null

  const sleep = useCallback(async (ms: number, run: number) => {
    const end = Date.now() + ms
    for (;;) {
      if (runRef.current !== run) throw new Error("cancelled")
      if (!pausedRef.current && Date.now() >= end) return
      await new Promise((r) => setTimeout(r, 40))
    }
  }, [])

  const moveCursor = useCallback(
    async (id: string, run: number) => {
      const target = el(id)
      const stage = stageRef.current
      const cur = cursorRef.current
      if (!target || !stage || !cur) return
      target.scrollIntoView({ block: "nearest", behavior: "smooth" })
      await sleep(120, run)
      const r = target.getBoundingClientRect()
      const s = stage.getBoundingClientRect()
      cur.style.opacity = "1"
      cur.style.left = `${r.left - s.left + r.width / 2}px`
      cur.style.top = `${r.top - s.top + r.height / 2}px`
      await sleep(620, run)
    },
    [sleep]
  )

  const ripple = useCallback(() => {
    const stage = stageRef.current
    const cur = cursorRef.current
    if (!stage || !cur) return
    const dot = document.createElement("div")
    dot.className = "live-ripple"
    dot.style.left = cur.style.left
    dot.style.top = cur.style.top
    stage.appendChild(dot)
    setTimeout(() => dot.remove(), 550)
  }, [])

  const pressAt = useCallback(
    async (id: string, run: number) => {
      await moveCursor(id, run)
      const cur = cursorRef.current
      cur?.classList.add("down")
      const target = el(id)
      target?.classList.add("demo-advance-pressed")
      ripple()
      await sleep(180, run)
      cur?.classList.remove("down")
      target?.classList.remove("demo-advance-pressed")
      await sleep(160, run)
    },
    [moveCursor, ripple, sleep]
  )

  const setZoom = useCallback((id: string | null, scale = 1.35) => {
    const wrap = zoomRef.current
    const stage = stageRef.current
    if (!wrap || !stage) return
    if (!id) {
      wrap.style.transform = "none"
      return
    }
    const target = stage.querySelector<HTMLElement>(`[data-live-id="${id}"]`)
    if (!target) return
    const r = target.getBoundingClientRect()
    const w = wrap.getBoundingClientRect()
    const tx = w.left + w.width / 2 - (r.left + r.width / 2)
    const ty = w.top + w.height / 2 - (r.top + r.height / 2)
    const originX = r.left - w.left + r.width / 2
    const originY = r.top - w.top + r.height / 2
    wrap.style.transformOrigin = `${originX}px ${originY}px`
    wrap.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
  }, [])

  /* Run the current scene's script. */
  useEffect(() => {
    if (!scene || done) return
    const run = ++runRef.current
    stateRef.current = {}
    setTick((t) => t + 1)
    setHolding(null)
    setReady(false)
    setConfirmText(null)
    if (cursorRef.current) cursorRef.current.style.opacity = "0"
    if (zoomRef.current) zoomRef.current.style.transform = "none"

    const exec = async () => {
      await sleep(650, run)
      for (const step of scene.script) {
        if (runRef.current !== run) return
        if ("cursor" in step) await moveCursor(step.cursor, run)
        else if ("press" in step) await pressAt(step.press, run)
        else if ("wait" in step) await sleep(step.wait, run)
        else if ("set" in step) {
          mutate(step.set)
          await sleep(60, run)
        } else if ("type" in step) {
          const [key, text] = step.type
          const cps = step.cps ?? 22
          mutate({ [key + ":caret"]: true })
          for (let i = 1; i <= text.length; i++) {
            mutate({ [key]: text.slice(0, i) })
            await sleep(1000 / cps, run)
          }
          mutate({ [key + ":caret"]: false })
        } else if ("zoom" in step) {
          if (!step.zoom && cursorRef.current) cursorRef.current.style.opacity = "0"
          setZoom(step.zoom, step.scale)
          await sleep(750, run)
        } else if ("confirm" in step) {
          setConfirmText(step.confirm)
          await sleep(1250, run)
          setConfirmText(null)
        } else if ("hold" in step) {
          setHolding(step.hold)
          setReady(true)
          el(step.hold)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
          if (autoRef.current) {
            await sleep(1500, run)
            if (runRef.current !== run) return
            await pressAt(step.hold, run)
          } else {
            await new Promise<void>((resolve) => {
              holdResolveRef.current = resolve
            })
            if (runRef.current !== run) return
            const cur = cursorRef.current
            if (cur) cur.style.opacity = "0"
          }
          setHolding(null)
          setReady(false)
        }
      }
      if (runRef.current !== run) return
      // Scene finished: transition to the next one.
      setZoom(null)
      setEntering(false)
      await sleep(220, run)
      if (index + 1 >= total) {
        setDone(true)
        setAutoplay(false)
      } else {
        setIndex(index + 1)
        setEntering(true)
      }
    }
    exec().catch(() => {})
    const cancel = runRef
    const holds = holdResolveRef
    return () => {
      cancel.current++
      holds.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, done, scene?.id])

  /* While holding, glow the target and resolve on a real user click. */
  useEffect(() => {
    if (!holding) return
    const target = el(holding)
    if (!target) return
    target.classList.add("live-hold-glow")
    const onClick = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      target.classList.add("demo-advance-pressed")
      setTimeout(() => target.classList.remove("demo-advance-pressed"), 200)
      holdResolveRef.current?.()
      holdResolveRef.current = null
    }
    target.addEventListener("click", onClick, true)
    return () => {
      target.classList.remove("live-hold-glow")
      target.removeEventListener("click", onClick, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding, index])

  /* Keyboard advance while holding. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === "ArrowRight") && holdResolveRef.current) {
        holdResolveRef.current()
        holdResolveRef.current = null
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const jumpTo = (i: number) => {
    holdResolveRef.current = null
    setDone(false)
    setIndex(i)
    setEntering(true)
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center" data-demo-player data-live-scene="done">
        <div className="bg-court-100 text-court-700 live-pop mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-8 w-8">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-ink-900 text-2xl font-bold">The team is in. That is how it runs.</h2>
        <p className="text-ink-500 mx-auto mt-3 max-w-md text-sm leading-relaxed">
          Claim to finalized roster, every click you just watched is the real product doing real
          work.
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
            onClick={() => jumpTo(0)}
            className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border bg-white px-5 py-3 text-base font-semibold"
          >
            Watch it again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="select-none" data-demo-player data-live-scene={scene.id} data-live-ready={ready || undefined}>
      {/* HUD */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {acts.map((a, ai) => {
            const first = scenes.findIndex((s) => s.act === a.id)
            const active = a.id === scene.act
            return (
              <button
                key={a.id}
                onClick={() => jumpTo(first)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "bg-ink-900 text-white"
                    : ai < actIndex
                      ? "bg-ink-100 text-ink-600 hover:bg-ink-200"
                      : "text-ink-400 hover:bg-ink-100 hover:text-ink-600 bg-white"
                )}
              >
                {ai + 1}. {a.title}
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
      <div className="bg-ink-100 mb-5 h-1 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${((index + 1) / total) * 100}%`, backgroundColor: "var(--brand)" }}
        />
      </div>

      {/* Caption */}
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
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        onClick={() => autoplay && setPaused((p) => !p)}
        className={cn(
          "relative overflow-hidden rounded-2xl transition-all duration-200",
          entering ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        )}
      >
        <div ref={zoomRef} className="live-zoom">
          {scene.frame === "phone" ? (
            <div className="py-2">
              <PhoneFrame sceneKey={scene.id}>{scene.render(g)}</PhoneFrame>
            </div>
          ) : scene.frame === "plain" ? (
            <div className="py-2">{scene.render(g)}</div>
          ) : (
            <DesktopFrame url={scene.url ?? "/"} sceneKey={scene.id}>
              {scene.render(g)}
            </DesktopFrame>
          )}
        </div>
        <div ref={cursorRef} className="live-cursor" style={{ opacity: 0, left: 40, top: 40 }} />
        {confirmText && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-start justify-center pt-16">
            <div className="demo-confirm-pop border-court-200 flex items-center gap-3 rounded-2xl border bg-white px-5 py-3.5 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.4)]">
              <span className="bg-court-500 flex h-8 w-8 items-center justify-center rounded-full text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-ink-900 text-sm font-semibold">{confirmText}</span>
            </div>
          </div>
        )}
        {autoplay && paused && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/55">
            <span className="border-ink-200 text-ink-700 rounded-full border bg-white px-4 py-2 text-sm font-semibold shadow-sm">
              Paused. Click anywhere to keep going.
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => index > 0 && jumpTo(index - 1)}
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
            : "Watch each step play out, then click the glowing button to continue."}
        </p>
      </div>
    </div>
  )
}
