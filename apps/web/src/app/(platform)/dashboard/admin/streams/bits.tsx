"use client"

import { useEffect, useId, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

/**
 * The small shared pieces of the Streams console: relative time, the copy
 * buttons for the ingest pair, the labelled text field, and the modal shell.
 *
 * They live together because each one is used by two or more of the console's
 * files and none of them is general enough to belong in components/ui yet. If
 * a third console needs the copy button, that is the moment to promote it.
 */

/* ── time ────────────────────────────────────────────────────────────────── */

/** "just now", "40 seconds ago", "6 minutes ago", "yesterday". */
export function agoLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "never"
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return "never"
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000)
  if (seconds < 5) return "just now"
  if (seconds < 60) return `${seconds} seconds ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return "yesterday"
  return `${days} days ago`
}

/** "6:30 PM" for today, "Sat 6:30 PM" for anything further out. */
export function gameTimeLabel(iso: string, now: Date = new Date()): string {
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return ""
  const time = when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  const sameDay = when.toDateString() === now.toDateString()
  if (sameDay) return time
  return `${when.toLocaleDateString(undefined, { weekday: "short" })} ${time}`
}

/* ── icons (inline SVG, never emoji) ─────────────────────────────────────── */

export function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function EyeIcon({ off = false }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.8" />
      {off && <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  )
}

export function SignalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="2.25" fill="currentColor" />
      <path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

/* ── strips ──────────────────────────────────────────────────────────────── */

export function NoticeStrip({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="border-court-100 bg-court-50 text-court-800 mb-3 rounded-xl border px-3 py-2 text-sm leading-6"
    >
      {children}
    </div>
  )
}

export function ErrorStrip({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-800"
    >
      {children}
    </div>
  )
}

/* ── copy ────────────────────────────────────────────────────────────────── */

/**
 * A value with a copy button, and — for the stream key — a reveal toggle.
 *
 * Masked by default. This console is the ONE surface where the ingest pair is
 * served (api/admin/streams/channels says so in its header), because an
 * operator setting up a rig has to read them out. That is not a reason to have
 * a stream key sitting in plain sight on a shared office screen, so the key
 * arrives hidden and a person has to ask for it.
 *
 * Copy never fails silently: a browser that refuses the clipboard says so and
 * leaves the value selectable instead.
 */
export function CopyField({
  label,
  value,
  secret = false,
  hint,
}: {
  label: string
  value: string
  /** Mask the value until the reader presses Show. */
  secret?: boolean
  hint?: string
}) {
  const [revealed, setRevealed] = useState(!secret)
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle")
  const fieldId = useId()

  useEffect(() => {
    if (state === "idle") return
    const timer = setTimeout(() => setState("idle"), 2200)
    return () => clearTimeout(timer)
  }, [state])

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard")
      await navigator.clipboard.writeText(value)
      setState("copied")
    } catch {
      setState("failed")
    }
  }

  const shown = revealed ? value : `${"•".repeat(Math.min(24, Math.max(8, value.length - 4)))}${value.slice(-4)}`

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={fieldId} className="text-ink-500 text-[11px] font-semibold uppercase tracking-[0.14em]">
          {label}
        </label>
        <div className="flex items-center gap-1">
          {secret && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="text-ink-500 hover:text-ink-800 hover:bg-ink-100 flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold transition [&>svg]:h-3.5 [&>svg]:w-3.5"
            >
              <EyeIcon off={revealed} />
              {revealed ? "Hide" : "Show"}
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy ${label}`}
            className={`flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold transition [&>svg]:h-3.5 [&>svg]:w-3.5 ${
              state === "copied"
                ? "text-court-700 bg-court-50"
                : state === "failed"
                  ? "bg-red-50 text-red-700"
                  : "text-ink-500 hover:text-ink-800 hover:bg-ink-100"
            }`}
          >
            {state === "copied" ? <CheckIcon /> : <CopyIcon />}
            {state === "copied" ? "Copied" : state === "failed" ? "Select it instead" : "Copy"}
          </button>
        </div>
      </div>
      <output
        id={fieldId}
        className="border-ink-200 bg-ink-50 text-ink-800 mt-1 block w-full select-all truncate rounded-lg border px-2.5 py-1.5 font-mono text-xs"
        title={revealed ? value : undefined}
      >
        {shown}
      </output>
      {hint && <p className="text-ink-500 mt-1 text-[11px] leading-4">{hint}</p>}
    </div>
  )
}

/* ── form field ──────────────────────────────────────────────────────────── */

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  required,
  multiline,
  autoFocus,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  error?: string | null
  required?: boolean
  multiline?: boolean
  autoFocus?: boolean
  className?: string
}) {
  const fieldId = useId()
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
  const base =
    "mt-1 w-full rounded-lg border px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition focus:outline-none focus:ring-2 focus:ring-play-200"

  return (
    <div className={className}>
      <label htmlFor={fieldId} className="text-ink-700 text-xs font-semibold">
        {label}
        {required && <span className="text-hoop-600"> *</span>}
      </label>
      {multiline ? (
        <textarea
          id={fieldId}
          value={value}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className={`${base} ${error ? "border-red-300" : "border-ink-200"}`}
        />
      ) : (
        <input
          id={fieldId}
          type="text"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className={`${base} ${error ? "border-red-300" : "border-ink-200"}`}
        />
      )}
      {error ? (
        <p id={`${fieldId}-error`} className="mt-1 text-[11px] leading-4 text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-ink-500 mt-1 text-[11px] leading-4">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/* ── modal ───────────────────────────────────────────────────────────────── */

/**
 * The console's dialog shell, following the club review console's quick-view:
 * portalled to the body, click-outside and Escape close, one scrolling body.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = "max-w-lg",
}: {
  title: string
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (typeof document === "undefined") return null

  return createPortal(
    <div
      className="bg-ink-950/40 fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`border-ink-100 shadow-soft w-full ${width} rounded-2xl border bg-white`}>
        <div className="border-ink-100 bg-ink-50/60 flex items-start justify-between gap-3 rounded-t-2xl border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-ink-950 text-lg font-semibold">{title}</h2>
            {subtitle && <div className="text-ink-600 mt-0.5 text-xs leading-5">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-400 hover:text-ink-700 -mr-1 -mt-1 cursor-pointer rounded-lg p-1.5 transition"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-ink-100 bg-ink-50/40 flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
