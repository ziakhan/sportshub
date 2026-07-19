import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { PanelHeader } from "@/components/ui/panel-header"
import { cn } from "@/components/ui/cn"

/* ────────────────────────────────────────────────────────────────────────
   Static building blocks that mirror the product's form/table look. Scenes
   are stills of the real screens: inputs render their filled values, only
   the one highlighted control is live.
   ──────────────────────────────────────────────────────────────────────── */

/** Desktop operator page shell (the app chrome itself is left out). */
export function OperatorPage({
  back,
  title,
  subtitle,
  actions,
  children,
  narrow,
}: {
  back?: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  narrow?: boolean
}) {
  return (
    <div className="px-10 py-8">
      <div className={cn(narrow && "mx-auto max-w-2xl")}>
        {back && <p className="text-ink-500 mb-3 text-sm font-medium">&larr; {back}</p>}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">
              {title}
            </h1>
            {subtitle && <p className="text-ink-500 mt-1 text-sm">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <PanelHeader title={title} action={action} />
      {children}
    </Card>
  )
}

export function Field({
  label,
  required,
  helper,
  children,
  className,
}: {
  label: ReactNode
  required?: boolean
  helper?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="text-ink-700 mb-1.5 block text-sm font-semibold">
        {label}
        {required && <span className="text-hoop-600"> *</span>}
      </label>
      {children}
      {helper && <p className="text-ink-400 mt-1 text-xs">{helper}</p>}
    </div>
  )
}

const inputCls =
  "border-ink-200 flex min-h-[42px] w-full items-center rounded-lg border bg-white px-3 py-2 text-sm"

/** A filled (or placeholder) text input, rendered as a still. */
export function TxtInput({
  value,
  placeholder,
  suffix,
  mono,
}: {
  value?: string
  placeholder?: string
  suffix?: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(inputCls, mono && "justify-center font-mono text-lg tracking-[0.4em]")}>
        {value ? (
          <span className="text-ink-900">{value}</span>
        ) : (
          <span className="text-ink-400">{placeholder}</span>
        )}
      </div>
      {suffix && <span className="text-ink-500 shrink-0 text-sm">{suffix}</span>}
    </div>
  )
}

export function SelectBox({ value, placeholder }: { value?: string; placeholder?: string }) {
  return (
    <div className={cn(inputCls, "justify-between gap-2")}>
      {value ? <span className="text-ink-900">{value}</span> : <span className="text-ink-400">{placeholder}</span>}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-400 h-4 w-4 shrink-0">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
}

export function AreaBox({ value, placeholder, rows = 3 }: { value?: string; placeholder?: string; rows?: number }) {
  return (
    <div className={cn(inputCls, "items-start")} style={{ minHeight: rows * 22 + 20 }}>
      {value ? (
        <span className="text-ink-900 whitespace-pre-wrap">{value}</span>
      ) : (
        <span className="text-ink-400">{placeholder}</span>
      )}
    </div>
  )
}

export function CheckRow({
  checked,
  label,
  sub,
  className,
}: {
  checked?: boolean
  label: ReactNode
  sub?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <span
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border",
          checked ? "border-play-600 bg-play-600 text-white" : "border-ink-300 bg-white"
        )}
      >
        {checked && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className="h-3 w-3">
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

export function RadioRow({
  checked,
  label,
  sub,
  className,
}: {
  checked?: boolean
  label: ReactNode
  sub?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <span
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border",
          checked ? "border-play-600" : "border-ink-300"
        )}
      >
        {checked && <span className="bg-play-600 h-2.5 w-2.5 rounded-full" />}
      </span>
      <span className="text-ink-800 text-sm">
        {label}
        {sub && <span className="text-ink-400 block text-xs">{sub}</span>}
      </span>
    </div>
  )
}

export function Th({ children, right, center }: { children?: ReactNode; right?: boolean; center?: boolean }) {
  return (
    <th
      className={cn(
        "text-ink-500 px-3 py-2.5 text-left text-[11px] font-extrabold uppercase tracking-[0.12em]",
        right && "text-right",
        center && "text-center"
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  right,
  center,
  className,
}: {
  children?: ReactNode
  right?: boolean
  center?: boolean
  className?: string
}) {
  return (
    <td className={cn("text-ink-800 px-3 py-2.5 text-sm", right && "text-right", center && "text-center", className)}>
      {children}
    </td>
  )
}

/** Green success panel used by the product's "Created!" confirmation screens. */
export function SuccessPanel({
  title,
  children,
  actions,
}: {
  title: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <Card className="py-10 text-center">
      <div className="bg-court-100 text-court-700 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-7 w-7">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-ink-900 text-xl font-bold">{title}</h2>
      <div className="text-ink-600 mx-auto mt-2 max-w-md text-sm leading-relaxed">{children}</div>
      {actions && <div className="mt-6 flex items-center justify-center gap-3">{actions}</div>}
    </Card>
  )
}

/* ── Phone chrome ──────────────────────────────────────────────────────── */

/** Mobile web header inside the phone frame: brand wordmark + menu. */
export function MobileHeader() {
  return (
    <div className="border-ink-100 flex items-center justify-between border-b bg-white px-4 py-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/wordmark-one-color.svg" alt="SportsHub One" className="h-[22px] w-auto" />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-700 h-6 w-6">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </div>
  )
}

export function PhonePage({
  children,
  className,
  noHeader,
}: {
  children: ReactNode
  className?: string
  noHeader?: boolean
}) {
  return (
    <div className={cn("bg-ink-50/60 flex min-h-full flex-col", className)}>
      {!noHeader && <MobileHeader />}
      <div className="flex-1 px-4 pb-10 pt-4">{children}</div>
    </div>
  )
}
