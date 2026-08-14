"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react"

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

/**
 * Brand-styled select (no native OS chrome) — used for month/year/hour/minute.
 *
 * `variant="dark"` is for the court-navy header band added 2026-08-13. Note
 * the `[&>option]` rules: a white-on-transparent select renders its dropdown
 * list with the OS popup background but the SELECT's text colour, so without
 * them the month list is white text on a white sheet.
 */
export function BrandSelect({
  value,
  onChange,
  children,
  className,
  ariaLabel,
  variant = "light",
}: {
  value: number
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void
  children: ReactNode
  className?: string
  ariaLabel: string
  variant?: "light" | "dark"
}) {
  const skin =
    variant === "dark"
      ? "border-white/25 bg-white/10 text-white hover:border-white/45 focus-visible:border-[#f59e0b] focus-visible:ring-[#f59e0b]/40 [&>option]:bg-white [&>option]:text-ink-900"
      : "border-ink-200 text-ink-800 bg-white hover:border-ink-300 focus-visible:border-play-500 focus-visible:ring-play-400"

  return (
    <div className={`relative ${className ?? ""}`}>
      <select
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        className={`w-full cursor-pointer appearance-none rounded-lg border py-1.5 pl-2.5 pr-6 text-sm font-semibold transition duration-200 focus:outline-none focus-visible:ring-2 ${skin}`}
      >
        {children}
      </select>
      <svg
        className={`pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${
          variant === "dark" ? "text-white/70" : "text-ink-400"
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/**
 * The faint court arc in the panel's bottom corner (2026-08-13). Cropped by
 * the panel edge and barely there, so the popover reads as ours without
 * competing with the numbers.
 */
function PanelWatermark() {
  return (
    <svg
      className="pointer-events-none absolute -bottom-10 -right-8 h-40 w-40 opacity-[0.06]"
      viewBox="0 0 200 200"
      fill="none"
      stroke="#101c36"
      strokeWidth="4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M20 200V150A80 80 0 0 1 180 150V200" />
      <path d="M70 200V120H130V200" />
      <circle cx="100" cy="120" r="26" />
      <path d="M0 200H200" />
    </svg>
  )
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

  return (
    <div className={`relative ${className ?? "mt-1 w-full"}`} ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-left text-sm text-ink-900 shadow-sm transition duration-200 hover:border-ink-300 focus:outline-none focus-visible:border-play-500 focus-visible:ring-2 focus-visible:ring-play-400"
      >
        <span className={value ? "" : "text-ink-500"}>
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
        <div className="border-ink-200 shadow-panel absolute z-50 mt-2 w-[336px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-white">
          <PanelWatermark />
          {/* Court-navy header band (2026-08-13) — the month and year controls
              sit on the house gradient instead of a plain white strip. */}
          {isDate && (
            <div className="relative flex items-center gap-2 bg-gradient-to-br from-[#101c36] via-[#1b2a4a] to-[#0d1526] px-2.5 py-2.5">
              <button
                type="button"
                onClick={() => (viewM === 0 ? (setViewM(11), setViewY(viewY - 1)) : setViewM(viewM - 1))}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/80 transition duration-200 hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]"
                aria-label="Previous month"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <BrandSelect
                value={viewM}
                onChange={(e) => setViewM(Number(e.target.value))}
                className="flex-1"
                ariaLabel="Month"
                variant="dark"
              >
                {MONTHS.map((mn, i) => (
                  <option key={mn} value={i}>{mn}</option>
                ))}
              </BrandSelect>
              <BrandSelect
                value={viewY}
                onChange={(e) => setViewY(Number(e.target.value))}
                ariaLabel="Year"
                variant="dark"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </BrandSelect>
              <button
                type="button"
                onClick={() => (viewM === 11 ? (setViewM(0), setViewY(viewY + 1)) : setViewM(viewM + 1))}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/80 transition duration-200 hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]"
                aria-label="Next month"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
          )}

          <div className="relative p-3">
            {isDate && (
              <div className="grid grid-cols-7 gap-1">
                {DOW.map((d, i) => (
                  <div key={i} className="text-ink-500 py-1 text-center text-[11px] font-bold uppercase">{d}</div>
                ))}
                {cells.map((d, i) => {
                  const selected =
                    d != null && parsed.hasDate && parsed.y === viewY && parsed.m === viewM && parsed.d === d
                  const isToday =
                    d != null && viewY === now.getFullYear() && viewM === now.getMonth() && d === now.getDate()
                  return (
                    <div key={i} className="flex items-center justify-center">
                      {d == null ? (
                        <span className="h-11 w-full" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => pickDay(d)}
                          aria-current={selected ? "date" : undefined}
                          className={`h-11 w-full cursor-pointer rounded-full text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-500 ${
                            selected
                              ? "bg-[#f59e0b] font-black text-ink-950"
                              : isToday
                                ? "text-ink-900 font-bold ring-1 ring-inset ring-[#f59e0b] hover:bg-play-50"
                                : "text-ink-700 hover:bg-play-50 hover:text-ink-950"
                          }`}
                        >
                          {d}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {isTime && (
              <div className={`flex items-center gap-2 ${isDate ? "border-ink-100 mt-3 border-t pt-3" : ""}`}>
                <span className="text-ink-500 text-xs font-bold uppercase tracking-wide">Time</span>
                <BrandSelect
                  value={parsed.hh}
                  onChange={(e) => setTime(Number(e.target.value), parsed.mm)}
                  ariaLabel="Hour"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{pad(h)}</option>
                  ))}
                </BrandSelect>
                <span className="text-ink-400">:</span>
                <BrandSelect
                  value={parsed.mm - (parsed.mm % 5)}
                  onChange={(e) => setTime(parsed.hh, Number(e.target.value))}
                  ariaLabel="Minute"
                >
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                    <option key={m} value={m}>{pad(m)}</option>
                  ))}
                </BrandSelect>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="bg-play-600 hover:bg-play-700 ml-auto cursor-pointer rounded-lg px-3.5 py-2 text-xs font-bold text-white transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-play-300 focus-visible:ring-offset-1"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
