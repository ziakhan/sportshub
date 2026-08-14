import type { CSSProperties, ReactNode } from "react"

/**
 * Brand background layer (design-system elevation, 2026-08-13).
 *
 * Server-safe on purpose: no "use client", no hooks, no scripts. It is pure
 * CSS + one inline SVG, so it can sit under a server-rendered page shell and
 * paints with the first HTML.
 *
 * THE CONSTRAINT THAT SHAPES THIS FILE (tester 2026-08-13, recorded in
 * auth-brand-panel.tsx): every hard-edged court motif tried on a gradient
 * "read as debris floating on it" — a bullseye, a half court, outline rings.
 * The fix is not to drop the motif, it is to stop it behaving like a sticker:
 *
 *   1. ONE court, drawn ONCE, at ~150% of the container so it can never be
 *      read as a small object sitting on the surface.
 *   2. Anchored off the bottom-right corner so the viewport crops it. A shape
 *      with no visible outer boundary reads as the surface itself.
 *   3. A radial mask that erases the line-work through the middle, which is
 *      where a centred card lands. Nothing crosses behind the content.
 *   4. Faint (0.05-0.10) and the same hue family as the gradient underneath,
 *      so it reads as a watermark in the paint, not ink on top of it.
 *   5. Two soft blurred glows (the house accent) over the top, which blend the
 *      remaining strokes into light rather than leaving them as bare geometry.
 */

export type CourtBackdropVariant = "navy" | "daylight" | "ink"

type VariantSpec = {
  /** Base gradient. */
  base: string
  /** Court line-work stroke. */
  stroke: string
  /** Tailwind opacity utility for the line-work. */
  lineOpacity: string
  /** Centre wash that settles the content zone. */
  wash: string
  /** The two blurred accent glows. */
  glowA: string
  glowB: string
}

const VARIANTS: Record<CourtBackdropVariant, VariantSpec> = {
  // The welcome-popup hero family — the house standard surface.
  navy: {
    base: "bg-[linear-gradient(145deg,#101c36_0%,#1b2a4a_52%,#0d1526_100%)]",
    stroke: "#f59e0b",
    lineOpacity: "opacity-[0.09]",
    wash: "bg-[radial-gradient(ellipse_72%_62%_at_50%_46%,rgba(13,21,38,0.62)_0%,rgba(13,21,38,0.18)_58%,transparent_78%)]",
    glowA: "bg-hoop-500/25",
    glowB: "bg-play-500/20",
  },
  // Warm daylight for signed-out browse pages: orange into white with a court
  // green settling the bottom edge.
  daylight: {
    base: "bg-[linear-gradient(155deg,#fff7ed_0%,#fffbeb_34%,#ffffff_68%,#f0fdf0_100%)]",
    stroke: "#9a3412",
    lineOpacity: "opacity-[0.10]",
    wash: "bg-[radial-gradient(ellipse_70%_58%_at_50%_44%,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.45)_56%,transparent_76%)]",
    glowA: "bg-hoop-200/50",
    glowB: "bg-court-200/45",
  },
  // Neutral deep ink for error and maintenance pages, where warmth would read
  // as decoration on bad news.
  ink: {
    base: "bg-[linear-gradient(150deg,#232329_0%,#18181b_55%,#0e0e10_100%)]",
    stroke: "#f59e0b",
    lineOpacity: "opacity-[0.07]",
    wash: "bg-[radial-gradient(ellipse_70%_60%_at_50%_46%,rgba(14,14,16,0.66)_0%,rgba(14,14,16,0.2)_58%,transparent_78%)]",
    glowA: "bg-play-500/14",
    glowB: "bg-hoop-500/12",
  },
}

/**
 * Erases the line-work through the middle so a centred card never has a court
 * line running behind its text. Black = keep, transparent = drop.
 */
const LINE_MASK =
  "radial-gradient(ellipse 62% 54% at 48% 44%, transparent 0%, transparent 42%, rgba(0,0,0,0.5) 68%, #000 92%)"

const maskStyle: CSSProperties = {
  maskImage: LINE_MASK,
  WebkitMaskImage: LINE_MASK,
}

/**
 * The decorative layer on its own — absolutely positioned, no children, never
 * interactive. Drop it into any element that is already `relative
 * overflow-hidden` (an existing hero, a modal panel) when you do not want an
 * extra wrapper in the tree.
 */
export function CourtBackdropLayer({
  variant = "navy",
  className,
}: {
  variant?: CourtBackdropVariant
  className?: string
}) {
  const v = VARIANTS[variant]

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${v.base} ${className ?? ""}`}
    >
      {/* Half court, cropped by the corner. One shape, no repeats.
          Phones (2026-08-13): bottom-anchoring only works while the shell is
          about one screen tall. On a 390px phone the card stack runs long, so
          the anchor fell hundreds of pixels below the fold and the page read
          as a plain gradient. Under the sm breakpoint the court flips to a
          top anchor, pulled up and right so the arc, key and rim crop into
          the header band of the first viewport and everything below it stays
          empty for the content. */}
      <div
        className={`absolute -bottom-[26%] -right-[14%] w-[150%] min-w-[820px] max-sm:bottom-auto max-sm:-top-[21rem] max-sm:-right-[45%] max-sm:w-[160%] max-sm:min-w-0 ${v.lineOpacity}`}
        style={maskStyle}
      >
        <svg
          className="w-full max-w-none"
          viewBox="0 0 620 560"
          fill="none"
          stroke={v.stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Half-court line + centre circle, both cut off by the top edge */}
          <path d="M60 0H560" />
          <circle cx="310" cy="0" r="92" />
          {/* Sidelines run off the top; baseline closes the bottom */}
          <path d="M60 -60V500H560V-60" />
          {/* Three point line: corners, then the arc */}
          <path d="M100 500V395A210 210 0 0 1 520 395V500" />
          {/* The key, free throw circle, restricted arc, rim, backboard */}
          <path d="M250 500V330H370V500" />
          <circle cx="310" cy="330" r="60" />
          <path d="M280 470A31 31 0 0 0 340 470" />
          <circle cx="310" cy="462" r="13" />
          <path d="M278 481H342" />
        </svg>
      </div>

      {/* Settles the middle so the content zone reads clean */}
      <div className={`absolute inset-0 ${v.wash}`} />

      {/* House accent glows — light, not shapes */}
      <div
        className={`absolute -right-32 -top-40 h-[34rem] w-[34rem] rounded-full blur-[110px] ${v.glowA}`}
      />
      <div
        className={`absolute -left-40 bottom-[-12rem] h-[32rem] w-[32rem] rounded-full blur-[120px] ${v.glowB}`}
      />
    </div>
  )
}

/**
 * The shell: the layer plus a content well stacked above it.
 *
 * `fullPage` makes it a page shell (min-h-screen, content centred); without it
 * you get a banded section that is exactly as tall as its children.
 */
export function CourtBackdrop({
  variant = "navy",
  fullPage = false,
  className,
  contentClassName,
  children,
}: {
  variant?: CourtBackdropVariant
  fullPage?: boolean
  className?: string
  contentClassName?: string
  children?: ReactNode
}) {
  return (
    <div
      className={`relative isolate overflow-hidden ${
        fullPage ? "flex min-h-screen flex-col items-center justify-center" : ""
      } ${className ?? ""}`}
    >
      <CourtBackdropLayer variant={variant} />
      <div className={`relative z-10 w-full ${contentClassName ?? ""}`}>{children}</div>
    </div>
  )
}
