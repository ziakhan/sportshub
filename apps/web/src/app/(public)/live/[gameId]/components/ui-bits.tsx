import React from "react"

/**
 * The few pieces every panel on the live game page shares (R2 split).
 * Keeping them here is what makes the tabs feel like one system instead of
 * three pages that happen to sit under the same hero.
 */

/** Page column. Wide enough at xl for the desktop two-column game view. */
export const SHELL = "mx-auto w-full max-w-6xl px-4 sm:px-6 xl:max-w-7xl"

/**
 * One heading treatment for every panel. Sleek, not shouty (owner 2026-08-14):
 * the loaded body font tops out at 700, so anything heavier was faux-bold.
 */
export const SECTION_HEADING = "text-ink-800 text-[11px] font-bold uppercase tracking-[0.18em]"

/** Team mark: the club's colour with its monogram, used at five sizes. */
export function Crest({
  color,
  size,
  text,
}: {
  color: string
  /** Tailwind size + type classes, e.g. "h-6 w-6 text-[10px]" */
  size: string
  text: string
}) {
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-sm`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {text}
    </span>
  )
}

/** Card shell + its title bar, so every panel opens the same way. */
export function Panel({
  title,
  action,
  className = "",
  bodyClassName = "",
  children,
}: {
  title: string
  action?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <section className={`border-ink-100 overflow-hidden rounded-2xl border bg-white ${className}`}>
      <div className="border-ink-100 flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <h3 className={SECTION_HEADING}>{title}</h3>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
