import React from "react"
import { Crest as BaseCrest, type CrestSurface } from "@/components/ui/crest"

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

/**
 * Team mark, used at five sizes across the page.
 *
 * Ink-toned, never the club's colour (owner ruling 2026-08-14): a live game is
 * a summary surface, and the colour most clubs carry was assigned at import
 * rather than chosen. `surface` picks the tone — "dark" for the navy stage,
 * "light" for the white panels below it.
 */
export function Crest({
  size,
  text,
  surface = "dark",
}: {
  /** Tailwind size + type classes, e.g. "h-6 w-6 text-[10px]" */
  size: string
  text: string
  surface?: CrestSurface
}) {
  return <BaseCrest name={text} text={text} surface={surface} sizeClassName={`rounded-xl ${size}`} />
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
