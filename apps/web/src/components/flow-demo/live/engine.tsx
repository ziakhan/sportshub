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

/** Persona-colored accents so the chrome carries who's acting, not just gray. */
const PERSONA_ACCENT: Record<string, { bar: string; wash: string }> = {
  league: { bar: "bg-play-500", wash: "from-play-50/80" },
  club: { bar: "bg-court-500", wash: "from-court-50/80" },
  parent: { bar: "bg-hoop-500", wash: "from-hoop-50/80" },
  referee: { bar: "bg-gold-500", wash: "from-gold-50/80" },
}

/* ── The player ────────────────────────────────────────────────────────── */

export function LivePlayer({ acts, scenes }: { acts: LiveAct[]; scenes: LiveScene[] }) {
  const [index, setIndex] = useState(0)
  const [, setTick] = useState(0)
  const [started, setStarted] = useState(false)
  const [autoplay, setAutoplay] = useState(false)
  const [paused, setPaused] = useState(false)
  const [holding, setHolding] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState<string | null>(null)
  const [intro, setIntro] = useState(false)
  const [holdHint, setHoldHint] = useState<{ x: number; y: number } | null>(null)
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
  const introResolveRef = useRef<(() => void) | null>(null)
  const introCardRef = useRef<HTMLDivElement>(null)
  const stickyCapRef = useRef<HTMLParagraphElement>(null)
  const zoomScaleRef = useRef(1)

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

  const setZoom = useCallback((id: string | null, scale = 1.35) => {
    const wrap = zoomRef.current
    const stage = stageRef.current
    if (!wrap || !stage) return
    if (!id) {
      wrap.style.transform = "none"
      zoomScaleRef.current = 1
      return
    }
    const target = stage.querySelector<HTMLElement>(`[data-live-id="${id}"]`)
    if (!target) return
    const r = target.getBoundingClientRect()
    const w = wrap.getBoundingClientRect()
    // Never zoom a target wider than the stage can show: cap the scale so
    // no column gets clipped off either edge while it is being filled in.
    const unscaledW = r.width / zoomScaleRef.current
    const maxScale = Math.max(1, ((w.width / zoomScaleRef.current) / unscaledW) * 0.97)
    const z = Math.min(scale, maxScale)
    zoomScaleRef.current = z
    const tx = w.left + w.width / 2 - (r.left + r.width / 2)
    const ty = w.top + w.height / 2 - (r.top + r.height / 2)
    const originX = r.left - w.left + r.width / 2
    const originY = r.top - w.top + r.height / 2
    wrap.style.transformOrigin = `${originX}px ${originY}px`
    wrap.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`
  }, [])

  /* Phones show desktop screens through a horizontal pan window; the camera
     must ride along or the action happens off screen. */
  const isNarrow = () => typeof window !== "undefined" && window.innerWidth < 700

  /** Pan/scroll the target into view (centered on phones) and wait for the
      smooth scroll to actually settle before anyone measures coordinates. */
  const settleOn = useCallback(
    async (target: HTMLElement, run: number) => {
      const center = isNarrow()
      target.scrollIntoView({
        block: center ? "center" : "nearest",
        inline: center ? "center" : "nearest",
        behavior: "smooth",
      })
      let last = target.getBoundingClientRect()
      for (let i = 0; i < 24; i++) {
        await sleep(60, run)
        const now = target.getBoundingClientRect()
        if (Math.abs(now.left - last.left) < 1 && Math.abs(now.top - last.top) < 1) return
        last = now
      }
    },
    [sleep]
  )

  const moveCursor = useCallback(
    async (id: string, run: number) => {
      const target = el(id)
      const stage = stageRef.current
      const cur = cursorRef.current
      if (!target || !stage || !cur) return
      // Phones show the whole screen zoomed out; the camera dives into the
      // area being worked on so typing and toggles are readable, then the
      // hold pulls back out to the full screen.
      if (isNarrow()) {
        setZoom(id, 2.1)
        await sleep(1120, run)
      }
      await settleOn(target, run)
      const r = target.getBoundingClientRect()
      const s = stage.getBoundingClientRect()
      cur.style.opacity = "1"
      cur.style.left = `${r.left - s.left + r.width / 2}px`
      cur.style.top = `${r.top - s.top + r.height / 2}px`
      await sleep(620, run)
    },
    [settleOn, setZoom, sleep]
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

  /* Run the current scene's script. */
  useEffect(() => {
    if (!scene || done || !started) return
    const run = ++runRef.current
    stateRef.current = {}
    setTick((t) => t + 1)
    setHolding(null)
    setReady(false)
    setConfirmText(null)
    setHoldHint(null)
    if (cursorRef.current) cursorRef.current.style.opacity = "0"
    if (zoomRef.current) zoomRef.current.style.transform = "none"

    const exec = async () => {
      // Read-first: bring the new screen fully into view, then hold the
      // caption up big until the viewer has had time to read it (a click
      // dismisses it early). Only then does the screen start acting.
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      setIntro(true)
      const readMs = Math.min(9500, Math.max(4200, 1800 + scene.caption.length * 46))
      await Promise.race([
        sleep(readMs, run).catch(() => {}),
        new Promise<void>((resolve) => {
          introResolveRef.current = resolve
        }),
      ])
      introResolveRef.current = null
      if (runRef.current !== run) return
      // The card doesn't vanish: it slides up and shrinks into the pinned
      // bar, so the viewer sees it's the same text and can keep reading.
      const card = introCardRef.current
      const tgt = stickyCapRef.current
      if (card && tgt) {
        const c = card.getBoundingClientRect()
        const t = tgt.getBoundingClientRect()
        card.style.transition = "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.55s ease"
        card.style.transformOrigin = "top left"
        card.style.transform = `translate(${t.left - c.left}px, ${t.top - c.top}px) scale(${Math.min(0.92, t.width / c.width)})`
        card.style.opacity = "0"
        const back = card.parentElement
        if (back) {
          back.style.transition = "background-color 0.55s ease"
          back.style.backgroundColor = "transparent"
        }
        await sleep(560, run)
      }
      if (runRef.current !== run) return
      setIntro(false)
      await sleep(350, run)
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
          // Pull the camera back out so the whole finished screen reads
          // before the viewer taps onward (the glow marks the button).
          if (isNarrow() && zoomScaleRef.current > 1) {
            if (cursorRef.current) cursorRef.current.style.opacity = "0"
            setZoom(null)
            await sleep(1120, run)
          }
          setHolding(step.hold)
          setReady(true)
          const target = el(step.hold)
          if (target) await settleOn(target, run).catch(() => {})
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
  }, [index, done, started, scene?.id])

  /* While holding, glow the target, pin a "Click to continue" tag to it,
     and resolve on a real user click. */
  useEffect(() => {
    if (!holding) return
    const target = el(holding)
    if (!target) return
    target.classList.add("live-hold-glow")
    const hint = setTimeout(() => {
      if (autoRef.current) return
      const stage = stageRef.current
      if (!stage) return
      const r = target.getBoundingClientRect()
      const s = stage.getBoundingClientRect()
      setHoldHint({ x: r.left - s.left + r.width / 2, y: r.top - s.top })
    }, 950)
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
      clearTimeout(hint)
      setHoldHint(null)
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
        <div className="from-hoop-500 to-gold-500 live-pop mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-[0_16px_40px_-12px_rgba(226,54,18,0.5)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-8 w-8">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-ink-900 text-2xl font-bold">From first signup to the final whistle.</h2>
        <p className="text-ink-500 mx-auto mt-3 max-w-md text-sm leading-relaxed">
          Club, league, parents, referee, scorer&apos;s table: every click you just watched is the
          real product doing real work.
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

  const dismissIntro = () => {
    introResolveRef.current?.()
    introResolveRef.current = null
  }

  return (
    <div className="select-none" data-demo-player data-live-scene={scene.id} data-live-ready={ready || undefined}>
      {/* Acts */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
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
                  ? "text-[color:var(--brand-on)]"
                  : ai < actIndex
                    ? "bg-court-50 text-court-700 hover:bg-court-100"
                    : "text-ink-400 hover:bg-ink-100 hover:text-ink-600 bg-white"
              )}
              style={active ? { backgroundColor: "var(--brand)" } : undefined}
            >
              {ai < actIndex ? "✓ " : `${ai + 1}. `}
              {a.title}
            </button>
          )
        })}
      </div>

      {/* Sticky "who's acting, what's happening" bar — never scrolls away */}
      <div
        className={cn(
          "border-ink-100 sticky top-[58px] z-30 mb-4 overflow-hidden rounded-2xl border bg-gradient-to-r to-white/95 px-4 py-3 shadow-[0_14px_34px_-22px_rgba(15,23,42,0.4)] backdrop-blur md:top-[76px]",
          PERSONA_ACCENT[scene.persona].wash
        )}
      >
        <span className={cn("absolute inset-y-0 left-0 w-1.5", PERSONA_ACCENT[scene.persona].bar)} />
        <div className="bg-ink-100 mb-2.5 h-1.5 overflow-hidden rounded-full">
          <div
            className="from-play-600 via-hoop-500 to-gold-500 h-full rounded-full bg-gradient-to-r transition-all duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ring-1 ring-inset",
              PERSONA_TONES[scene.persona]
            )}
          >
            {scene.personaLabel}
          </span>
          <p
            ref={stickyCapRef}
            className={cn(
              "text-ink-900 min-w-[240px] flex-1 text-base font-semibold leading-snug transition-opacity duration-500",
              intro ? "opacity-0" : "opacity-100"
            )}
          >
            {scene.caption}
          </p>
          <span className="text-ink-400 shrink-0 text-xs font-semibold tabular-nums">
            Step {index + 1} of {total}
          </span>
          <button
            onClick={() => {
              setAutoplay((a) => !a)
              setPaused(false)
            }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
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

      {/* Stage */}
      <div
        ref={stageRef}
        onClick={() => started && autoplay && setPaused((p) => !p)}
        style={{ scrollMarginTop: 165 }}
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
            <DesktopFrame url={scene.url ?? "/"} sceneKey={scene.id} fitAlways>
              {scene.render(g)}
            </DesktopFrame>
          )}
        </div>
        <div ref={cursorRef} className="live-cursor" style={{ opacity: 0, left: 40, top: 40 }} />

        {/* Start gate: read what this is and pick a mode before anything moves */}
        {!started && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-[#1e2d4d]/90 to-[#0b1628]/90 p-6">
            <div className="demo-confirm-pop relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-7 text-center shadow-[0_40px_90px_-30px_rgba(15,23,42,0.6)]">
              <span className="from-play-600 via-hoop-500 to-gold-500 absolute inset-x-0 top-0 h-2 bg-gradient-to-r" />
              <h3 className="text-ink-950 text-2xl font-bold">Watch a season run itself</h3>
              <p className="text-ink-600 mx-auto mt-3 max-w-md text-sm leading-relaxed">
                Every step works the same way: first you read what is about to happen, then the
                screen acts it out for real, then it waits for you on a glowing button.
              </p>
              <div className="border-gold-300 bg-gold-50 mt-4 flex items-start gap-2.5 rounded-xl border p-3 text-left sm:hidden">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gold-600 mt-0.5 h-4 w-4 shrink-0">
                  <rect x="2" y="4" width="20" height="14" rx="2" />
                  <path d="M8 22h8M12 18v4" />
                </svg>
                <span className="text-ink-800 text-xs font-medium leading-relaxed">
                  <b>This demo shines on a desktop screen.</b> On your phone it still works: the
                  camera pans across the big operator screens as things happen.
                </span>
              </div>
              <div className="mt-6 grid gap-2.5">
                <button
                  data-live-id="startManual"
                  onClick={() => setStarted(true)}
                  className="brand-focus rounded-xl px-5 py-3 text-base font-semibold text-[color:var(--brand-on)]"
                  style={{ backgroundColor: "var(--brand)" }}
                >
                  I&apos;ll click through at my own pace
                </button>
                <button
                  onClick={() => {
                    setAutoplay(true)
                    setStarted(true)
                  }}
                  className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border bg-white px-5 py-3 text-base font-semibold"
                >
                  ▶ Autoplay it for me
                </button>
              </div>
              <p className="text-ink-400 mt-4 text-xs">
                The glowing button is always the next step. Switch modes any time, top right.
              </p>
            </div>
          </div>
        )}

        {/* Read-first card: the step explains itself before the screen moves,
            then shrinks up into the pinned bar (never two at once) */}
        {started && intro && (
          <div data-live-intro className="bg-ink-950/25 absolute inset-0 z-30 cursor-pointer p-4 sm:p-6" onClick={dismissIntro}>
            <div
              ref={introCardRef}
              className="demo-confirm-pop border-ink-100 relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border bg-white px-6 py-6 shadow-[0_30px_70px_-28px_rgba(15,23,42,0.5)]"
            >
              <span className={cn("absolute inset-x-0 top-0 h-1.5", PERSONA_ACCENT[scene.persona].bar)} />
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ring-1 ring-inset",
                  PERSONA_TONES[scene.persona]
                )}
              >
                {scene.personaLabel}
              </span>
              <p className="text-ink-950 mt-3 text-xl font-semibold leading-snug">{scene.caption}</p>
            </div>
          </div>
        )}

        {/* Pinned tag on the button that continues the demo */}
        {holdHint && !autoplay && (
          <div
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full pb-2.5"
            style={{ left: holdHint.x, top: holdHint.y }}
          >
            <div className="demo-confirm-pop">
              <div className="bg-hoop-500 rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_10px_24px_-8px_rgba(226,54,18,0.55)]">
                Click to continue
              </div>
              <div className="bg-hoop-500 mx-auto -mt-1 h-2 w-2 rotate-45" />
            </div>
          </div>
        )}
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
        {autoplay && (
          <p className="text-ink-400 text-xs font-medium">Playing on its own. Click the demo to pause.</p>
        )}
      </div>
    </div>
  )
}
