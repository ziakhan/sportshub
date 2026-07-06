/**
 * Star rating display (server-safe, no hooks). Partial stars via a clipped
 * gold overlay so a 4.3 reads as 4.3, not 4 or 5.
 */
export function StarRating({
  rating,
  count,
  size = "sm",
}: {
  /** 0–5 */
  rating: number
  /** Review count; rendered as "(n)" when provided. */
  count?: number
  size?: "sm" | "md"
}) {
  const clamped = Math.max(0, Math.min(5, rating))
  const textSize = size === "md" ? "text-base" : "text-sm"
  return (
    <span className={`inline-flex items-center gap-1 ${textSize}`}>
      <span className="relative inline-block leading-none" aria-hidden>
        <span className="text-ink-200">★★★★★</span>
        <span
          className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-gold-500"
          style={{ width: `${(clamped / 5) * 100}%` }}
        >
          ★★★★★
        </span>
      </span>
      <span className="text-ink-700 font-semibold">{clamped.toFixed(1)}</span>
      {count !== undefined && <span className="text-ink-400">({count})</span>}
      <span className="sr-only">{`Rated ${clamped.toFixed(1)} out of 5${count !== undefined ? ` from ${count} reviews` : ""}`}</span>
    </span>
  )
}
