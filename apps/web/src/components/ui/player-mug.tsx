import { cn } from "./cn"

/**
 * The player's face, one component for the whole site.
 *
 * OWNER RULING 2026-08-14: a player without a photo does not get an initials
 * circle and does not get a grey blob. They get an EMPTY MUGSHOT — a bust
 * sketched by hand with their jersey number written on the chest — so a roster
 * of unphotographed kids still reads like a team sheet instead of a database
 * dump. The moment a real photo is uploaded it takes the frame.
 *
 * INK-TONED, NEVER TEAM-COLOURED (same ruling that made Crest neutral). The
 * placeholder is a stand-in for a photo, so colouring it by club would be
 * inventing an identity the player did not choose.
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

/** Frame tone per surface. Strokes come from the SVG below. */
const FRAME_CLASSES: Record<PlayerMugSurface, string> = {
  light: "bg-ink-50 ring-1 ring-inset ring-ink-100",
  dark: "bg-white/5 ring-1 ring-inset ring-white/10",
}

/**
 * Ink for the drawing. The silhouette sits at the tone the ruling asked for
 * (ink-200 / white 25%); the number is a step stronger because a jersey number
 * nobody can read is not a jersey number.
 */
const PEN: Record<PlayerMugSurface, { line: string; number: string }> = {
  light: { line: "#d9d9df", number: "#9191a1" },
  dark: { line: "rgba(255,255,255,0.25)", number: "rgba(255,255,255,0.45)" },
}

export interface PlayerMugProps {
  /** Player name. Alt text on a photo, aria-label on the sketch. */
  name: string
  /** Written on the chest of the placeholder. Absent = the bust alone. */
  jerseyNumber?: string | number | null
  /** A real head shot (data URL from the upload field, or any src). Wins. */
  photoUrl?: string | null
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
      <MugSketch name={name} jerseyNumber={jerseyNumber} surface={surface} />
    </span>
  )
}

/** Digits, trimmed to what fits on a chest. */
function chestNumber(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text) return null
  return text.slice(0, 3)
}

/**
 * The drawing. Deliberately off-true: the head is wider on the right than the
 * left, the shoulders do not match, the strokes vary in weight and the number
 * sits crooked with a scratched underline. A perfectly symmetrical version of
 * this reads as a corporate account icon, which is the thing it replaces.
 */
function MugSketch({
  name,
  jerseyNumber,
  surface,
}: {
  name: string
  jerseyNumber?: string | number | null
  surface: PlayerMugSurface
}) {
  const digits = chestNumber(jerseyNumber)
  const pen = PEN[surface]
  // Two digits is the common case; one gets more room, three gets less.
  const baseSize = digits ? (digits.length >= 3 ? 12.5 : digits.length === 2 ? 16 : 17.5) : 0

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
      {/* head — a circle drawn by a hand that does not close circles */}
      <path
        d="M32.1 12.2c5.8-.2 10.5 4.2 10.6 10.1.1 4.7-2.3 9.1-6.1 11.1-1.7.9-7.2 1-9 .1-4-2-6.4-6.3-6.2-11.1.2-5.8 4.9-10 10.7-10.2z"
        strokeWidth="1.7"
      />
      {/* neck */}
      <path d="M27.4 33.4c.2 2.3-.1 4-.9 5.3" strokeWidth="1.4" />
      <path d="M36.8 33.6c.1 2.4.5 4.1 1.3 5.4" strokeWidth="1.4" />
      {/* shoulders, left then right — bleeding off the bottom of the frame */}
      <path
        d="M10.6 64c.5-10.6 4.8-17.6 12.5-20.9 2-.9 3.4-2.2 3.8-4"
        strokeWidth="1.7"
      />
      <path
        d="M53.6 64c-.7-10.9-5.2-17.8-13.1-21-1.9-.8-3.2-2.1-3.6-3.9"
        strokeWidth="1.6"
      />
      {/* jersey: scoop neck, then the two seams that make it a singlet */}
      <path d="M26.9 39.1c1.2 5 7.9 5.2 9.9.1" strokeWidth="1.5" />
      <path d="M23.1 43.6c-.9 5.6-1.1 11.7-.6 17.5" strokeWidth="1.1" opacity="0.85" />
      <path d="M40.7 43.9c1 5.5 1.2 11.6.7 17.4" strokeWidth="1.1" opacity="0.85" />
      {digits && (
        <g transform="rotate(-6 32 52)">
          <text
            x="32"
            y="55.5"
            textAnchor="middle"
            fill={pen.number}
            stroke="none"
            fontFamily="ui-rounded, 'Trebuchet MS', system-ui, sans-serif"
            fontSize={baseSize}
            fontWeight={800}
            letterSpacing="0.4"
          >
            {digits.split("").map((d, i) => (
              <tspan
                key={`${d}-${i}`}
                // Cumulative dy: each digit hops the other way from the last,
                // which is what a number written by hand actually does.
                dy={i === 0 ? 0 : i % 2 === 1 ? -1.4 : 2.4}
                fontSize={baseSize * (i % 2 === 1 ? 0.92 : 1.04)}
              >
                {d}
              </tspan>
            ))}
          </text>
          <path
            d="M24.6 59.9c4.2-1.3 10.6-1.1 14.8.4"
            stroke={pen.number}
            strokeWidth="1.2"
            opacity="0.7"
          />
        </g>
      )}
    </svg>
  )
}
