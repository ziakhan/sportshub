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
