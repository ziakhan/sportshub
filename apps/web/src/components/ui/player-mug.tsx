import { cn } from "./cn"
import { accentForKey, type PlayerAccent } from "@/lib/ui/player-accent"

/**
 * The player's face, one component for the whole site.
 *
 * OWNER RULING 2026-08-14: a player without a photo does not get an initials
 * circle and does not get a grey blob. They get an EMPTY MUGSHOT — a bust
 * sketched by hand with their jersey number written on the chest — so a roster
 * of unphotographed kids still reads like a team sheet instead of a database
 * dump. The moment a real photo is uploaded it takes the frame.
 *
 * OWNER VERDICT ON v1 (2026-08-15) and what v2 does about it:
 *
 *  "Too gray."            → the drawing is inked at ink-600 / white-72%, and
 *                           every mug carries a per-player accent (eight muted
 *                           tones, lib/ui/player-accent.ts) as a tile wash and
 *                           a jersey fill. Still not a team colour: the tone is
 *                           hashed from the player id, so it belongs to the
 *                           kid, not to the club.
 *  "The number is on top   → the anatomy was rebuilt. Head lives in the top
 *   of their head."          third and closes at y=28; the collar opens at
 *                           y=34.6 and the jersey owns the bottom half; the
 *                           number's cap-line starts at y≈46. There is no size
 *                           at which digits can reach the neck.
 *  "It's not a line."      → confident strokes at 1.6–2.0 weight, no hairlines,
 *                           no 0.7-opacity ghosting.
 *  "Get proper design for  → two compositions, one language. Above 34px the
 *   the template."           BUST. At or below 34px (roster rows, chips) a
 *                           JERSEY CROP: the same singlet, same collar curve,
 *                           same ink, zoomed so the number fills the tile —
 *                           because a 32px bust cannot carry a readable "23".
 *
 * Sizes mirror Crest so a roster row can sit a mug next to a crest and have
 * them line up. `sizeClassName` replaces the preset outright (box + radius)
 * because `cn` does no Tailwind conflict resolution.
 */

export type PlayerMugSurface = "light" | "dark"
export type PlayerMugSize = "xs" | "sm" | "md" | "lg" | "xl"

const SIZE_CLASSES: Record<PlayerMugSize, string> = {
  xs: "h-5 w-5 rounded-full",
  sm: "h-7 w-7 rounded-full",
  md: "h-9 w-9 rounded-full",
  lg: "h-12 w-12 rounded-full",
  xl: "h-16 w-16 rounded-full",
}

/** Rendered edge of each preset, in px — the input to the variant switch. */
const SIZE_PX: Record<PlayerMugSize, number> = { xs: 20, sm: 28, md: 36, lg: 48, xl: 64 }

/**
 * At and below this the bust is dropped for the jersey crop. Calibrated on the
 * number, not the figure: at 34px a bust's chest is ~7px tall, which is below
 * the size at which two bold digits survive antialiasing.
 */
const CROP_MAX_PX = 34

/**
 * Frame tone per surface. The accent wash is painted INSIDE the svg (so a call
 * site that overrides the frame — the leaders card's white ring, the POTG gold
 * border — keeps its ring and still gets the player's tone).
 */
const FRAME_CLASSES: Record<PlayerMugSurface, string> = {
  light: "bg-ink-50 ring-1 ring-inset ring-ink-100",
  dark: "bg-white/5 ring-1 ring-inset ring-white/10",
}

/**
 * The pen. Ink, always — the accent lives in the fills, never in the line, so
 * the drawing reads as one hand across all eight tones.
 */
const PEN: Record<PlayerMugSurface, { line: string; detail: string }> = {
  light: { line: "#5e5e6e", detail: "#747486" }, // ink-600 / ink-500
  dark: { line: "rgba(255,255,255,0.72)", detail: "rgba(255,255,255,0.5)" },
}

export interface PlayerMugProps {
  /** Player name. Alt text on a photo, aria-label on the sketch. */
  name: string
  /** Written on the chest of the placeholder. Absent = the bust alone. */
  jerseyNumber?: string | number | null
  /** A real head shot (data URL from the upload field, or any src). Wins. */
  photoUrl?: string | null
  /**
   * What the accent tone is hashed from. PASS THE PLAYER ID wherever one
   * exists: it is stable for the life of the account, where a display name
   * changes the day a kid starts going by their middle name. Defaults to the
   * name so no call site can end up tone-less.
   */
  accentKey?: string
  size?: PlayerMugSize
  /** Replaces the size preset outright (box + radius), for odd scales. */
  sizeClassName?: string
  /**
   * Replaces the frame tone outright (background + ring), for the surfaces
   * that already sit on a tint — a leaders card on `bg-ink-100` needs a white
   * frame or the sketch dissolves into the card.
   */
  frameClassName?: string
  surface?: PlayerMugSurface
  /** Extra classes layered on top. */
  className?: string
}

export function PlayerMug({
  name,
  jerseyNumber,
  photoUrl,
  accentKey,
  size = "sm",
  sizeClassName,
  frameClassName,
  surface = "light",
  className,
}: PlayerMugProps) {
  const box = cn("shrink-0 overflow-hidden", sizeClassName ?? SIZE_CLASSES[size], className)
  const frame = frameClassName ?? FRAME_CLASSES[surface]

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt={name} className={cn(box, frame, "object-cover")} />
    )
  }

  return (
    <span className={cn(box, "block", frame)}>
      <MugSketch
        name={name}
        jerseyNumber={jerseyNumber}
        surface={surface}
        accent={accentForKey(accentKey || name)}
        px={tilePx(size, sizeClassName)}
      />
    </span>
  )
}

/**
 * How big this mug actually renders. `size` is the honest answer, but most call
 * sites reach for `sizeClassName` instead, so the base Tailwind height is read
 * off it first (`h-9 w-9 rounded-full md:h-12 md:w-12` → 36; responsive steps
 * are ignored on purpose — they only ever scale UP, and the small end is what
 * the variant switch is protecting).
 */
function tilePx(size: PlayerMugSize, sizeClassName?: string): number {
  if (sizeClassName) {
    const rem = sizeClassName.match(/(?:^|\s)h-(\d+(?:\.\d+)?)(?:\s|$)/)
    if (rem) return Number(rem[1]) * 4
    const px = sizeClassName.match(/(?:^|\s)h-\[(\d+(?:\.\d+)?)px\]/)
    if (px) return Number(px[1])
  }
  return SIZE_PX[size]
}

/** Digits, trimmed to what fits on a chest. */
function chestNumber(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text) return null
  return text.slice(0, 3)
}

/** Jersey lettering: condensed, heavy, the way a number is printed on a kit. */
const NUMBER_FONT = "var(--font-condensed), 'Arial Narrow', ui-sans-serif, sans-serif"

/**
 * The drawing, in two compositions that share one hand.
 *
 * BUST — head (y 7→28), neck (28→34), jersey from the collar at 34.6 down
 * through the bottom edge, number seated on the chest with its cap-line at
 * y≈44 — a clear 4 units below the collar's lowest point and 10 below the
 * neck. The head is wider on the right than the left, the shoulders do not
 * match, and the strokes vary in weight: a perfectly symmetrical version of
 * this reads as a corporate account icon, which is the thing it replaces.
 *
 * CROP — the same singlet from a stride closer: the shoulder line runs off
 * both edges at y≈9, the same scooped collar hangs between them to y≈24, and
 * the number fills the chest below it. Read side by side the two are
 * obviously the same jersey.
 */
function MugSketch({
  name,
  jerseyNumber,
  surface,
  accent,
  px,
}: {
  name: string
  jerseyNumber?: string | number | null
  surface: PlayerMugSurface
  accent: PlayerAccent
  px: number
}) {
  const digits = chestNumber(jerseyNumber)
  const pen = PEN[surface]
  const dark = surface === "dark"
  const jerseyFill = dark ? accent.darkTint : accent.jersey
  const jerseyFillOpacity = dark ? 0.26 : 1
  // A number with nothing to sit on is not a crop — a numberless small tile
  // falls back to the bust, which still reads as a person at 20px.
  const crop = Boolean(digits) && px <= CROP_MAX_PX

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={name}
      className="h-full w-full"
      fill="none"
      stroke={pen.line}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Tile wash. Opaque on light (predictable over any frame); alpha on
          dark, because the surface underneath could be navy or ink and the
          wash has to tint it rather than replace it. */}
      <rect
        x="0"
        y="0"
        width="64"
        height="64"
        fill={dark ? accent.darkTint : accent.wash}
        opacity={dark ? 0.12 : 1}
        stroke="none"
      />

      {crop ? (
        <>
          {/* jersey, bleeding off three edges: shoulder line across the top,
              sides and hem past the frame, so the tile reads as a close-up of
              the same singlet rather than a badge floating in space */}
          <path
            d="M-1 9.4c7-.6 13.7.9 20.6 3.4 2.9 6.6 7.1 10.4 12.6 10.8 5.5-.5 9.6-4.4 12.3-11 6.8-2.6 13.5-4 20.5-3.6V65H-1z"
            fill={jerseyFill}
            fillOpacity={jerseyFillOpacity}
            stroke="none"
          />
          {/* the shoulder line + collar, inked over the fill */}
          <path
            d="M-0.5 9.5c7-.6 13.7.9 20.6 3.5 2.9 6.6 7.1 10.4 12.6 10.8 5.5-.5 9.6-4.4 12.3-11 6.6-2.5 13.1-3.9 19.8-3.6"
            stroke={pen.line}
            strokeWidth="2.1"
          />
          {/* shoulder seams, hand-drawn and off-true */}
          <path d="M11.8 11.4c-1.3 4.9-1.9 10-1.8 15.4" stroke={pen.detail} strokeWidth="1.5" />
          <path d="M52.6 11.2c1.4 4.8 2 9.9 1.9 15.2" stroke={pen.detail} strokeWidth="1.5" />
          <ChestNumber
            digits={digits as string}
            baseline={51}
            sizes={[34, 33, 26]}
            fill={dark ? accent.darkNumber : accent.deep}
          />
        </>
      ) : (
        <>
          {/* head — a circle drawn by a hand that does not close circles */}
          <path
            d="M32.6 6.9c5.8-.2 10.4 4.3 10.6 10.1.2 5.6-2.6 10-6.8 11.4-2.1.7-6.5.6-8.4-.2-4-1.7-6.6-6-6.4-11.4C21.8 11.1 26.6 7.1 32.6 6.9z"
            strokeWidth="1.9"
          />
          {/* neck */}
          <path d="M28.2 27.8c.3 2.6 0 4.6-.9 6.2" strokeWidth="1.6" />
          <path d="M36.4 28c-.2 2.6.2 4.6 1.2 6.1" strokeWidth="1.6" />
          {/* jersey — shoulders bleed off the bottom, collar scoops to 41 */}
          <path
            d="M4.6 64c-.3-9.4 2-16.1 7.3-19.8 4.3-3 9.3-5.6 14-9.6 1.2 3.3 3.4 5.3 6.1 5.4 2.7.1 5-2 6.2-5.5 4.8 3.9 9.8 6.4 14.1 9.5 5.3 3.7 7.6 10.4 7.3 20z"
            fill={jerseyFill}
            fillOpacity={jerseyFillOpacity}
            stroke={pen.line}
            strokeWidth="1.9"
          />
          {/* side seams */}
          <path d="M13.6 47.6c2.5 5.2 3.5 10.7 3.3 16.4" stroke={pen.detail} strokeWidth="1.3" />
          <path d="M50.8 48c-2.4 5.1-3.4 10.5-3.2 16" stroke={pen.detail} strokeWidth="1.3" />
          <ChestNumber
            digits={digits ?? ""}
            baseline={59.2}
            sizes={[23, 21, 17]}
            fill={dark ? accent.darkNumber : accent.deep}
          />
        </>
      )}
    </svg>
  )
}

/**
 * The number, written on rather than typeset: the whole word tilts a few
 * degrees and each digit hops the other way from the last, which is what a
 * hand does. v1's scratched underline is gone — the owner read it as a mistake,
 * and a printed jersey number does not have one.
 */
function ChestNumber({
  digits,
  baseline,
  sizes,
  fill,
}: {
  digits: string
  /** y of the digit baseline in the 64-unit box. */
  baseline: number
  /** Font size for [1, 2, 3] digits — three digits have to give room back. */
  sizes: [number, number, number] | number[]
  fill: string
}) {
  if (!digits) return null
  const base = sizes[Math.min(digits.length, 3) - 1]
  return (
    <g transform={`rotate(-3.5 32 ${baseline - 6})`}>
      <text
        x="32"
        y={baseline}
        textAnchor="middle"
        fill={fill}
        stroke="none"
        fontFamily={NUMBER_FONT}
        fontSize={base}
        fontWeight={700}
        letterSpacing="0.4"
      >
        {digits.split("").map((d, i) => (
          <tspan
            key={`${d}-${i}`}
            // Cumulative dy: each digit hops the other way from the last.
            dy={i === 0 ? 0 : i % 2 === 1 ? -1.1 : 1.9}
            fontSize={base * (i % 2 === 1 ? 0.96 : 1.03)}
          >
            {d}
          </tspan>
        ))}
      </text>
    </g>
  )
}
