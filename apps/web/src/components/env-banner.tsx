/**
 * Staging marker (owner 2026-08-21).
 *
 * Renders only when NEXT_PUBLIC_ENV_LABEL is set, which is true on staging and
 * deliberately absent from production's env file — so this cannot appear on
 * the real site even though the same code ships to both.
 *
 * Two marks, because one is easy to stop seeing: a hairline across the very
 * top of the viewport, and a corner pill. Both are pointer-events-none so they
 * can never swallow a click, and the pill sits above the mobile bottom bar.
 */
export function EnvBanner() {
  const label = process.env.NEXT_PUBLIC_ENV_LABEL
  if (!label) return null
  return (
    <div aria-live="off" role="note">
      <span className="sr-only">
        This is the {label} environment. Nothing here is real data.
      </span>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 bg-amber-400"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-20 left-4 z-[100] flex items-center gap-2 rounded-full bg-amber-400 px-3 py-1.5 text-amber-950 shadow-lg sm:bottom-4"
      >
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        <span className="text-[11px] font-medium opacity-80">test data</span>
      </div>
    </div>
  )
}
