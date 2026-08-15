"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Crest } from "@/components/ui/crest"
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
}: {
  label: string
  value: string
  tone?: "neutral" | "court" | "hoop" | "play"
}) {
  const tones: Record<string, string> = {
    neutral: "border-ink-100 bg-white",
    court: "border-court-100 bg-court-50/70",
    hoop: "border-hoop-100 bg-hoop-50/70",
    play: "border-play-100 bg-play-50/70",
  }
  return (
    <div className={cn("rounded-2xl border px-4 py-3", tones[tone])}>
      <p className="text-ink-500 text-[11px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </p>
      <p className="text-ink-900 mt-1 text-2xl font-bold tabular-nums">{value}</p>
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
