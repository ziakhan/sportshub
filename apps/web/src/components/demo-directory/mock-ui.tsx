"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Crest } from "@/components/ui/crest"
import { PlayerMug } from "@/components/ui/player-mug"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"

/**
 * Mock UI v2 for the demo directory (2026-08-15).
 *
 * These are stand-ins for TODAY'S product, not July's: the court band on the
 * header, neutral crests, the rounded card language, the brand button. Real kit
 * pieces are imported where they are safe to render inside a scaled frame
 * (Crest, CourtBackdropLayer); the rest is mocked light, because a demo frame
 * needs pixels that read at 70% scale more than it needs live logic.
 *
 * Anything the pointer touches carries `data-demo-target`, and styles its own
 * hover and press states off `data-demo-hover` / `data-demo-press` so the
 * choreography drives real component states instead of drawing fake ones.
 */

/* ── Chrome ──────────────────────────────────────────────────────────────── */

export function MockTopBar({
  workspace,
  tabs,
  activeTab,
}: {
  workspace: string
  tabs: string[]
  activeTab: string
}) {
  return (
    <div className="border-ink-100 flex items-center gap-4 border-b bg-white px-5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="bg-court-900 flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-white">
          SH
        </span>
        <span className="text-ink-900 text-sm font-semibold">SportsHub</span>
      </div>
      <div className="bg-ink-100 h-5 w-px" />
      <div className="flex items-center gap-2">
        <Crest name={workspace} size="xs" />
        <span className="text-ink-700 text-sm font-semibold">{workspace}</span>
      </div>
      <nav className="ml-4 flex items-center gap-1">
        {tabs.map((t) => (
          <span
            key={t}
            className={cn(
              "rounded-full px-3 py-1 text-[13px] font-medium",
              t === activeTab ? "bg-ink-900 text-white" : "text-ink-500"
            )}
          >
            {t}
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-ink-400 relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-5 w-5"
          >
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </span>
        <span className="bg-hoop-100 text-hoop-700 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold">
          DM
        </span>
      </div>
    </div>
  )
}

/** The daylight band that every browse and workspace header sits on. */
export function MockBand({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="relative isolate overflow-hidden border-b border-[#e7dbc4]">
      <CourtBackdropLayer variant="daylight" intensity="band" />
      <div className="relative z-10 flex items-end gap-4 px-6 py-5">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b45309]">
              {eyebrow}
            </p>
          )}
          <h1 className="text-ink-900 mt-1 text-[26px] font-bold leading-tight tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-ink-600 mt-1 text-[13px] leading-relaxed">{description}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  )
}

/* ── Surfaces ────────────────────────────────────────────────────────────── */

export function MockPanel({
  title,
  meta,
  action,
  children,
  className,
}: {
  title: string
  meta?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "border-ink-100 overflow-hidden rounded-2xl border bg-white shadow-[0_10px_30px_-26px_rgba(15,23,42,0.55)]",
        className
      )}
    >
      <header className="border-ink-100 flex items-center gap-3 border-b px-4 py-3">
        <h2 className="text-ink-900 text-[15px] font-semibold">{title}</h2>
        {meta && <span className="text-ink-400 text-xs font-medium">{meta}</span>}
        <div className="ml-auto">{action}</div>
      </header>
      {children}
    </section>
  )
}

export function MockTile({
  label,
  value,
  tone = "neutral",
  compact,
}: {
  label: string
  /** A node, so a tile can carry a counter that tweens between beats. */
  value: ReactNode
  tone?: "neutral" | "court" | "hoop" | "play"
  /** Shorter tile, for screens that also carry a full table. */
  compact?: boolean
}) {
  const tones: Record<string, string> = {
    neutral: "border-ink-100 bg-white",
    court: "border-court-100 bg-court-50/70",
    hoop: "border-hoop-100 bg-hoop-50/70",
    play: "border-play-100 bg-play-50/70",
  }
  return (
    <div
      className={cn("rounded-2xl border px-4", compact ? "py-2" : "py-3", tones[tone])}
    >
      <p className="text-ink-500 text-[11px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </p>
      <p
        className={cn(
          "text-ink-900 mt-0.5 font-bold tabular-nums",
          compact ? "text-xl" : "mt-1 text-2xl"
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function MockPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "court" | "hoop" | "gold" | "play"
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink-50 text-ink-600 ring-ink-200",
    court: "bg-court-50 text-court-700 ring-court-100",
    hoop: "bg-hoop-50 text-hoop-600 ring-hoop-100",
    gold: "bg-gold-50 text-gold-700 ring-gold-100",
    play: "bg-play-50 text-play-700 ring-play-100",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        tones[tone]
      )}
    >
      {children}
    </span>
  )
}

/* ── Controls the pointer touches ────────────────────────────────────────── */

/**
 * A button the demo can hover and press. Hover and press are real element
 * states driven by data attributes, so what the viewer sees is the same
 * feedback a hand would get.
 */
export function MockButton({
  id,
  children,
  tone = "brand",
  size = "md",
  icon,
  className,
}: {
  /** `data-demo-target` handle used by the script. */
  id?: string
  children: ReactNode
  tone?: "brand" | "quiet" | "court"
  size?: "sm" | "md"
  icon?: ReactNode
  className?: string
}) {
  const tones: Record<string, string> = {
    brand: "bg-[color:var(--brand,#1a73e8)] text-white shadow-sm",
    court: "bg-court-600 text-white shadow-sm",
    quiet: "border-ink-200 text-ink-700 border bg-white",
  }
  return (
    <span
      data-demo-target={id}
      className={cn(
        "inline-flex select-none items-center gap-2 rounded-xl font-semibold transition-all duration-200 motion-reduce:transition-none",
        size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-4 py-2.5 text-[13px]",
        tones[tone],
        "data-[demo-hover=true]:-translate-y-[1px] data-[demo-hover=true]:brightness-110 data-[demo-hover=true]:shadow-md",
        "data-[demo-press=true]:translate-y-0 data-[demo-press=true]:scale-[0.97] data-[demo-press=true]:brightness-95",
        className
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/** A form field. The value is normally a TypeText so it fills as it is typed. */
export function MockField({
  id,
  label,
  children,
  hint,
  className,
}: {
  id?: string
  label: string
  children: ReactNode
  hint?: string
  className?: string
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-ink-600 mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em]">
        {label}
      </span>
      <span
        data-demo-target={id}
        className={cn(
          "border-ink-200 flex min-h-[38px] w-full items-center rounded-xl border bg-white px-3 py-2 text-[13px] transition-all duration-200 motion-reduce:transition-none",
          "data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
        )}
      >
        {children}
      </span>
      {hint && <span className="text-ink-400 mt-1 block text-[11px]">{hint}</span>}
    </label>
  )
}

/** Modal sheet over the desktop surface, the way the product opens a flow. */
export function MockDialog({
  open,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b1628]/35 px-10">
      <div className="live-pop border-ink-100 w-full max-w-[560px] overflow-hidden rounded-3xl border bg-white shadow-[0_50px_120px_-40px_rgba(15,23,42,0.65)]">
        <header className="border-ink-100 border-b px-6 py-4">
          <h3 className="text-ink-900 text-[17px] font-bold tracking-tight">{title}</h3>
          {subtitle && <p className="text-ink-500 mt-0.5 text-[12px]">{subtitle}</p>}
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <footer className="border-ink-100 bg-ink-50/60 flex items-center justify-end gap-3 border-t px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/* ── Phone surfaces ──────────────────────────────────────────────────────── */

/** The app shell families see: navy header, content, tab bar. */
export function PhoneShell({
  title,
  subtitle,
  activeTab = "Home",
  children,
}: {
  title: string
  subtitle?: string
  activeTab?: string
  children: ReactNode
}) {
  const tabs = ["Home", "Teams", "Calendar", "More"]
  return (
    <div className="flex h-full flex-col bg-[#f6f7f9]">
      <div className="relative isolate overflow-hidden bg-[#0b1628] px-4 pb-4 pt-2">
        <CourtBackdropLayer variant="navy" intensity="band" />
        <div className="relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-400">
            {subtitle ?? "SportsHub"}
          </p>
          <h2 className="mt-0.5 text-[17px] font-bold leading-tight text-white">{title}</h2>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">{children}</div>
      <div className="border-ink-100 flex shrink-0 items-center justify-around border-t bg-white pb-5 pt-2">
        {tabs.map((t) => (
          <span
            key={t}
            className={cn(
              "text-[10px] font-semibold",
              t === activeTab ? "text-court-700" : "text-ink-400"
            )}
          >
            <span
              className={cn(
                "mx-auto mb-1 block h-4 w-4 rounded-md",
                t === activeTab ? "bg-court-600" : "bg-ink-200"
              )}
            />
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Program card on the phone: cover strip, kind chip, title, meta, action. */
export function PhoneProgramCard({
  kind,
  title,
  club,
  meta,
  fee,
  fresh,
  action,
  actionId,
}: {
  kind: string
  title: string
  club: string
  meta: string
  fee?: string
  /** Just arrived: pops in rather than simply existing. */
  fresh?: boolean
  action?: string
  /** `data-demo-target` on the action, so the pointer can reach it. */
  actionId?: string
}) {
  return (
    <article
      className={cn(
        "border-ink-100 overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_-18px_rgba(15,23,42,0.6)]",
        fresh && "live-row-in"
      )}
    >
      <div className="relative h-[76px] overflow-hidden bg-[#0b1628]">
        <CourtBackdropLayer variant="navy" intensity="band" />
        <span className="absolute left-3 top-3 z-10 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white ring-1 ring-inset ring-white/25">
          {kind}
        </span>
      </div>
      <div className="px-3 py-3">
        <div className="flex items-center gap-2">
          <Crest name={club} size="xs" />
          <span className="text-ink-500 text-[11px] font-semibold">{club}</span>
        </div>
        <h3 className="text-ink-900 mt-1.5 text-[14px] font-bold leading-snug">{title}</h3>
        <p className="text-ink-500 mt-1 text-[12px]">{meta}</p>
        <div className="mt-3 flex items-center justify-between">
          {fee && <span className="text-ink-900 text-[13px] font-bold">{fee}</span>}
          {action && (
            <span
              data-demo-target={actionId}
              className={cn(
                "rounded-lg bg-[color:var(--brand,#1a73e8)] px-3 py-1.5 text-[12px] font-semibold text-white transition-all duration-200 motion-reduce:transition-none",
                "data-[demo-hover=true]:shadow-md data-[demo-hover=true]:brightness-110",
                "data-[demo-press=true]:scale-[0.97] data-[demo-press=true]:brightness-95"
              )}
            >
              {action}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

/* ── Control kit, mocked ─────────────────────────────────────────────────── */

/**
 * Segmented chips, the look of `components/ui/chip-group`. Every chip is its
 * own pointer target (`<idPrefix>-<value>`) so a beat can pick one by name.
 */
export function MockChips({
  idPrefix,
  value,
  options,
  className,
}: {
  idPrefix: string
  value: string
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const selected = o.value === value
        return (
          <span
            key={o.value}
            data-demo-target={`${idPrefix}-${o.value}`}
            className={cn(
              "inline-flex select-none items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 motion-reduce:transition-none",
              selected
                ? "border-play-600 bg-play-600 text-white shadow-sm"
                : "border-ink-200 text-ink-700 bg-white",
              !selected &&
                "data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:bg-play-50/60",
              "data-[demo-press=true]:scale-[0.96]"
            )}
          >
            {o.label}
          </span>
        )
      })}
    </div>
  )
}

/**
 * The brand listbox: closed trigger, and an open popover with the chosen row
 * carrying the amber check. Options are targets too (`<id>-opt-<value>`), so
 * the pointer opens the list and then picks from it, the way a hand does.
 */
export function MockListbox({
  id,
  label,
  value,
  placeholder = "Select...",
  open,
  options,
  className,
}: {
  id: string
  label?: string
  value: string
  placeholder?: string
  open?: boolean
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      {label && (
        <span className="text-ink-600 mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em]">
          {label}
        </span>
      )}
      <span
        data-demo-target={id}
        className={cn(
          "flex min-h-[36px] w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-[12px] shadow-sm transition-all duration-200 motion-reduce:transition-none",
          open ? "border-play-500 ring-play-100 ring-2" : "border-ink-200",
          "data-[demo-hover=true]:border-play-300",
          "data-[demo-press=true]:scale-[0.99]"
        )}
      >
        <span className={value ? "text-ink-900 font-semibold" : "text-ink-400"}>
          {value || placeholder}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          className={cn(
            "text-ink-400 h-3 w-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180"
          )}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
      {open && (
        <div className="border-ink-200 live-pop absolute left-0 right-0 top-full z-30 mt-1 max-h-[196px] overflow-hidden rounded-xl border bg-white p-1 shadow-[0_24px_50px_-20px_rgba(15,23,42,0.45)]">
          {options.map((o) => {
            const selected = o.value === value
            return (
              <span
                key={o.value}
                data-demo-target={`${id}-opt-${o.value}`}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors duration-150 motion-reduce:transition-none",
                  selected ? "bg-play-50 text-ink-900 font-semibold" : "text-ink-700",
                  "data-[demo-hover=true]:bg-play-50/70",
                  "data-[demo-press=true]:bg-play-100"
                )}
              >
                <span className="truncate">{o.label}</span>
                {selected && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    className="h-3 w-3 shrink-0"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Stacked choice cards, the look of `components/ui/choice-card`. */
export function MockChoiceCards({
  idPrefix,
  value,
  options,
  className,
}: {
  idPrefix: string
  value: string
  options: { value: string; title: string; description?: ReactNode; badge?: string }[]
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {options.map((o) => {
        const selected = o.value === value
        return (
          <span
            key={o.value}
            data-demo-target={`${idPrefix}-${o.value}`}
            className={cn(
              "flex w-full items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200 motion-reduce:transition-none",
              selected ? "border-play-500 bg-play-50" : "border-ink-200 bg-white",
              !selected &&
                "data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:bg-play-50/50",
              "data-[demo-press=true]:scale-[0.99]"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                selected ? "border-play-600" : "border-ink-300"
              )}
            >
              {selected && <span className="bg-play-600 h-1.5 w-1.5 rounded-full" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-ink-900 text-[12px] font-semibold">{o.title}</span>
                {o.badge && (
                  <span className="bg-ink-100 text-ink-600 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]">
                    {o.badge}
                  </span>
                )}
              </span>
              {o.description && (
                <span className="text-ink-500 mt-0.5 block text-[11px] leading-snug">
                  {o.description}
                </span>
              )}
            </span>
          </span>
        )
      })}
    </div>
  )
}

/**
 * A number that travels to its new value instead of jumping. Counters are the
 * one thing in this kit that animates on a state change rather than on mount,
 * because the point of a filling roster is watching it fill.
 */
export function MockCounter({
  value,
  duration = 620,
  className,
}: {
  value: number
  duration?: number
  className?: string
}) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    const start = from.current
    if (start === value) return
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      from.current = value
      setShown(value)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(start + (value - start) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    const safety = setTimeout(() => {
      from.current = value
      setShown(value)
    }, duration + 160)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(safety)
    }
  }, [value, duration])

  return (
    <span className={cn("tabular-nums", className)}>{shown}</span>
  )
}

/* ── Roster ──────────────────────────────────────────────────────────────── */

export interface MockRosterPlayer {
  name: string
  number: string
  position: string
  uniform: string
  tracksuit: string
  shoes: string
}

/**
 * The club roster table, column for column: the mug carrying the jersey
 * number, the player, then the three sizes the accept flow collected, the
 * waiver state and the finalized badge.
 */
export function MockRosterTable({
  players,
  freshFrom = 0,
}: {
  players: MockRosterPlayer[]
  /** Rows from this index on cascade in rather than simply being there. */
  freshFrom?: number
}) {
  /* Row height is the budget here: ten of these plus the tiles and the band
     have to sit inside 620px of frame without a scrollbar, because the frame
     never scrolls. Hence the 22px mug and the half-step padding. */
  const head =
    "px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500"
  const cell = "px-3 py-0.5 text-[11.5px] text-ink-600 whitespace-nowrap"
  return (
    <table className="w-full table-fixed">
      <thead className="bg-ink-50">
        <tr>
          <th className={cn(head, "w-[46px]")}>#</th>
          <th className={cn(head, "w-[190px]")}>Player</th>
          <th className={cn(head, "w-[92px]")}>Position</th>
          <th className={cn(head, "w-[84px]")}>Uniform</th>
          <th className={cn(head, "w-[90px]")}>Tracksuit</th>
          <th className={cn(head, "w-[70px]")}>Shoes</th>
          <th className={cn(head, "w-[92px]")}>Waivers</th>
          <th className={head}>Status</th>
        </tr>
      </thead>
      <tbody className="divide-ink-50 divide-y">
        {players.map((p, i) => (
          <tr
            key={p.name}
            className={cn("bg-white", i >= freshFrom && "live-row-in")}
            style={i >= freshFrom ? { animationDelay: `${(i - freshFrom) * 70}ms` } : undefined}
          >
            <td className="px-3 py-0.5">
              <PlayerMug
                name={p.name}
                jerseyNumber={p.number}
                accentKey={p.name}
                sizeClassName="h-[22px] w-[22px] rounded-full"
              />
            </td>
            <td className={cn(cell, "text-ink-900 font-semibold")}>{p.name}</td>
            <td className={cell}>{p.position}</td>
            <td className={cell}>{p.uniform}</td>
            <td className={cell}>{p.tracksuit}</td>
            <td className={cell}>{p.shoes}</td>
            <td className="px-3 py-0.5">
              <MockPill tone="court">Signed</MockPill>
            </td>
            <td className="px-3 py-0.5">
              <MockPill tone="court">Finalized</MockPill>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The dashed empty state the product shows a roster with nobody on it. */
export function MockEmptyState({
  title,
  body,
  icon,
}: {
  title: string
  body: string
  icon?: ReactNode
}) {
  return (
    <div className="border-ink-300 rounded-3xl border border-dashed bg-white px-8 py-10 text-center">
      {icon && (
        <span className="bg-ink-50 text-ink-300 mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl">
          {icon}
        </span>
      )}
      <h3 className="text-ink-900 font-condensed text-[17px] font-bold uppercase tracking-wide">
        {title}
      </h3>
      <p className="text-ink-500 mt-1.5 text-[12.5px]">{body}</p>
    </div>
  )
}

/** Skeleton row used to hint at content that is not the point of the beat. */
export function MockRow({
  title,
  meta,
  right,
  muted,
}: {
  title: string
  meta: string
  right?: ReactNode
  muted?: boolean
}) {
  return (
    <div
      className={cn(
        "border-ink-50 flex items-center gap-3 border-b px-4 py-3 last:border-b-0",
        muted && "opacity-70"
      )}
    >
      <span className="bg-ink-100 h-8 w-8 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="text-ink-800 truncate text-[13px] font-semibold">{title}</p>
        <p className="text-ink-400 truncate text-[11px]">{meta}</p>
      </div>
      {right}
    </div>
  )
}

/* ── Phone: the family side of the story ─────────────────────────────────── */

/** Section label on a phone screen. */
export function PhoneLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-ink-500 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
      {children}
    </p>
  )
}

/** A money line: what this costs, spelled out before anything is charged. */
export function PhoneMoneyRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-1.5 text-[12px]",
        strong ? "text-ink-900 font-bold" : "text-ink-600"
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

/** Saved card row, the way the accept flow shows a card already on file. */
export function PhoneCardRow({ brand, last4 }: { brand: string; last4: string }) {
  return (
    <div className="border-ink-200 flex items-center gap-2 rounded-xl border bg-white px-2.5 py-2">
      <span className="bg-ink-900 flex h-5 w-7 shrink-0 items-center justify-center rounded text-[7px] font-bold uppercase tracking-wide text-white">
        {brand}
      </span>
      <span className="text-ink-800 text-[12px] font-semibold">•••• {last4}</span>
      <MockPill tone="neutral">Default</MockPill>
    </div>
  )
}

/** The full-width action at the bottom of a phone screen. */
export function PhoneAction({
  id,
  children,
  tone = "brand",
}: {
  id?: string
  children: ReactNode
  tone?: "brand" | "quiet"
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "block w-full select-none rounded-xl px-3 py-2.5 text-center text-[13px] font-bold transition-all duration-200 motion-reduce:transition-none",
        tone === "brand"
          ? "bg-[color:var(--brand,#1a73e8)] text-white shadow-sm"
          : "border-ink-200 text-ink-700 border bg-white",
        "data-[demo-hover=true]:brightness-110 data-[demo-hover=true]:shadow-md",
        "data-[demo-press=true]:scale-[0.98] data-[demo-press=true]:brightness-95"
      )}
    >
      {children}
    </span>
  )
}

/** Bottom sheet: the pay step rises over the screen it was started from. */
export function PhoneSheet({
  open,
  title,
  subtitle,
  children,
}: {
  open: boolean
  title: string
  subtitle?: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0b1628]/45">
      <div className="live-pop rounded-t-3xl bg-white px-4 pb-6 pt-4 shadow-[0_-20px_60px_-20px_rgba(15,23,42,0.5)]">
        <span className="bg-ink-200 mx-auto mb-3 block h-1 w-9 rounded-full" />
        <h3 className="text-ink-900 text-[15px] font-bold">{title}</h3>
        {subtitle && <p className="text-ink-500 mt-0.5 text-[11.5px]">{subtitle}</p>}
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}

/** The offer, arriving on the phone as a card rather than an email thread. */
export function PhoneOfferCard({
  club,
  team,
  season,
  packageLabel,
  includes,
  fee,
  expires,
  acceptId,
}: {
  club: string
  team: string
  season: string
  packageLabel: string
  includes: string
  fee: string
  expires: string
  acceptId: string
}) {
  return (
    <article className="border-ink-100 live-row-in overflow-hidden rounded-2xl border bg-white shadow-[0_10px_28px_-18px_rgba(15,23,42,0.6)]">
      <div className="relative overflow-hidden bg-[#0b1628] px-3 py-3">
        <CourtBackdropLayer variant="navy" intensity="band" />
        <div className="relative z-10 flex items-center gap-2">
          <Crest name={club} size="xs" surface="dark" />
          <div className="min-w-0">
            <p className="text-gold-400 text-[9px] font-bold uppercase tracking-[0.16em]">
              Offer from {club}
            </p>
            <p className="truncate text-[13px] font-bold leading-tight text-white">
              {team} · {season}
            </p>
          </div>
        </div>
      </div>
      <div className="px-3 py-3">
        <p className="text-ink-900 text-[12.5px] font-bold">{packageLabel}</p>
        <p className="text-ink-500 mt-0.5 text-[11px] leading-snug">{includes}</p>
        <div className="border-ink-100 mt-2 border-t pt-2">
          <PhoneMoneyRow label="Season fee" value={fee} strong />
          <p className="text-ink-400 text-[10.5px]">Respond by {expires}</p>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="flex-1">
            <PhoneAction id={acceptId}>Accept</PhoneAction>
          </span>
          <span className="border-ink-200 text-ink-500 rounded-xl border px-3 py-2.5 text-[12px] font-semibold">
            Decline
          </span>
        </div>
      </div>
    </article>
  )
}

/** The confirmation a family actually wants: it happened, and here is proof. */
export function PhoneSuccess({
  title,
  body,
  rows,
}: {
  title: string
  body: string
  rows?: { label: string; value: string }[]
}) {
  return (
    <div className="live-pop border-court-100 rounded-2xl border bg-white px-4 py-5 text-center">
      <span className="bg-court-600 mx-auto flex h-11 w-11 items-center justify-center rounded-full text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <h3 className="text-ink-900 mt-3 text-[14px] font-bold leading-snug">{title}</h3>
      <p className="text-ink-500 mt-1 text-[11.5px] leading-relaxed">{body}</p>
      {rows && rows.length > 0 && (
        <div className="border-ink-100 mt-3 border-t pt-2 text-left">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-1 text-[11.5px]">
              <span className="text-ink-500">{r.label}</span>
              <span className="text-ink-900 font-semibold tabular-nums">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Comms kit (story 2) ─────────────────────────────────────────────────── *
 *
 * Everything below mirrors a surface that ships today, named where it is not
 * obvious:
 *   · MockTextArea / MockEmailPreview / MockConfirm — components/comms/
 *     message-composer.tsx (subject and body with their live counters, the
 *     preview pane, and the "Send to ~N recipients?" confirm).
 *   · MockReadMeter — the delivery view. The read cursor behind it is
 *     TeamChatRead (userId, teamId, lastReadAt), which is what the unread
 *     badge already counts; this is the same number read from the other end.
 *   · MockPollResults — components/polls/poll-card.tsx (QuestionBlock): fill
 *     bar sized against the leading option, "count · share%", the staff-only
 *     voter names, "Pick one · N voted".
 *   · PhoneChat* — app/(platform)/teams/[teamId]/chat/team-chat.tsx: play-600
 *     bubbles for you, court-50 for everyone else, the STAFF badge, the
 *     reaction row, "Message the team…" and the 📊 quick-poll button.
 *   · PhonePollBubble — components/chat/poll-bubble.tsx, trophy on the
 *     leading option and a check on yours.
 */

/** Multi-line field. The composer is the one place the product counts characters. */
export function MockTextArea({
  id,
  label,
  children,
  counter,
  rows = 4,
}: {
  id?: string
  label: string
  children: ReactNode
  /** "42/150", exactly as the real composer shows it. */
  counter?: string
  rows?: number
}) {
  return (
    <label className="block">
      <span className="text-ink-600 mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em]">
        {label}
      </span>
      <span
        data-demo-target={id}
        className={cn(
          "border-ink-200 block w-full rounded-xl border bg-white px-3 py-2 text-[13px] leading-relaxed transition-all duration-200 motion-reduce:transition-none",
          "data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
        )}
        style={{ minHeight: rows * 19 + 16 }}
      >
        {children}
      </span>
      {counter && (
        <span className="text-ink-400 mt-1 block text-right text-[11px] tabular-nums">
          {counter}
        </span>
      )}
    </label>
  )
}

/** The live preview pane: what a family receives, written as it is typed. */
export function MockEmailPreview({
  id,
  org,
  subject,
  body,
}: {
  id?: string
  org: string
  subject: ReactNode
  body: ReactNode
}) {
  return (
    <div>
      <p className="text-ink-500 mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
        Preview
      </p>
      <div
        data-demo-target={id}
        className="border-ink-100 bg-ink-50 rounded-2xl border p-4 transition-all duration-200 motion-reduce:transition-none data-[demo-hover=true]:border-play-200 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
      >
        <p className="text-ink-500 text-[11px]">From {org} via SportsHub</p>
        <p className="text-ink-950 mt-2 text-[15px] font-bold leading-snug">{subject}</p>
        <div className="text-ink-700 mt-2.5 text-[12.5px] leading-relaxed">{body}</div>
        <div className="border-ink-200 mt-4 border-t pt-2.5">
          <p className="text-ink-400 text-[10.5px] leading-relaxed">
            Sent by {org} via SportsHub · Unsubscribe from {org} · Manage all email preferences
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * The read meter. The bar and the counter both travel to their new value, so a
 * beat that moves the number is something the viewer watches happen rather
 * than a screen that quietly changed between cuts.
 *
 * Owner's painful-detail law for this story: the point is not that a message
 * was sent, it is that the club can see WHO has it. So the outstanding family
 * is named, with the nudge next to the name.
 */
export function MockReadMeter({
  read,
  total,
  readers,
  outstanding,
  remindId,
}: {
  read: number
  total: number
  /** Names in the order they opened it. Mugs appear as the count climbs. */
  readers: string[]
  /** Everyone who still has not opened it. */
  outstanding: string[]
  remindId?: string
}) {
  const pct = total > 0 ? Math.round((read / total) * 100) : 0
  const done = read >= total
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-end justify-between gap-3">
        <p className="text-ink-900 text-[26px] font-bold leading-none tracking-tight">
          <MockCounter value={read} /> <span className="text-ink-400 text-[16px]">of {total}</span>
        </p>
        <MockPill tone={done ? "court" : "gold"}>
          {done ? "Everyone has it" : `${pct}% opened`}
        </MockPill>
      </div>
      <p className="text-ink-500 mt-1 text-[11.5px] font-medium">
        Families who have opened it
      </p>

      <div className="bg-ink-100 mt-2.5 h-2 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
            done ? "bg-court-500" : "bg-court-400"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {readers.slice(0, read).map((name, i) => (
          <span key={name} className={cn("live-row-in", i > 0 && "-ml-2")}>
            <PlayerMug
              name={name}
              accentKey={name}
              sizeClassName="h-[26px] w-[26px] rounded-full ring-2 ring-white"
            />
          </span>
        ))}
        {read === 0 && (
          <span className="text-ink-400 text-[11.5px]">Nobody has opened it yet.</span>
        )}
      </div>

      {outstanding.length > 0 && (
        <div className="border-ink-100 mt-3 border-t pt-2.5">
          <p className="text-ink-500 text-[10px] font-bold uppercase tracking-[0.12em]">
            Still to open
          </p>
          {outstanding.map((name) => (
            <div key={name} className="mt-1.5 flex items-center gap-2">
              <PlayerMug
                name={name}
                accentKey={name}
                sizeClassName="h-[24px] w-[24px] rounded-full"
              />
              <span className="text-ink-800 min-w-0 flex-1 truncate text-[12px] font-semibold">
                {name}
              </span>
              <MockButton id={remindId} size="sm" tone="quiet">
                Remind
              </MockButton>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export interface MockPollOption {
  id: string
  label: string
  count: number
  /** Your own pick, marked the way the real card marks it. */
  mine?: boolean
  /** Staff see who chose what. Nobody else does. */
  voters?: string[]
}

/** The poll result block, bars sized against the leading option. */
export function MockPollResults({
  prompt,
  options,
  voterCount,
  staff,
  closed,
  idPrefix,
}: {
  prompt: string
  options: MockPollOption[]
  voterCount: number
  /** Show the voter names line, which only staff get. */
  staff?: boolean
  closed?: boolean
  /** Each option becomes `<idPrefix>-<id>` so a beat can vote by name. */
  idPrefix?: string
}) {
  const max = Math.max(1, ...options.map((o) => o.count))
  const lead = Math.max(...options.map((o) => o.count))
  return (
    <div>
      {/* A single-question poll carries its ask in the card title, so repeating
          it here would just print the same sentence twice. */}
      <div className="flex items-baseline justify-between gap-2">
        {prompt ? (
          <p className="text-ink-800 text-[13px] font-semibold">{prompt}</p>
        ) : (
          <span />
        )}
        <p className="text-ink-400 shrink-0 text-[11px]">Pick one · {voterCount} voted</p>
      </div>
      <div className="mt-2 space-y-1.5">
        {options.map((o) => {
          const share = voterCount > 0 ? Math.round((o.count / voterCount) * 100) : 0
          const winning = closed && o.count === lead && lead > 0
          return (
            <span
              key={o.id}
              data-demo-target={idPrefix ? `${idPrefix}-${o.id}` : undefined}
              className={cn(
                "relative block w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-[12.5px] transition-all duration-200 motion-reduce:transition-none",
                o.mine
                  ? "border-play-400 ring-play-200 ring-1"
                  : winning
                    ? "border-gold-300"
                    : "border-ink-100",
                "data-[demo-hover=true]:border-ink-300",
                "data-[demo-press=true]:scale-[0.99]"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-700 ease-out motion-reduce:transition-none",
                  o.mine ? "bg-play-100" : winning ? "bg-gold-50" : "bg-ink-50"
                )}
                style={{ width: `${(o.count / max) * 100}%` }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="text-ink-800 min-w-0 truncate">
                  {winning && <span className="mr-1">🏆</span>}
                  {o.label}
                  {o.mine && (
                    <span className="text-play-600 ml-1.5 text-[11px] font-semibold">
                      ✓ your pick
                    </span>
                  )}
                </span>
                <span className="text-ink-500 shrink-0 text-[11px] font-semibold tabular-nums">
                  {o.count} · {share}%
                </span>
              </span>
              {staff && o.voters && o.voters.length > 0 && (
                <span className="text-ink-400 relative mt-0.5 block truncate text-[10.5px]">
                  {o.voters.join(", ")}
                </span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ── Phone: the loop as a family sees it ─────────────────────────────────── */

/**
 * The push banner. It sits over whatever the phone is showing, the way a
 * notification does, and it is a pointer target because tapping it is what
 * takes her into the message.
 */
export function PhonePushBanner({
  id,
  app = "SportsHub",
  when = "now",
  title,
  body,
}: {
  id?: string
  app?: string
  when?: string
  title: string
  body: string
}) {
  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 z-40">
      <div
        data-demo-target={id}
        className={cn(
          "demo-toast border-ink-900/5 flex gap-2.5 rounded-2xl border bg-white/95 px-3 py-2.5 shadow-[0_18px_40px_-14px_rgba(15,23,42,0.55)] backdrop-blur transition-all duration-200 motion-reduce:transition-none",
          "data-[demo-hover=true]:shadow-[0_22px_50px_-14px_rgba(15,23,42,0.6)]",
          "data-[demo-press=true]:scale-[0.98]"
        )}
      >
        <span className="bg-court-900 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[10px] font-bold text-white">
          SH
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="text-ink-500 text-[10px] font-bold uppercase tracking-[0.1em]">
              {app}
            </span>
            <span className="text-ink-400 ml-auto text-[10px]">{when}</span>
          </span>
          <span className="text-ink-900 mt-0.5 block truncate text-[12.5px] font-bold">
            {title}
          </span>
          <span className="text-ink-600 mt-0.5 line-clamp-2 block text-[11.5px] leading-snug">
            {body}
          </span>
        </span>
      </div>
    </div>
  )
}

/** The message as a card on the team page: never a list row with an icon. */
export function PhonePostCard({
  club,
  kind,
  title,
  body,
  meta,
  audience,
}: {
  club: string
  kind: string
  title: string
  body: string
  meta: string
  /** Who else got it, which is the answer to "should I forward this?" */
  audience?: string
}) {
  return (
    <article className="border-ink-100 live-row-in overflow-hidden rounded-2xl border bg-white shadow-[0_10px_28px_-18px_rgba(15,23,42,0.6)]">
      <div className="relative overflow-hidden bg-[#0b1628] px-3 py-2.5">
        <CourtBackdropLayer variant="navy" intensity="band" />
        <div className="relative z-10 flex items-center gap-2">
          <Crest name={club} size="xs" surface="dark" />
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-white">{club}</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white ring-1 ring-inset ring-white/25">
            {kind}
          </span>
        </div>
      </div>
      <div className="px-3 py-3">
        <h3 className="text-ink-900 text-[14px] font-bold leading-snug">{title}</h3>
        <p className="text-ink-600 mt-1.5 whitespace-pre-line text-[12px] leading-relaxed">
          {body}
        </p>
        <p className="text-ink-400 mt-2 text-[10.5px]">{meta}</p>
        {audience && (
          <div className="border-ink-100 mt-2 border-t pt-2">
            <MockPill tone="court">{audience}</MockPill>
          </div>
        )}
      </div>
    </article>
  )
}

/** Day separator pill in the thread. */
export function PhoneChatDay({ children }: { children: ReactNode }) {
  return (
    <div className="my-2 text-center">
      <span className="bg-court-50 text-ink-400 rounded-full px-3 py-0.5 text-[10px] font-medium">
        {children}
      </span>
    </div>
  )
}

/** One chat bubble, with the sender header, reactions and the reaction row. */
export function PhoneChatBubble({
  mine,
  author,
  context,
  staff,
  time,
  children,
  reactions,
  reactId,
  showReactRow,
}: {
  mine?: boolean
  author: string
  context?: string
  staff?: boolean
  time: string
  children: ReactNode
  /** Applied reactions under the bubble. */
  reactions?: { emoji: string; count: number; mine?: boolean }[]
  /** Pointer handle on the thumbs up in the reaction row. */
  reactId?: string
  /** The picker the product reveals on hover. */
  showReactRow?: boolean
}) {
  return (
    <div className={cn("live-row-in mb-1.5 flex", mine ? "justify-end" : "justify-start")}>
      <div className="max-w-[86%]">
        <div
          className={cn(
            "rounded-2xl px-3 py-1.5",
            mine ? "bg-play-600 text-white" : "bg-court-50 text-ink-900"
          )}
        >
          {!mine && (
            <div className="mb-0.5 flex items-center gap-1.5">
              <span className="text-ink-800 text-[10.5px] font-semibold">
                {author}
                {context && <span className="text-ink-400 font-normal"> · {context}</span>}
              </span>
              {staff && (
                <span className="bg-play-100 text-play-700 rounded-full px-1.5 py-px text-[9px] font-bold">
                  STAFF
                </span>
              )}
            </div>
          )}
          <p className="whitespace-pre-line break-words text-[12px] leading-snug">{children}</p>
          <p
            className={cn(
              "mt-0.5 text-right text-[9.5px]",
              mine ? "text-white/60" : "text-ink-400"
            )}
          >
            {time}
          </p>
        </div>

        {showReactRow && (
          <div className="border-ink-100 live-pop mt-1 flex w-fit gap-0.5 rounded-full border bg-white px-1.5 py-0.5 shadow-sm">
            {["👍", "❤️", "😂", "🎉", "🔥", "🏀"].map((e) => (
              <span
                key={e}
                data-demo-target={e === "👍" ? reactId : undefined}
                className={cn(
                  "rounded-full px-0.5 text-[13px] transition-transform duration-200 motion-reduce:transition-none",
                  "data-[demo-hover=true]:scale-125",
                  "data-[demo-press=true]:scale-95"
                )}
              >
                {e}
              </span>
            ))}
          </div>
        )}

        {reactions && reactions.length > 0 && (
          <div className="live-pop mt-1 flex flex-wrap gap-1">
            {reactions.map((r) => (
              <span
                key={r.emoji}
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-[10.5px]",
                  r.mine
                    ? "border-play-300 bg-play-50 text-play-700"
                    : "border-ink-200 text-ink-600 bg-white"
                )}
              >
                {r.emoji} {r.count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** "Dana Michaels is typing…", with the dots the recording needs. */
export function PhoneTypingLine({ name }: { name: string }) {
  return (
    <p className="text-ink-400 flex items-center gap-1.5 px-1 pb-1 text-[10.5px] italic">
      {name} is typing
      <span className="flex items-center gap-[3px] not-italic">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="demo-typing-dot bg-ink-400 h-[3px] w-[3px] rounded-full"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
    </p>
  )
}

/** The composer at the bottom of the thread: poll button, input, Send. */
export function PhoneChatComposer({
  inputId,
  sendId,
  children,
}: {
  inputId?: string
  sendId?: string
  /** Normally a TypeText, so the message fills as it is typed. */
  children: ReactNode
}) {
  return (
    <div className="border-ink-100 flex shrink-0 items-center gap-1.5 border-t bg-white px-2 py-2">
      <span className="border-ink-200 text-ink-500 shrink-0 rounded-xl border px-2 py-1.5 text-[13px]">
        📊
      </span>
      <span
        data-demo-target={inputId}
        className={cn(
          "border-ink-200 flex min-h-[32px] min-w-0 flex-1 items-center rounded-xl border px-2.5 py-1.5 text-[12px] transition-all duration-200 motion-reduce:transition-none",
          "data-[demo-hover=true]:border-play-400 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
        )}
      >
        {children}
      </span>
      <span
        data-demo-target={sendId}
        className={cn(
          "bg-play-600 shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white transition-all duration-200 motion-reduce:transition-none",
          "data-[demo-hover=true]:brightness-110 data-[demo-hover=true]:shadow-md",
          "data-[demo-press=true]:scale-[0.96] data-[demo-press=true]:brightness-95"
        )}
      >
        Send
      </span>
    </div>
  )
}

/** The poll as it lands in the thread: tappable bars, trophy on the leader. */
export function PhonePollBubble({
  question,
  options,
  voterCount,
  voted,
  closed,
  idPrefix,
}: {
  question: string
  options: MockPollOption[]
  voterCount: number
  /** Before the first vote the bars are hidden, the way the product hides them. */
  voted?: boolean
  closed?: boolean
  idPrefix: string
}) {
  const max = Math.max(1, ...options.map((o) => o.count))
  const lead = Math.max(...options.map((o) => o.count))
  return (
    <div className="live-row-in mb-1.5 flex justify-start">
      <div className="border-ink-100 w-full rounded-2xl border bg-white px-3 py-2.5 shadow-sm">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="bg-play-100 text-play-700 flex h-5 w-5 items-center justify-center rounded-md text-[10px]">
            📊
          </span>
          <span className="text-ink-900 min-w-0 flex-1 text-[12.5px] font-extrabold leading-snug">
            {question}
          </span>
          {closed && (
            <span className="bg-ink-200 text-ink-600 shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wide">
              Closed
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {options.map((o) => {
            const share = voterCount > 0 ? Math.round((o.count / voterCount) * 100) : 0
            const winning = closed && o.count === lead && lead > 0
            return (
              <span
                key={o.id}
                data-demo-target={`${idPrefix}-${o.id}`}
                className={cn(
                  "relative block overflow-hidden rounded-xl border-[1.5px] px-2.5 py-1.5 text-[12px] transition-all duration-200 motion-reduce:transition-none",
                  o.mine ? "border-play-500" : winning ? "border-gold-400" : "border-ink-200",
                  "data-[demo-hover=true]:border-play-300",
                  "data-[demo-press=true]:scale-[0.98]"
                )}
              >
                {voted && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-0 left-0 transition-[width] duration-700 ease-out motion-reduce:transition-none",
                      o.mine ? "bg-play-50" : winning ? "bg-gold-50" : "bg-ink-100/70"
                    )}
                    style={{ width: `${(o.count / max) * 100}%` }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  {o.mine && (
                    <span className="bg-play-600 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-black text-white">
                      ✓
                    </span>
                  )}
                  {winning && !o.mine && <span className="shrink-0">🏆</span>}
                  <span className="text-ink-900 min-w-0 flex-1 truncate font-semibold">
                    {o.label}
                  </span>
                  {voted && (
                    <span className="text-ink-700 shrink-0 text-[11.5px] font-extrabold tabular-nums">
                      {o.count} · {share}%
                    </span>
                  )}
                </span>
              </span>
            )
          })}
        </div>
        <p className="text-ink-500 mt-1.5 text-[10.5px]">
          {voterCount} {voterCount === 1 ? "vote" : "votes"}
          {closed ? " · closed" : " · tap to vote"}
        </p>
      </div>
    </div>
  )
}

/** The pinned strip the team chat keeps at the top of the thread. */
export function PhonePinnedStrip({ author, children }: { author: string; children: ReactNode }) {
  return (
    <div className="border-gold-100 bg-gold-50 live-row-in flex items-start gap-1.5 rounded-xl border px-2.5 py-1.5">
      <span className="text-gold-600 mt-px text-[10px]">📌</span>
      <p className="text-ink-800 min-w-0 flex-1 text-[11px] leading-snug">
        <span className="font-semibold">{author}:</span> {children}
      </p>
    </div>
  )
}

/* ── Season planning kit (story 3) ───────────────────────────────────────── *
 *
 * Every piece below stands in for a surface that ships today, named where the
 * mirror is not obvious:
 *   · MockStepRail — plan/page.tsx STEPS: teams, your buildings, your
 *     calendar, publish, schedule, each with the hint the rail really carries.
 *   · MockStepper and the grade row chips — plan/teams-step.tsx: the
 *     "Grade | Expected teams" table, the minus / count / plus control, and
 *     "In this plan", "N registered", "N games".
 *   · MockWeekendRow and MockGymCard — plan/gyms-weekends-step.tsx: "When
 *     would you like to run sessions?" with its "N of M weekends on" counter,
 *     the "Home gym" and "In the pool" role chips, courts and hours.
 *   · MockFraction — plan-shared.ts Fraction and its three-tone law: fits is
 *     court, tight is gold, over is hoop, and the number is always written
 *     out so colour never carries the fact on its own.
 *   · MockAskSheet — plan-ui.tsx AskSheet: the "What you need to book"
 *     trigger, the season line "N court-days · N court-hours · N games with
 *     no building yet", the "Month by month" rows, and the weekend chips
 *     whose words are "needs a building", "assumed, not booked yet", or
 *     silence for a booking that is confirmed.
 *   · MockFinding — lib/scheduler-v2/audit.ts, finding code
 *     "grade-does-not-fit": the arithmetic inside the sentence, then the
 *     three options the auditor offers under it.
 *   · MockEntryRow — manage/components/clubs-tab.tsx: "Club entries (N)",
 *     "planned N teams · submitted N · signed by X", and "Approve entry".
 *   · MockJourney — manage/components/plan-door.tsx STAGES.
 *   · MockGamesTable — manage/components/schedule-tab.tsx: the gold "Draft"
 *     badge every game wears until Game.publishedAt is stamped.
 */

/**
 * The wizard rail. Five steps, always visible and always clickable, which is
 * also why the demo walks the wizard by pressing it: the rail is the one
 * control that survives every screen change, so the pointer always presses
 * something that is still there when it lands.
 */
export function MockStepRail({
  step,
  steps,
  idPrefix,
}: {
  step: number
  steps: { label: string; hint: string }[]
  /** Each step becomes `<idPrefix>-<n>` so a beat can walk by name. */
  idPrefix?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => {
        const n = i + 1
        const active = n === step
        const done = n < step
        return (
          <span
            key={s.label}
            data-demo-target={idPrefix ? `${idPrefix}-${n}` : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all duration-300 motion-reduce:transition-none",
              "data-[demo-hover=true]:border-play-400 data-[demo-hover=true]:shadow-sm",
              "data-[demo-press=true]:scale-[0.96]",
              active
                ? "border-court-700 bg-court-600 text-white"
                : done
                  ? "border-court-200 bg-court-50 text-court-800"
                  : "border-ink-200 text-ink-500 bg-white"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold tabular-nums",
                active
                  ? "bg-white/25 text-white"
                  : done
                    ? "bg-court-100 text-court-700"
                    : "bg-ink-100 text-ink-500"
              )}
            >
              {done ? "✓" : n}
            </span>
            {s.label}
            <span className={cn("font-medium", active ? "text-white/70" : "text-ink-400")}>
              {s.hint}
            </span>
          </span>
        )
      })}
    </div>
  )
}

/** The minus / count / plus control every grade estimate is typed into. */
export function MockStepper({ id, value }: { id?: string; value: number }) {
  return (
    <span className="border-ink-300 inline-flex h-8 items-center rounded-lg border bg-white shadow-sm">
      <span className="text-ink-500 w-7 text-center text-[14px] font-bold">−</span>
      <span className="text-ink-900 min-w-[30px] text-center text-[13px] font-bold tabular-nums">
        <MockCounter value={value} duration={420} />
      </span>
      <span
        data-demo-target={id}
        className={cn(
          "text-ink-700 w-7 rounded-r-lg text-center text-[14px] font-bold transition-all duration-200 motion-reduce:transition-none",
          "data-[demo-hover=true]:bg-play-50 data-[demo-hover=true]:text-play-700",
          "data-[demo-press=true]:bg-play-100 data-[demo-press=true]:scale-95"
        )}
      >
        +
      </span>
    </span>
  )
}

export type FractionTone = "fits" | "tight" | "over" | "quiet"

/** "18/12 games", with the overage written out beside it. */
export function MockFraction({
  is,
  of,
  unit,
  tone = "fits",
}: {
  is: number
  of: number
  unit: string
  tone?: FractionTone
}) {
  const tones: Record<FractionTone, string> = {
    fits: "border-court-200 bg-court-50 text-court-800",
    tight: "border-gold-400 bg-gold-50 text-gold-600",
    over: "border-hoop-300 bg-hoop-50 text-hoop-800",
    quiet: "border-ink-200 bg-ink-50 text-ink-500",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-[1.5px] text-[11px] font-bold tabular-nums",
        tones[tone]
      )}
    >
      {is}/{of} {unit}
      {is > of && <span className="font-extrabold">▲{is - of}</span>}
    </span>
  )
}

/** One building, the way step 2 lists it. */
export function MockGymCard({
  id,
  name,
  city,
  home,
  courts,
  hours,
  note,
  fresh,
}: {
  id?: string
  name: string
  city: string
  home?: boolean
  courts: string
  hours: string
  note?: string
  fresh?: boolean
}) {
  return (
    <div
      data-demo-target={id}
      className={cn(
        "border-ink-300 rounded-2xl border bg-white px-3 py-2.5 shadow-sm transition-all duration-200 motion-reduce:transition-none",
        fresh && "live-row-in",
        "data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-ink-900 text-[13.5px] font-bold">
          {name} · {city}
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10.5px] font-bold",
            home
              ? "border-court-200 bg-court-50 text-court-800"
              : "border-ink-200 bg-ink-50 text-ink-500"
          )}
        >
          {home ? "Home gym" : "In the pool"}
        </span>
      </div>
      <p className="text-ink-600 mt-1 text-[11.5px] font-semibold tabular-nums">
        {courts} · {hours}
      </p>
      {note && <p className="text-ink-400 mt-0.5 text-[11px]">{note}</p>}
    </div>
  )
}

/** The weekend row: which dates this season plays on, and how many are on. */
export function MockWeekendRow({
  idPrefix,
  weekends,
  on,
}: {
  idPrefix: string
  weekends: { key: string; label: string; on: boolean }[]
  /** The counter line under the row, already counted by the caller. */
  on: number
}) {
  return (
    <div>
      <p className="text-ink-800 text-[12.5px] font-bold">
        When would you like to run sessions?
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {weekends.map((w) => (
          <span
            key={w.key}
            data-demo-target={`${idPrefix}-${w.key}`}
            className={cn(
              "rounded-lg border px-2 py-1 text-[11px] font-bold tabular-nums transition-all duration-200 motion-reduce:transition-none",
              w.on
                ? "border-court-300 bg-court-50 text-court-800"
                : "border-ink-200 text-ink-400 bg-white",
              "data-[demo-hover=true]:border-play-300",
              "data-[demo-press=true]:scale-[0.94]"
            )}
          >
            {w.label}
          </span>
        ))}
      </div>
      <p className="text-ink-500 mt-1.5 text-[11px] font-semibold">
        <MockCounter value={on} duration={420} /> of {weekends.length} weekends on. The draw fills
        these first.
      </p>
    </div>
  )
}

/** One weekend on the calendar board: what it holds and whether it fits. */
export function MockWeekendCard({
  date,
  gym,
  grades,
  is,
  of,
  tone,
  fresh,
  delay = 0,
}: {
  date: string
  gym: string
  grades: string[]
  is: number
  of: number
  tone: FractionTone
  fresh?: boolean
  delay?: number
}) {
  const border: Record<FractionTone, string> = {
    fits: "border-ink-200",
    tight: "border-gold-400 bg-gold-50/40",
    over: "border-hoop-300 bg-hoop-50/50",
    quiet: "border-ink-200",
  }
  return (
    <div
      className={cn(
        "rounded-xl border bg-white px-2.5 py-2",
        border[tone],
        fresh && "live-row-in"
      )}
      style={fresh ? { animationDelay: `${delay}ms` } : undefined}
    >
      <p className="text-ink-900 text-[11.5px] font-bold tabular-nums">{date}</p>
      <p className="text-ink-400 truncate text-[10.5px]">{gym}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {grades.map((g) => (
          <span
            key={g}
            className="bg-court-50 text-court-800 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold"
          >
            {g}
          </span>
        ))}
      </div>
      <div className="mt-1.5">
        <MockFraction is={is} of={of} unit="games" tone={tone} />
      </div>
    </div>
  )
}

/**
 * The ask, as the sheet somebody reads down the phone to a gym.
 *
 * The headline is the one sentence the product does not print today: the ask
 * sheet gives the season in court-days and court-hours and leaves the operator
 * to subtract what the buildings hold. This demo does the subtraction on
 * camera, because that number is the whole reason a league plans before a
 * single team has registered.
 */
export function MockAskSheet({
  toggleId,
  open,
  season,
  headline,
  supply,
  months,
}: {
  toggleId?: string
  open?: boolean
  /** "31.5 court-days · 315 court-hours · 20 games with no building yet" */
  season: string
  headline?: string
  /** The two lines the headline subtracts, written out. */
  supply?: { label: string; value: string }[]
  months: { label: string; courtDays: string; courtHours: string; weekends: string }[]
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <MockButton id={toggleId} tone="quiet" size="sm">
          What you need to book
        </MockButton>
        <span className="text-ink-500 text-[11.5px] font-semibold tabular-nums">{season}</span>
      </div>

      {/* The sheet is laid out for a narrow column, because it sits beside the
          board it is about and the frame never scrolls: every line is one
          line, and nothing here reflows when the numbers change. */}
      {open && (
        <div className="border-ink-100 bg-ink-50/60 live-pop mt-2 rounded-xl border p-2.5">
          {headline && (
            <div className="border-hoop-200 bg-hoop-50 rounded-xl border px-3 py-1.5">
              <p className="text-hoop-800 text-[16px] font-extrabold leading-tight">{headline}</p>
              {supply && (
                <p className="border-hoop-200/70 text-hoop-800/80 mt-1.5 border-t pt-1.5 text-[11px] font-semibold">
                  {supply.map((s, i) => (
                    <span key={s.label}>
                      {i > 0 && " · "}
                      {s.label} <span className="font-extrabold tabular-nums">{s.value}</span>
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}

          <p className="text-ink-400 mt-2 text-[10.5px] font-bold uppercase tracking-[0.08em]">
            Month by month
          </p>
          <div className="mt-1 space-y-1">
            {months.map((m) => (
              <div
                key={m.label}
                className="border-ink-100 flex items-baseline gap-2 rounded-lg border bg-white px-2.5 py-[3px]"
              >
                <span className="text-ink-900 whitespace-nowrap text-[12px] font-bold">
                  {m.label}
                </span>
                <span className="text-ink-600 whitespace-nowrap text-[11px] font-semibold tabular-nums">
                  {m.courtDays} court-days · {m.courtHours} court-hours
                </span>
                <span className="text-ink-400 ml-auto whitespace-nowrap text-[10.5px]">
                  {m.weekends}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The weekend-by-weekend half of the ask: where every rental stands. It rides
 * under the board rather than inside the sheet, because these chips are about
 * the weekends the board is showing and the frame has the room there.
 */
export function MockBlockChips({
  blocks,
}: {
  blocks: { key: string; weekend: string; gym: string; status: "needed" | "assumed" | "confirmed" }[]
}) {
  const words = {
    needed: "needs a building",
    assumed: "assumed, not booked yet",
    confirmed: "",
  }
  const tones = {
    needed: "border-hoop-300 bg-hoop-50 text-hoop-800",
    assumed: "border-gold-400 bg-gold-50 text-gold-600",
    confirmed: "border-court-200 bg-court-50 text-court-800",
  }
  return (
    <div className="live-pop">
      <p className="text-ink-400 text-[10.5px] font-bold uppercase tracking-[0.08em]">
        Weekend by weekend
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {blocks.map((b) => (
          <span
            key={b.key}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-[1px] text-[10.5px] font-bold",
              tones[b.status]
            )}
          >
            <span className="tabular-nums">{b.weekend}</span>
            <span className="font-semibold opacity-80">
              {[b.gym, words[b.status]].filter(Boolean).join(" · ")}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * A feasibility finding, the way the auditor writes one: the arithmetic in
 * the sentence, then the options, each one a thing you can actually go and do.
 */
export function MockFinding({
  severity,
  title,
  message,
  options,
  optionId,
}: {
  severity: "block" | "clear"
  title: string
  message?: string
  options?: string[]
  /** The first option is pressable, because pressing it is the fix. */
  optionId?: string
}) {
  const block = severity === "block"
  return (
    <div
      className={cn(
        "live-pop rounded-2xl border px-4 py-3",
        block ? "border-hoop-300 bg-hoop-50" : "border-court-200 bg-court-50"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white",
            block ? "bg-hoop-600" : "bg-court-600"
          )}
        >
          {block ? "!" : "✓"}
        </span>
        <p
          className={cn(
            "text-[13.5px] font-extrabold",
            block ? "text-hoop-900" : "text-court-900"
          )}
        >
          {title}
        </p>
      </div>
      {message && (
        <p
          className={cn(
            "mt-1.5 text-[12.5px] leading-relaxed",
            block ? "text-hoop-900/85" : "text-court-900/85"
          )}
        >
          {message}
        </p>
      )}
      {options && options.length > 0 && (
        <div className="mt-2 space-y-1">
          {options.map((o, i) => (
            <span
              key={o}
              data-demo-target={i === 0 ? optionId : undefined}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-200 motion-reduce:transition-none",
                i === 0
                  ? "border-hoop-300 text-hoop-900 bg-white"
                  : "border-hoop-200/70 text-hoop-800/80 bg-white/60",
                "data-[demo-hover=true]:border-play-400 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2",
                "data-[demo-press=true]:scale-[0.99]"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  i === 0 ? "bg-hoop-500" : "bg-hoop-300"
                )}
              />
              {o}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Plan, divisions, generate, publish: where this season is on the road. */
export function MockJourney({ stages, at }: { stages: string[]; at: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {stages.map((s, i) => (
        <span
          key={s}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors duration-300 motion-reduce:transition-none",
            i === at
              ? "bg-play-600 text-white"
              : i < at
                ? "bg-court-50 text-court-800"
                : "bg-ink-50 text-ink-400"
          )}
        >
          {i < at ? `✓ ${s}` : s}
        </span>
      ))}
    </div>
  )
}

/** A checkbox row, the shape the product's own BrandCheckbox draws. */
export function MockCheck({
  id,
  checked,
  label,
  meta,
}: {
  id?: string
  checked: boolean
  label: string
  meta?: string
}) {
  return (
    <span
      data-demo-target={id}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all duration-200 motion-reduce:transition-none",
        checked ? "border-play-300 bg-play-50/60" : "border-ink-200 bg-white",
        "data-[demo-hover=true]:border-play-400",
        "data-[demo-press=true]:scale-[0.99]"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2",
          checked ? "border-play-600 bg-play-600" : "border-ink-300 bg-white"
        )}
      >
        {checked && (
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="h-2.5 w-2.5">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className="text-ink-900 min-w-0 flex-1 truncate text-[12.5px] font-semibold">
        {label}
      </span>
      {meta && <span className="text-ink-400 shrink-0 text-[11px]">{meta}</span>}
    </span>
  )
}

/** One club's entry in the league's queue. */
export function MockEntryRow({
  club,
  meta,
  status,
  approveId,
  fresh,
}: {
  club: string
  /** "planned 4 teams · submitted 4 · signed by Dana Michaels" */
  meta: string
  status: "submitted" | "approved" | "waiting"
  approveId?: string
  fresh?: boolean
}) {
  return (
    <div
      className={cn(
        "border-ink-50 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-2 last:border-b-0",
        fresh && "live-row-in"
      )}
    >
      <Crest name={club} size="xs" />
      <span className="min-w-0">
        <span className="text-ink-900 text-[12.5px] font-bold">{club}</span>
        <span className="text-ink-500 ml-2 text-[11px]">{meta}</span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <MockPill
          tone={status === "approved" ? "court" : status === "submitted" ? "play" : "neutral"}
        >
          {status === "waiting" ? "not entered" : status}
        </MockPill>
        {status === "submitted" && (
          <MockButton id={approveId} tone="court" size="sm">
            Approve entry
          </MockButton>
        )}
      </span>
    </div>
  )
}

export interface MockGame {
  when: string
  division: string
  home: string
  away: string
  venue: string
}

/** The generated schedule, cascading in the way a solved season lands. */
export function MockGamesTable({
  games,
  published,
  cascade,
}: {
  games: MockGame[]
  /** Published games drop the gold Draft badge. */
  published?: boolean
  /** Rows arrive one after another instead of simply being there. */
  cascade?: boolean
}) {
  const head =
    "px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500"
  const cell = "px-3 py-[3px] text-[11.5px] text-ink-600 whitespace-nowrap"
  return (
    <table className="w-full table-fixed">
      <thead className="bg-ink-50">
        <tr>
          <th className={cn(head, "w-[152px]")}>When</th>
          <th className={cn(head, "w-[104px]")}>Division</th>
          <th className={head}>Game</th>
          <th className={cn(head, "w-[164px]")}>Gym</th>
          <th className={cn(head, "w-[84px]")}>Status</th>
        </tr>
      </thead>
      <tbody className="divide-ink-50 divide-y">
        {games.map((g, i) => (
          <tr
            key={`${g.when}-${g.home}`}
            className={cn("bg-white", cascade && "live-row-in")}
            style={cascade ? { animationDelay: `${i * 60}ms` } : undefined}
          >
            <td className={cn(cell, "text-ink-900 font-semibold tabular-nums")}>{g.when}</td>
            <td className={cell}>{g.division}</td>
            <td className={cn(cell, "text-ink-900 truncate")}>
              {g.home} <span className="text-ink-400">vs</span> {g.away}
            </td>
            <td className={cn(cell, "truncate")}>{g.venue}</td>
            <td className="px-3 py-[3px]">
              <MockPill tone={published ? "court" : "gold"}>
                {published ? "Published" : "Draft"}
              </MockPill>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The promises a schedule makes, ticked off one at a time. */
export function MockGuarantees({
  items,
  shown,
}: {
  items: { label: string; value: string }[]
  /** How many rows have landed so far. */
  shown: number
}) {
  return (
    <div className="space-y-1.5 px-4 py-3">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-all duration-300 motion-reduce:transition-none",
            i < shown
              ? "border-court-200 bg-court-50 live-row-in opacity-100"
              : "border-ink-100 bg-white opacity-40"
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white",
              i < shown ? "bg-court-600" : "bg-ink-200"
            )}
          >
            ✓
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 text-[12px] font-semibold",
              i < shown ? "text-court-900" : "text-ink-400"
            )}
          >
            {it.label}
          </span>
          <span
            className={cn(
              "shrink-0 text-[12px] font-extrabold tabular-nums",
              i < shown ? "text-court-800" : "text-ink-300"
            )}
          >
            {it.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Phone: the season as a family gets it ───────────────────────────────── */

/** The month grid, filling with game days as the schedule publishes. */
export function PhoneMonthGrid({
  month,
  days,
  filled,
}: {
  month: string
  /** 1-based day numbers that carry a game. */
  days: number[]
  /** Nothing is on the calendar until the season publishes. */
  filled: boolean
}) {
  const first = 0 // November 2026 starts on a Sunday, so the grid is square.
  const cells = Array.from({ length: 35 }, (_, i) => i - first + 1)
  return (
    <div className="border-ink-100 rounded-2xl border bg-white px-2.5 py-2.5">
      <p className="text-ink-900 text-[12px] font-bold">{month}</p>
      <div className="text-ink-400 mt-1.5 grid grid-cols-7 gap-y-1 text-center text-[9px] font-bold">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-x-0.5 gap-y-0.5">
        {cells.map((n, i) => {
          const has = filled && n > 0 && n <= 30 && days.includes(n)
          return (
            <span
              key={i}
              className={cn(
                "flex h-[26px] flex-col items-center justify-center rounded-md text-[10px] font-semibold tabular-nums",
                n <= 0 || n > 30
                  ? "text-transparent"
                  : has
                    ? "bg-court-50 text-court-900 live-row-in"
                    : "text-ink-500"
              )}
              style={has ? { animationDelay: `${days.indexOf(n) * 70}ms` } : undefined}
            >
              {n > 0 && n <= 30 ? n : "."}
              <span
                className={cn(
                  "mt-[1px] h-[3px] w-[3px] rounded-full",
                  has ? "bg-court-600" : "bg-transparent"
                )}
              />
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** One game on the family's calendar. */
export function PhoneGameRow({
  day,
  title,
  meta,
  fresh,
  delay = 0,
}: {
  day: string
  title: string
  meta: string
  fresh?: boolean
  delay?: number
}) {
  return (
    <div
      className={cn(
        "border-ink-100 flex items-center gap-2.5 rounded-xl border bg-white px-2.5 py-1.5",
        fresh && "live-row-in"
      )}
      style={fresh ? { animationDelay: `${delay}ms` } : undefined}
    >
      <span className="bg-court-50 text-court-700 flex h-7 w-8 shrink-0 flex-col items-center justify-center rounded-lg text-[9px] font-bold uppercase leading-none">
        {day}
      </span>
      <div className="min-w-0">
        <p className="text-ink-900 truncate text-[11.5px] font-semibold">{title}</p>
        <p className="text-ink-400 truncate text-[10px]">{meta}</p>
      </div>
    </div>
  )
}

/* ── End card ────────────────────────────────────────────────────────────── */

/** The last frame: what was just watched, and the invitation to watch more. */
export function MockEndCard({
  eyebrow,
  title,
  line,
  next,
}: {
  eyebrow: string
  title: string
  line: string
  next: string
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-[#0b1628]">
      <CourtBackdropLayer variant="navy" intensity="immersive" />
      <span
        aria-hidden="true"
        className="border-gold-400/25 pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full border-[10px]"
      />
      <div className="live-pop relative z-10 max-w-[620px] px-10 text-center">
        <p className="text-gold-400 text-[11px] font-bold uppercase tracking-[0.2em]">{eyebrow}</p>
        <h2 className="font-display mt-2 text-[38px] font-extrabold leading-[1.05] tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-white/65">{line}</p>
        <span className="bg-gold-400 mt-6 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[13px] font-bold text-[#0b1628]">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          Watch the next: {next}
        </span>
      </div>
    </div>
  )
}
