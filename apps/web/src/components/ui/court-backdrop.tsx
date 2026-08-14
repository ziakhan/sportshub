import type { CSSProperties, ReactNode } from "react"

/**
 * Brand background layer — court system v2 (owner-approved spec, 2026-08-14).
 *
 * Server-safe on purpose: no "use client", no hooks, no scripts, no image
 * files. Pure CSS gradients plus one inline SVG, so it paints with the first
 * HTML under a server-rendered shell.
 *
 * WHAT CHANGED FROM v1 (owner's complaint: "the court is invisible"):
 *   1. The drawing is now a REGULATION half court at 10 units per foot
 *      (viewBox 0 0 500 470): 16 ft paint, R 23'9" arc with corner threes,
 *      dashed inner free-throw circle, restricted arc bulging to midcourt,
 *      backboard, rim, lane hash marks. Geometry is copied from the approved
 *      design-system mock and should be checked against the rulebook, not
 *      redrawn by eye.
 *   2. There is a real FLOOR under the wash — two CSS wood recipes (maple
 *      planks and 240px parquet squares) — instead of a flat gradient.
 *   3. The wash sits OVER the floor at 74-93% alpha, so the wood reads as
 *      grain through the colour instead of the colour reading as paint.
 *   4. Line budgets doubled: navy amber 20%, daylight sienna 15%, ink amber
 *      12%. v1 ran at 7-10% and disappeared on every real screen.
 *
 * RULES THAT KEEP IT FROM TURNING TO NOISE (from the spec):
 *   R1 one court per screen; it is a place, not a wallpaper tile.
 *   R2 always cropped by an edge, anchored so the paint, arc or centre circle
 *      lands in view at every breakpoint (see the max-sm overrides below).
 *   R3 the reading zone stays clean: a radial mask fades the line-work to zero
 *      where a centred card lands. The mask is anchored to the CONTAINER, not
 *      to the court, so the hole tracks the content and not the drawing.
 *   R4 opacity budgets are fixed per finish. More energy comes from coloured
 *      cards, never louder floors.
 */

export type CourtBackdropVariant = "navy" | "daylight" | "ink"

/** Wood recipe painted under the wash. */
export type CourtBackdropFloor = "parquet" | "planks" | "none"

/**
 * How much of the system a surface gets.
 *
 * - `immersive` (default) full-height heroes, auth, onboarding, 404: floor +
 *   wash + a big cropped court, radial mask through the reading zone.
 * - `band` shallow header strips (page titles, entity headers). The court is
 *   rotated and hung off the top-right corner so the rim, backboard and paint
 *   dip into a 120-220px band. No full-height assumptions, lighter edge fade.
 * - `ambient` signed-in dashboards: a whisper of grain under the cards at 5%,
 *   no court lines, no wash. Dense working surfaces earn their feeling from
 *   the controls above them, never from texture under tables.
 */
export type CourtBackdropIntensity = "immersive" | "band" | "ambient"

/* ── Floors ──────────────────────────────────────────────────────────────── */

const MAPLE_HI = "#e8c184"
const MAPLE = "#d9a967"
const MAPLE_LO = "#c69753"

/** Maple planks: 96px boards, seam line, four-board colour cycle, fine grain. */
const FLOOR_PLANKS: CSSProperties = {
  backgroundImage: [
    "repeating-linear-gradient(90deg, rgba(0,0,0,.16) 0 1px, transparent 1px 96px)",
    `repeating-linear-gradient(90deg, ${MAPLE_HI} 0 96px, ${MAPLE} 96px 192px, ${MAPLE_LO} 192px 288px, ${MAPLE} 288px 384px)`,
    "repeating-linear-gradient(0deg, rgba(0,0,0,.05) 0 2px, transparent 2px 11px)",
  ].join(","),
}

/** Parquet: 240px conic checkerboard under a 120px block grid and fine grain. */
const FLOOR_PARQUET: CSSProperties = {
  backgroundImage: [
    "repeating-linear-gradient(90deg, rgba(0,0,0,.14) 0 1px, transparent 1px 120px)",
    "repeating-linear-gradient(0deg, rgba(0,0,0,.14) 0 1px, transparent 1px 120px)",
    "repeating-linear-gradient(90deg, rgba(0,0,0,.05) 0 2px, transparent 2px 12px)",
    `repeating-conic-gradient(${MAPLE_HI} 0% 25%, ${MAPLE} 25% 50%)`,
  ].join(","),
  backgroundSize: "auto, auto, auto, 240px 240px",
}

const FLOORS: Record<Exclude<CourtBackdropFloor, "none">, CSSProperties> = {
  planks: FLOOR_PLANKS,
  parquet: FLOOR_PARQUET,
}

/* ── Finishes ────────────────────────────────────────────────────────────── */

type VariantSpec = {
  /** Wood recipe when the caller does not pick one. */
  floor: CourtBackdropFloor
  /** Shown only when `floor="none"` — the wash alone is translucent. */
  base: string
  /** Colour wash OVER the floor. Alpha is what lets the grain read through. */
  wash: string
  /** Court line-work stroke. */
  stroke: string
  /** Fixed opacity budget for the line-work (R4). */
  lineOpacity: number
  /** The two blurred accent glows that blend the strokes into light. */
  glowA?: string
  glowB?: string
}

const VARIANTS: Record<CourtBackdropVariant, VariantSpec> = {
  // Arena night — the house standard. Home hero, auth, onboarding, welcome,
  // pop-ups, demo handoff.
  navy: {
    floor: "parquet",
    base: "linear-gradient(150deg,#101c36 0%,#1b2a4a 55%,#0d1526 100%)",
    wash: "linear-gradient(150deg, rgba(16,28,54,.88) 0%, rgba(27,42,74,.82) 55%, rgba(13,21,38,.92) 100%)",
    stroke: "#f59e0b",
    lineOpacity: 0.2,
    // Halved from v1 (25/20). Over a flat navy gradient the glows read as arena
    // light; over the parquet they tinted the whole right half maroon, which is
    // not the arena-night colour the spec asks for.
    glowA: "bg-hoop-500/12",
    glowB: "bg-play-500/12",
  },
  // Game day — browse header bands, club/team/league headers, invites, empty
  // states. No glows: the wash is already light, so a pale blob only mutes the
  // wood without adding anything.
  daylight: {
    floor: "planks",
    base: "linear-gradient(165deg,#fffbf0 0%,#ffffff 55%,#fff7ed 100%)",
    wash: "linear-gradient(165deg, rgba(255,251,240,.87) 0%, rgba(255,255,255,.74) 55%, rgba(255,247,237,.82) 100%)",
    stroke: "#9a3412",
    lineOpacity: 0.15,
  },
  // Chalk board — 404, error boundaries, maintenance. Same plank recipe as
  // daylight; the ink wash at 90-93% is what makes the wood read dark.
  ink: {
    floor: "planks",
    base: "linear-gradient(150deg,#141316 0%,#0e0e10 100%)",
    wash: "linear-gradient(150deg, rgba(20,19,22,.93) 0%, rgba(14,14,16,.9) 100%)",
    stroke: "#f59e0b",
    lineOpacity: 0.12,
    glowA: "bg-play-500/10",
    glowB: "bg-hoop-500/8",
  },
}

/* ── Masks ───────────────────────────────────────────────────────────────── */

/**
 * R3. Anchored to the container so the hole sits where a centred card lands,
 * whatever the court is doing behind it. Black = keep, transparent = drop.
 */
const MASK_IMMERSIVE =
  "radial-gradient(ellipse 60% 55% at 50% 45%, transparent 0%, transparent 40%, rgba(0,0,0,.55) 68%, #000 92%)"

/** Bands are short and the title sits left, so the court just fades leftward. */
const MASK_BAND =
  "linear-gradient(to left, #000 0%, rgba(0,0,0,.9) 34%, rgba(0,0,0,.45) 62%, transparent 88%)"

function maskStyle(image: string): CSSProperties {
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
  }
}

/* ── Anchors (R2) ────────────────────────────────────────────────────────── */

/**
 * Immersive: the court rises out of the bottom-right corner, cropped by the
 * baseline edge, so the arc, key and free-throw circle carry the surface.
 *
 * Phones (kept from 2026-08-13, re-derived for the new 500x470 geometry):
 * bottom-anchoring only works while the shell is about one screen tall. On a
 * 390px phone the card stack runs long and a bottom anchor falls below the
 * fold, so the page read as a plain gradient. Under `sm` the court flips to a
 * top anchor, blown up to 190% and pulled up and left so the BASELINE END of
 * the drawing lands in the first viewport: at 390x844 the three-point arc
 * crosses at y~134, the paint opens at y~63 and the baseline closes at y~345,
 * which is exactly the strip above a centred card.
 */
const ANCHOR_IMMERSIVE =
  "absolute -bottom-[8rem] -right-[10%] w-[62%] min-w-[620px] " +
  "max-sm:inset-x-auto max-sm:bottom-auto max-sm:-top-[22rem] max-sm:right-auto " +
  "max-sm:-left-[45%] max-sm:w-[190%] max-sm:min-w-0"

/**
 * Band: rotated 180 so the baseline end of the drawing (backboard, rim,
 * restricted arc, lane) is at the TOP of the element, then hung off the top
 * edge by a couple of rem. In a 120-220px strip that shows the rim and the
 * paint cropping in from the corner, with no dependence on container height.
 */
const ANCHOR_BAND =
  "absolute -top-[2.5rem] -right-[6%] w-[42%] min-w-[380px] rotate-180 " +
  "max-sm:-top-[2rem] max-sm:-right-[16%] max-sm:w-[86%] max-sm:min-w-[300px]"

/* ── The court ───────────────────────────────────────────────────────────── */

/**
 * Regulation half court, 10 units per foot, baseline at the bottom.
 * Path data is the approved mock's `#halfcourt` symbol, unchanged.
 */
function HalfCourt({ stroke }: { stroke: string }) {
  return (
    <svg
      className="w-full max-w-none"
      viewBox="0 0 500 470"
      fill="none"
      stroke={stroke}
      strokeWidth="3"
      strokeLinecap="round"
    >
      {/* Boundary: sidelines + baseline + half-court line */}
      <rect x="1.5" y="1.5" width="497" height="467" />
      {/* Centre circle, cut in half by the half-court line */}
      <path d="M190 1.5 A60 60 0 0 0 310 1.5" />
      {/* The paint, 16 ft x 19 ft */}
      <rect x="170" y="280" width="160" height="190" />
      {/* Free-throw circle: solid toward midcourt, dashed inside the paint */}
      <path d="M190 280 A60 60 0 0 1 310 280" />
      <path d="M190 280 A60 60 0 0 0 310 280" strokeDasharray="14 12" />
      {/* Backboard, rim, restricted arc */}
      <line x1="220" y1="430" x2="280" y2="430" strokeWidth="4" />
      <circle cx="250" cy="417.5" r="7.5" />
      <path d="M210 417.5 A40 40 0 0 1 290 417.5" />
      {/* Three point line: corners at 14 ft, then the R 23'9" arc */}
      <line x1="30" y1="470" x2="30" y2="328" />
      <line x1="470" y1="470" x2="470" y2="328" />
      <path d="M30 328 A237.5 237.5 0 0 1 470 328" />
      {/* Lane hash marks */}
      <g strokeWidth="2.5">
        <line x1="163" y1="400" x2="170" y2="400" />
        <line x1="163" y1="370" x2="170" y2="370" />
        <line x1="163" y1="340" x2="170" y2="340" />
        <line x1="163" y1="310" x2="170" y2="310" />
        <line x1="330" y1="400" x2="337" y2="400" />
        <line x1="330" y1="370" x2="337" y2="370" />
        <line x1="330" y1="340" x2="337" y2="340" />
        <line x1="330" y1="310" x2="337" y2="310" />
      </g>
    </svg>
  )
}

/* ── Public API ──────────────────────────────────────────────────────────── */

export type CourtBackdropLayerProps = {
  variant?: CourtBackdropVariant
  /** Wood under the wash. Defaults per variant: navy parquet, daylight and ink planks. */
  floor?: CourtBackdropFloor
  /** How much of the system this surface gets. Defaults to `immersive`. */
  intensity?: CourtBackdropIntensity
  className?: string
}

/**
 * The decorative layer on its own — absolutely positioned, no children, never
 * interactive. Drop it into any element that is already `relative
 * overflow-hidden` (an existing hero, a modal panel) when you do not want an
 * extra wrapper in the tree.
 */
export function CourtBackdropLayer({
  variant = "navy",
  floor,
  intensity = "immersive",
  className,
}: CourtBackdropLayerProps) {
  const v = VARIANTS[variant]
  const wood = floor ?? v.floor
  const ambient = intensity === "ambient"
  const band = intensity === "band"

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
      style={ambient ? undefined : { backgroundImage: v.base }}
    >
      {/* Floor. Ambient shows the grain alone at 5% and stops there. */}
      {wood !== "none" ? (
        <div
          className="absolute inset-0"
          style={ambient ? { ...FLOORS[wood], opacity: 0.05 } : FLOORS[wood]}
        />
      ) : null}

      {/* Colour wash over the wood */}
      {ambient ? null : <div className="absolute inset-0" style={{ backgroundImage: v.wash }} />}

      {/* One cropped court, faded through the reading zone */}
      {ambient ? null : (
        <div className="absolute inset-0" style={maskStyle(band ? MASK_BAND : MASK_IMMERSIVE)}>
          <div
            className={band ? ANCHOR_BAND : ANCHOR_IMMERSIVE}
            style={{ opacity: v.lineOpacity }}
          >
            <HalfCourt stroke={v.stroke} />
          </div>
        </div>
      )}

      {/* House accent glows — light, not shapes. They blend the strokes so the
          line-work never reads as bare geometry laid on the floor. */}
      {!ambient && v.glowA ? (
        <div
          className={`absolute -right-32 -top-40 h-[34rem] w-[34rem] rounded-full blur-[110px] ${v.glowA}`}
        />
      ) : null}
      {!ambient && v.glowB ? (
        <div
          className={`absolute -left-40 bottom-[-12rem] h-[32rem] w-[32rem] rounded-full blur-[120px] ${v.glowB}`}
        />
      ) : null}
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
  floor,
  intensity = "immersive",
  fullPage = false,
  className,
  contentClassName,
  children,
}: {
  variant?: CourtBackdropVariant
  floor?: CourtBackdropFloor
  intensity?: CourtBackdropIntensity
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
      <CourtBackdropLayer variant={variant} floor={floor} intensity={intensity} />
      <div className={`relative z-10 w-full ${contentClassName ?? ""}`}>{children}</div>
    </div>
  )
}
