"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { HomePreview } from "../home-preview/preview"
import { DemoStrip } from "./demo-strip"
import { MobileCourtMark } from "./mobile-court-mark"
import { armReveal, REVEAL_CSS } from "./reveal"

/**
 * Motion lab for the launch homepage (draft, 2026-08-19).
 *
 * NOTHING HERE IS WIRED. `/launch` renders `HomePreview` directly, so editing
 * preview.tsx would have shipped these to the live soft-launch page. This route
 * renders the SAME component, untouched, and layers the three proposals over it
 * from the outside, each on its own switch. Turning all three off leaves the
 * exact page that is live today, which is the only honest way to compare.
 *
 * The layering is deliberately done through the DOM rather than by copying
 * preview.tsx: a 1,976-line fork would drift from the real page within a day,
 * and then the comparison would be a lie.
 */
/**
 * The real sections of the rendered HomePreview, in order.
 *
 * HomePreview's <main> opens with a <style> tag carrying PREVIEW_CSS, so the
 * hero is NOT children[0]. Indexing raw children put the demo strip above the
 * hero and portalled the court mark into the stylesheet, where it existed in
 * the DOM and painted nothing. Everything positional goes through here.
 */
function sections(root: HTMLElement | null): HTMLElement[] {
  const main = root?.querySelector("main")
  if (!main) return []
  return Array.from(main.children).filter(
    (el): el is HTMLElement =>
      el instanceof HTMLElement &&
      el.tagName !== "STYLE" &&
      !el.hasAttribute("data-lab-slot")
  )
}

export function MotionLab() {
  const [reveals, setReveals] = useState(true)
  const [courtMark, setCourtMark] = useState(true)
  const [demoStrip, setDemoStrip] = useState(true)

  const wrapRef = useRef<HTMLDivElement>(null)
  const [hero, setHero] = useState<HTMLElement | null>(null)
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  /* The hero is the first SECTION of HomePreview's <main>: the CourtBackdrop
     div, which is `relative isolate`. Anything portalled into it lands above
     the backdrop layer and below the z-10 content, which is exactly where a
     background mark belongs. */
  useEffect(() => {
    setHero(sections(wrapRef.current)[0] ?? null)
  }, [])

  /* The demo strip is inserted as a real sibling between the hero and the
     Screenshots section, so it participates in normal document flow and the
     reveal pass sees it like any other section. */
  useEffect(() => {
    const main = wrapRef.current?.querySelector("main")
    if (!main || !demoStrip) {
      setSlot(null)
      return
    }
    const el = document.createElement("div")
    el.setAttribute("data-lab-slot", "")
    /* Before the Screenshots section, which is the second real section. */
    main.insertBefore(el, sections(wrapRef.current)[1] ?? null)
    setSlot(el)
    return () => {
      el.remove()
      setSlot(null)
    }
  }, [demoStrip])

  /* Reveal targets: everything below the two full-height sections that already
     carry their own motion (the hero has hp-rise and a rotating headline, the
     Screenshots carousel has GuidedShot). The demo strip is excluded too: it
     runs its own in-view trigger, and a section that fades in and then starts
     playing is two entrances for one arrival. */
  useEffect(() => {
    if (!reveals) return
    const targets = sections(wrapRef.current).slice(2)
    if (targets.length === 0) return
    return armReveal(targets)
  }, [reveals, demoStrip, slot])

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: reveals ? REVEAL_CSS : "" }} />

      <div ref={wrapRef}>
        <HomePreview />
      </div>

      {courtMark && hero ? createPortal(<MobileCourtMark />, hero) : null}
      {demoStrip && slot ? createPortal(<DemoStrip />, slot) : null}

      <ControlBar
        reveals={reveals}
        courtMark={courtMark}
        demoStrip={demoStrip}
        onReveals={setReveals}
        onCourtMark={setCourtMark}
        onDemoStrip={setDemoStrip}
      />
    </div>
  )
}

function ControlBar({
  reveals,
  courtMark,
  demoStrip,
  onReveals,
  onCourtMark,
  onDemoStrip,
}: {
  reveals: boolean
  courtMark: boolean
  demoStrip: boolean
  onReveals: (v: boolean) => void
  onCourtMark: (v: boolean) => void
  onDemoStrip: (v: boolean) => void
}) {
  const [open, setOpen] = useState(true)
  const allOff = !reveals && !courtMark && !demoStrip

  /* On a phone the panel covers the hero it is meant to be judging, so it
     starts collapsed there. Done in an effect rather than in the initial
     state because this component still server-renders. */
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setOpen(false)
  }, [])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[100] cursor-pointer rounded-full bg-ink-950 px-4 py-2.5 text-[13px] font-bold text-white shadow-2xl ring-1 ring-white/20"
      >
        Motion lab
      </button>
    )
  }

  return (
    <aside className="fixed bottom-4 right-4 z-[100] w-[262px] rounded-2xl bg-ink-950/95 p-4 text-white shadow-2xl ring-1 ring-white/15 backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400">
          Motion lab
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="cursor-pointer rounded-md px-1.5 text-white/50 transition-colors hover:text-white"
          aria-label="Hide the motion lab controls"
        >
          &times;
        </button>
      </div>

      <p className="mt-1 text-[12px] leading-snug text-white/55">
        Nothing here is wired. All three off is the page that is live today.
      </p>

      <div className="mt-3 space-y-2">
        <Toggle
          label="1 · Scroll reveals"
          hint="Sections below the fold arrive instead of just being there."
          checked={reveals}
          onChange={onReveals}
        />
        <Toggle
          label="2 · Mobile court mark"
          hint="Phone widths only. Narrow the window under 768px to see it."
          checked={courtMark}
          onChange={onCourtMark}
        />
        <Toggle
          label="3 · Demo strip"
          hint="A real story, playing, right after the hero."
          checked={demoStrip}
          onChange={onDemoStrip}
        />
      </div>

      <button
        type="button"
        onClick={() => {
          const next = allOff
          onReveals(next)
          onCourtMark(next)
          onDemoStrip(next)
        }}
        className="mt-3 w-full cursor-pointer rounded-lg bg-white/10 py-2 text-[13px] font-bold text-white transition-colors hover:bg-white/20"
      >
        {allOff ? "Turn all three on" : "Compare with today"}
      </button>
    </aside>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-white/5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-gold-500"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold leading-tight">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-white/45">{hint}</span>
      </span>
    </label>
  )
}
