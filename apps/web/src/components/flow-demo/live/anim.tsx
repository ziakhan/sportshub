"use client"

/**
 * Animated form primitives for the live demo. Same look as the still
 * primitives in scenes/shared.tsx, but driven by scene state: inputs type
 * with a caret, selects open a real dropdown and pick, checks tick in.
 */

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"

const inputCls =
  "border-ink-200 flex min-h-[42px] w-full items-center rounded-lg border bg-white px-3 py-2 text-sm"

export function LiveInput({
  id,
  value,
  caret,
  placeholder,
  big,
}: {
  id?: string
  value?: string
  caret?: boolean
  placeholder?: string
  big?: boolean
}) {
  return (
    <div data-live-id={id} className={cn(inputCls, big && "justify-center font-mono text-lg tracking-[0.35em]")}>
      {value ? (
        <span className={cn("text-ink-900", caret && "live-caret")}>{value}</span>
      ) : (
        <span className={cn("text-ink-400", caret && "live-caret")}>{placeholder}</span>
      )}
    </div>
  )
}

export function LiveSelect({
  id,
  value,
  placeholder,
  open,
  options,
  highlight,
}: {
  id?: string
  value?: string
  placeholder?: string
  open?: boolean
  options: string[]
  highlight?: number
}) {
  return (
    <div className="relative" data-live-id={id}>
      <div className={cn(inputCls, "justify-between gap-2", open && "border-play-400")}>
        {value ? <span className="text-ink-900">{value}</span> : <span className="text-ink-400">{placeholder}</span>}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={cn("text-ink-400 h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {open && (
        <div className="border-ink-200 live-pop absolute inset-x-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-lg border bg-white shadow-[0_18px_44px_-18px_rgba(15,23,42,0.4)]">
          {options.map((o, i) => (
            <div
              key={o}
              className={cn(
                "px-3 py-2 text-sm transition-colors",
                i === highlight ? "bg-play-50 text-play-800 font-semibold" : "text-ink-700"
              )}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function LiveCheck({
  id,
  on,
  label,
  sub,
  className,
}: {
  id?: string
  on?: boolean
  label: ReactNode
  sub?: ReactNode
  className?: string
}) {
  return (
    <div data-live-id={id} className={cn("flex items-start gap-2.5", className)}>
      <span
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border",
          on ? "border-play-600 bg-play-600 text-white" : "border-ink-300 bg-white"
        )}
      >
        {on && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className="live-pop h-3 w-3">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className="text-ink-800 text-sm">
        {label}
        {sub && <span className="text-ink-400 block text-xs">{sub}</span>}
      </span>
    </div>
  )
}

export function LiveRadio({
  id,
  on,
  label,
  sub,
  boxed,
}: {
  id?: string
  on?: boolean
  label: ReactNode
  sub?: ReactNode
  boxed?: boolean
}) {
  const row = (
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border",
          on ? "border-play-600" : "border-ink-300"
        )}
      >
        {on && <span className="bg-play-600 live-pop h-2.5 w-2.5 rounded-full" />}
      </span>
      <span className="text-ink-800 text-sm">
        {label}
        {sub && <span className="text-ink-400 block text-xs">{sub}</span>}
      </span>
    </div>
  )
  if (!boxed) return <div data-live-id={id}>{row}</div>
  return (
    <div
      data-live-id={id}
      className={cn("rounded-xl border p-3 transition-colors", on ? "border-play-300 bg-play-50/50" : "border-ink-200")}
    >
      {row}
    </div>
  )
}

/** Green check chip that pops in when `on` flips true. */
export function TickBadge({ on, children }: { on?: boolean; children: ReactNode }) {
  if (!on) return null
  return (
    <span className="bg-court-50 text-court-700 live-pop inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold">
      ✓ {children}
    </span>
  )
}
