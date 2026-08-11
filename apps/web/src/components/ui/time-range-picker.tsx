"use client"

import { useEffect, useRef, useState } from "react"
import { BrandSelect } from "./date-time-picker"

/**
 * Time-range picker (2026-08-04) — companion to DateTimePicker's "date" mode
 * for schedule forms. One button showing "6:00 – 7:30 PM" opens a panel with
 * Starts and Ends rows (12-hour + AM/PM); how long it lasts is derived and
 * shown as a hint. Controlled with the same shape the schedule APIs store:
 * `time` is the start "HH:mm" (24-hour) and `minutes` is the length —
 * editing the Ends row just recomputes `minutes`.
 */

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function h12(hh: number) {
  return hh % 12 === 0 ? 12 : hh % 12
}

export function formatLasts(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (!h) return `${m} min`
  return m ? `${h} hr ${m} min` : `${h} hr`
}

/** "6:00 – 7:30 PM" (AM/PM shown once when both ends share it). */
function formatRange(startTotal: number, endTotal: number): string {
  const sh = Math.floor(startTotal / 60) % 24
  const sm = startTotal % 60
  const eh = Math.floor(endTotal / 60) % 24
  const em = endTotal % 60
  const sHalf = sh < 12 ? "AM" : "PM"
  const eHalf = eh < 12 ? "AM" : "PM"
  const s = `${h12(sh)}:${pad(sm)}`
  const e = `${h12(eh)}:${pad(em)}`
  return sHalf === eHalf ? `${s} – ${e} ${eHalf}` : `${s} ${sHalf} – ${e} ${eHalf}`
}

function TimeRow({
  label,
  hh,
  mm,
  onPick,
}: {
  label: string
  hh: number
  mm: number
  onPick: (hh: number, mm: number) => void
}) {
  const isPM = hh >= 12
  const compose = (nextH12: number, nextMm: number, nextPM: boolean) =>
    onPick((nextH12 % 12) + (nextPM ? 12 : 0), nextMm)
  return (
    <div className="flex items-center gap-2">
      <span className="text-ink-500 w-12 text-xs font-semibold uppercase tracking-wide">{label}</span>
      <BrandSelect
        value={h12(hh)}
        onChange={(e) => compose(Number(e.target.value), mm, isPM)}
        ariaLabel={`${label} hour`}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </BrandSelect>
      <span className="text-ink-400">:</span>
      <BrandSelect
        value={mm - (mm % 5)}
        onChange={(e) => compose(h12(hh), Number(e.target.value), isPM)}
        ariaLabel={`${label} minute`}
      >
        {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
          <option key={m} value={m}>{pad(m)}</option>
        ))}
      </BrandSelect>
      <div className="border-ink-200 ml-auto flex overflow-hidden rounded-lg border">
        {(["AM", "PM"] as const).map((half) => {
          const active = half === "PM" ? isPM : !isPM
          return (
            <button
              key={half}
              type="button"
              onClick={() => compose(h12(hh), mm, half === "PM")}
              className={`px-2.5 py-1.5 text-xs font-semibold transition ${
                active ? "bg-play-600 text-white" : "text-ink-500 bg-white hover:bg-ink-50"
              }`}
            >
              {half}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TimeRangePicker({
  time,
  minutes,
  onChange,
  id,
  placeholder,
  className,
}: {
  /** Start time as "HH:mm" (24-hour), or "" for unset. */
  time: string
  /** How long it runs, in minutes (end time is start + this). */
  minutes: number
  onChange: (next: { time: string; minutes: number }) => void
  id?: string
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const [shh, smm] = (time || "18:00").split(":").map(Number)
  const startTotal = shh * 60 + smm
  const endTotal = startTotal + minutes
  const crossesDay = endTotal >= 24 * 60

  function pickStart(hh: number, mm: number) {
    onChange({ time: `${pad(hh)}:${pad(mm)}`, minutes })
  }
  function pickEnd(hh: number, mm: number) {
    // Ends row edits the length: end before (or equal to) start snaps to the
    // shortest slot instead of going negative or wrapping past midnight.
    let next = hh * 60 + mm - startTotal
    if (next <= 0) next = 5
    onChange({ time: time || `${pad(shh)}:${pad(smm)}`, minutes: next })
  }

  return (
    <div className={`relative ${className ?? "mt-1 w-full"}`} ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-left text-sm text-ink-900 shadow-sm transition hover:border-ink-300 focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-200"
      >
        <span className={time ? "" : "text-ink-400"}>
          {time ? formatRange(startTotal, endTotal) : placeholder || "Pick a time…"}
        </span>
        <svg className="text-ink-400 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="border-ink-200 shadow-panel absolute z-50 mt-2 w-[288px] space-y-3 rounded-2xl border bg-white p-3">
          <TimeRow label="Starts" hh={shh} mm={smm} onPick={pickStart} />
          <div className="border-ink-100 border-t pt-3">
            <TimeRow
              label="Ends"
              hh={Math.floor(endTotal / 60) % 24}
              mm={endTotal % 60}
              onPick={pickEnd}
            />
          </div>
          <div className="border-ink-100 flex items-center border-t pt-3">
            <span className="text-ink-500 text-xs">
              Lasts <span className="text-ink-800 font-semibold">{formatLasts(minutes)}</span>
              {crossesDay ? " · ends next day" : ""}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="bg-play-600 hover:bg-play-700 ml-auto rounded-lg px-3 py-1 text-xs font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
