"use client"

import { useEffect, useMemo, useRef, useState } from "react"

/**
 * Branded date/time picker (owner 2026-07-21) — replaces the native
 * <input type="date|datetime-local|time">. Controlled: `value` is the SAME
 * string the native input produces, so it's a drop-in for form state:
 *   mode "date"      → "YYYY-MM-DD"
 *   mode "datetime"  → "YYYY-MM-DDTHH:mm"
 *   mode "time"      → "HH:mm"
 * A month-grid popover (with a year jump, for far-back dates like DOB) + a
 * time selector, styled with brand tokens. Closes on outside-click / Esc.
 */

type Mode = "date" | "datetime" | "time"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const DOW = ["S", "M", "T", "W", "T", "F", "S"]

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** Split the stored value into {y,m,d,hh,mm} pieces (all optional). */
export function parse(value: string, mode: Mode) {
  const out = { y: 0, m: 0, d: 0, hh: 9, mm: 0, hasDate: false, hasTime: false }
  if (!value) return out
  if (mode === "time") {
    const [hh, mm] = value.split(":")
    if (hh !== undefined && mm !== undefined) {
      out.hh = Number(hh)
      out.mm = Number(mm)
      out.hasTime = true
    }
    return out
  }
  const [datePart, timePart] = value.split("T")
  const [y, m, d] = datePart.split("-").map(Number)
  if (y && m && d) {
    out.y = y
    out.m = m - 1
    out.d = d
    out.hasDate = true
  }
  if (timePart) {
    const [hh, mm] = timePart.split(":").map(Number)
    if (!Number.isNaN(hh)) {
      out.hh = hh
      out.mm = mm
      out.hasTime = true
    }
  }
  return out
}

export function compose(
  mode: Mode,
  p: { y: number; m: number; d: number; hh: number; mm: number }
): string {
  const date = `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`
  if (mode === "date") return date
  if (mode === "time") return `${pad(p.hh)}:${pad(p.mm)}`
  return `${date}T${pad(p.hh)}:${pad(p.mm)}`
}

export function formatDisplay(value: string, mode: Mode): string {
  if (!value) return ""
  const p = parse(value, mode)
  if (mode === "time") return `${pad(p.hh)}:${pad(p.mm)}`
  if (!p.hasDate) return ""
  const dateStr = `${MONTHS[p.m].slice(0, 3)} ${p.d}, ${p.y}`
  if (mode === "date") return dateStr
  return `${dateStr} · ${pad(p.hh)}:${pad(p.mm)}`
}

export function DateTimePicker({
  value,
  onChange,
  mode = "datetime",
  id,
  placeholder,
  className,
  yearRange,
}: {
  value: string
  onChange: (value: string) => void
  mode?: Mode
  id?: string
  placeholder?: string
  className?: string
  /** [minYear, maxYear] for the year dropdown; defaults around now (±8). */
  yearRange?: [number, number]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const now = useMemo(() => new Date(), [])
  const parsed = parse(value, mode)

  // Which month the grid shows (independent of the selected day).
  const [viewY, setViewY] = useState(parsed.hasDate ? parsed.y : now.getFullYear())
  const [viewM, setViewM] = useState(parsed.hasDate ? parsed.m : now.getMonth())

  useEffect(() => {
    if (parsed.hasDate) {
      setViewY(parsed.y)
      setViewM(parsed.m)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

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

  const [minYear, maxYear] = yearRange ?? [now.getFullYear() - 8, now.getFullYear() + 8]
  const years: number[] = []
  for (let y = maxYear; y >= minYear; y--) years.push(y)

  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const firstDow = new Date(viewY, viewM, 1).getDay()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function pickDay(d: number) {
    onChange(compose(mode, { y: viewY, m: viewM, d, hh: parsed.hh, mm: parsed.mm }))
    if (mode === "date") setOpen(false)
  }
  function setTime(hh: number, mm: number) {
    const base = parsed.hasDate
      ? { y: parsed.y, m: parsed.m, d: parsed.d }
      : { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() }
    onChange(compose(mode, { ...base, hh, mm }))
  }

  const isDate = mode !== "time"
  const isTime = mode !== "date"

  const inputCls =
    className ??
    "mt-1 flex w-full items-center justify-between rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-left text-sm text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-200"

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        className={inputCls}
      >
        <span className={value ? "" : "text-ink-400"}>
          {formatDisplay(value, mode) || placeholder || "Select…"}
        </span>
        <svg className="text-ink-400 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {mode === "time" ? (
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" />
            </>
          ) : (
            <>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div className="border-ink-200 shadow-panel absolute z-50 mt-2 w-[288px] rounded-2xl border bg-white p-3">
          {isDate && (
            <>
              <div className="mb-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (viewM === 0 ? (setViewM(11), setViewY(viewY - 1)) : setViewM(viewM - 1))}
                  className="text-ink-500 hover:bg-ink-50 rounded-lg p-1.5"
                  aria-label="Previous month"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <select
                  value={viewM}
                  onChange={(e) => setViewM(Number(e.target.value))}
                  className="border-ink-200 flex-1 rounded-lg border px-2 py-1 text-sm"
                >
                  {MONTHS.map((mn, i) => (
                    <option key={mn} value={i}>{mn}</option>
                  ))}
                </select>
                <select
                  value={viewY}
                  onChange={(e) => setViewY(Number(e.target.value))}
                  className="border-ink-200 rounded-lg border px-2 py-1 text-sm"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => (viewM === 11 ? (setViewM(0), setViewY(viewY + 1)) : setViewM(viewM + 1))}
                  className="text-ink-500 hover:bg-ink-50 rounded-lg p-1.5"
                  aria-label="Next month"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {DOW.map((d, i) => (
                  <div key={i} className="text-ink-400 py-1 text-center text-[11px] font-semibold">{d}</div>
                ))}
                {cells.map((d, i) => {
                  const selected =
                    d != null && parsed.hasDate && parsed.y === viewY && parsed.m === viewM && parsed.d === d
                  const isToday =
                    d != null && viewY === now.getFullYear() && viewM === now.getMonth() && d === now.getDate()
                  return (
                    <div key={i} className="flex items-center justify-center">
                      {d == null ? (
                        <span className="h-8 w-8" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => pickDay(d)}
                          className={`h-8 w-8 rounded-lg text-sm transition ${
                            selected
                              ? "bg-play-600 font-bold text-white"
                              : isToday
                                ? "text-play-700 bg-play-50 font-semibold"
                                : "text-ink-700 hover:bg-ink-100"
                          }`}
                        >
                          {d}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {isTime && (
            <div className={`flex items-center gap-2 ${isDate ? "border-ink-100 mt-3 border-t pt-3" : ""}`}>
              <span className="text-ink-500 text-xs font-semibold uppercase tracking-wide">Time</span>
              <select
                value={parsed.hh}
                onChange={(e) => setTime(Number(e.target.value), parsed.mm)}
                className="border-ink-200 rounded-lg border px-2 py-1 text-sm"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{pad(h)}</option>
                ))}
              </select>
              <span className="text-ink-400">:</span>
              <select
                value={parsed.mm - (parsed.mm % 5)}
                onChange={(e) => setTime(parsed.hh, Number(e.target.value))}
                className="border-ink-200 rounded-lg border px-2 py-1 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                  <option key={m} value={m}>{pad(m)}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="bg-play-600 hover:bg-play-700 ml-auto rounded-lg px-3 py-1 text-xs font-semibold text-white"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
