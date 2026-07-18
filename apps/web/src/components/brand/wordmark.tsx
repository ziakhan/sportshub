/**
 * Brand lockups — chosen 2026-07-18 (docs/marketing/brand-naming-and-messaging.md):
 *   A1 wordmark: two-tone "SportsHub" + the word ONE in a small energy box,
 *     superscript right ("ONE" spelled out on purpose — it matches the domain
 *     letter-for-letter; the numeral invites the sportshub1.com misreading).
 *   N3 icon: navy stage tile, white S, energy box with a 1 at the top right
 *     (icons are the one place the numeral is safe — nothing to type).
 * SVG/PNG masters for external use live in public/brand/ (see its README).
 */

const SIZES = {
  sm: { text: "text-lg", box: "text-[8px] px-1 py-[2px]" },
  md: { text: "text-2xl", box: "text-[9px] px-1.5 py-[2.5px]" },
  lg: { text: "text-4xl", box: "text-[11px] px-2 py-[3px]" },
} as const

export function BrandWordmark({
  size = "sm",
  variant = "color",
}: {
  size?: keyof typeof SIZES
  /** color = ink+blue on light · reverse = white+soft-blue on dark · mono = single ink */
  variant?: "color" | "reverse" | "mono"
}) {
  const s = SIZES[size]
  const sports = variant === "reverse" ? "text-white" : "text-ink-950"
  const hub =
    variant === "reverse" ? "text-play-300" : variant === "mono" ? "text-ink-950" : "text-play-600"
  return (
    <span className={`font-display inline-flex font-extrabold tracking-tight ${s.text}`}>
      <span className={sports}>Sports</span>
      <span className={hub}>Hub</span>
      <span
        className={`bg-hoop-500 relative -top-[0.35em] ml-1 inline-block self-start rounded-[4px] font-extrabold leading-none tracking-[0.08em] text-white ${s.box}`}
      >
        ONE
      </span>
    </span>
  )
}

/** N3 app-icon as an inline tile (header/nav use). Pixel size prop keeps it scalable. */
export function BrandIcon({ size = 36 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center bg-gradient-to-br from-[#1e2d4d] to-[#0b1628] font-extrabold text-white shadow-sm"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
      aria-hidden="true"
    >
      <span className="leading-none" style={{ fontSize: Math.round(size * 0.5) }}>
        S
      </span>
      <span
        className="bg-hoop-500 absolute flex items-center justify-center font-extrabold text-white"
        style={{
          width: Math.round(size * 0.31),
          height: Math.round(size * 0.31),
          top: Math.round(size * 0.11),
          right: Math.round(size * 0.11),
          fontSize: Math.round(size * 0.2),
          borderRadius: Math.round(size * 0.06),
        }}
      >
        1
      </span>
    </span>
  )
}
