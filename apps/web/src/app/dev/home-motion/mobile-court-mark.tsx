/**
 * Mobile hero court mark (draft v2, 2026-08-19).
 *
 * WHY THIS EXISTS
 * The hero's `hp-flat-navy` rule strips CourtBackdrop's line-work below 768px
 * and leaves a flat #0b1628. That was the right call for the full court, which
 * is desktop drama, but it leaves the highest-traffic surface on the site with
 * no graphic at all. This is the smallest thing that fills the hole without
 * breaking the court spec.
 *
 * WHAT v1 GOT WRONG (caught in the first drive, not by reasoning)
 *   · It hung the court off the BOTTOM edge, which on a phone is exactly where
 *     the white signup card and the demo button sit. The drawing was there and
 *     completely occluded.
 *   · 0.11 amber on bare navy was invisible. The desktop court can run 0.20
 *     because a wood floor and a colour wash sit under it and give the strokes
 *     something to bite on. On flat navy there is nothing behind them, so the
 *     same alpha reads as nothing at all.
 * v2 hangs the court off the TOP edge instead, where the only content is the
 * wordmark row, and runs the ink at 0.17.
 *
 * HOW IT OBEYS THE SPEC
 *   R1 one court per screen. It only ever paints where the full court is
 *      already hidden (`md:hidden`), so no screen shows two.
 *   R2 always cropped by an edge. The endline, backboard and rim are cut off
 *      by the top of the hero: you are standing at the baseline looking down
 *      the floor, which is why the arc sweeps away from you.
 *   R3 the reading zone stays clean. The mask holds the top 8% at zero so the
 *      wordmark is never on line-work, and fades back to zero by 66% so
 *      nothing survives into the signup card.
 *   R4 fixed opacity budget. 0.17 on bare navy lands at roughly the same
 *      on-screen weight as 0.20 over the desktop floor and wash.
 *
 * Geometry is regulation at 10 units per foot, the same scale as the desktop
 * court, measured from an endline at y=300: 16 ft paint 19 ft deep · 6 ft
 * free-throw circle · 6 ft backboard at 4 ft · 9 in rim · 23 ft 9 in arc with
 * 22 ft corner threes. The whole drawing is then flipped on Y so the endline
 * lands at the top rather than being redrawn upside down by hand.
 *
 * Static on purpose. The consult's rule is that continuous animation belongs
 * to loading indicators, and the hero already carries a pulsing dot, a
 * rotating headline and a swipe hint. A fourth moving thing is noise.
 */
export function MobileCourtMark() {
  /* Basket centre (250, 245) with R 237.5 meets the 22 ft corner line at
     dy = sqrt(237.5^2 - 220^2) ≈ 89.5, so the arc starts at y ≈ 155.5. */
  const ARC_Y = 155.5
  /* Fades in below the wordmark row and back out above the signup card, so
     the endline never cuts across "SportsHub ONE" and no line-work reaches
     the white card. What survives is the key, the free-throw circle and the
     arc, which are the parts that read as a basketball floor anyway. */
  const MASK =
    "linear-gradient(to bottom, transparent 7%, #000 18%, #000 36%, rgba(0,0,0,0.4) 48%, transparent 58%)"

  return (
    /* NOTE the missing aria-hidden on this wrapper, which is deliberate.
       PREVIEW_CSS carries `.hp-flat-navy > div[aria-hidden="true"] {
       display: none }` under 768px: the very rule that strips the desktop
       court on phones. This mark is a direct child of the same element, so
       marking the wrapper hidden made it match that rule and vanish. The
       aria-hidden lives on the <svg> instead, which is all a screen reader
       needs, and the wrapper stays an ordinary div. */
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden md:hidden"
      style={{ maskImage: MASK, WebkitMaskImage: MASK }}
    >
      {/* Wider than the hero so the corner threes are cut by the left and
          right edges (R2). `meet` rather than `slice`: slice blew the drawing
          up ~1.9x in a portrait box and cropped the arc clean off the screen,
          which is why v2 was still invisible. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 500 320"
        preserveAspectRatio="xMidYMid meet"
        /* aspect-ratio, not h-auto: an inline SVG is not a replaced element,
           so `height: auto` resolves to zero rather than to the viewBox. */
        style={{ aspectRatio: "500 / 320" }}
        className="absolute left-[-16%] top-[3%] w-[132%]"
        fill="none"
        stroke="#f59e0b"
        strokeOpacity={0.26}
        strokeWidth={3.4}
        strokeLinecap="round"
      >
        {/* Flip on Y: the drawing is authored from an endline at the bottom,
            and hung from the top edge instead of being re-authored inverted. */}
        <g transform="translate(0, 320) scale(1, -1)">
          {/* Endline, cropped by the top of the hero */}
          <path d="M0 300 H500" />

          {/* Three-point arc and the 22 ft corner threes */}
          <path d="M30 300 V155.5" />
          <path d="M470 300 V155.5" />
          <path d={`M30 ${ARC_Y} A 237.5 237.5 0 0 1 470 ${ARC_Y}`} />

          {/* The paint: 16 ft wide, 19 ft deep */}
          <path d="M170 300 V110 H330 V300" />

          {/* Free-throw circle: solid over the paint, dashed inside it */}
          <path d="M190 110 A 60 60 0 0 1 310 110" />
          <path d="M190 110 A 60 60 0 0 0 310 110" strokeDasharray="14 12" strokeOpacity={0.1} />

          {/* Backboard at 4 ft, rim at 9 in */}
          <path d="M220 260 H280" strokeWidth={3.2} />
          <circle cx="250" cy="245" r="7.5" strokeWidth={2} />

          {/* Lane hash marks, the detail that makes it read as a real floor */}
          <path d="M170 250 H158 M170 218 H158 M170 186 H158" strokeOpacity={0.12} />
          <path d="M330 250 H342 M330 218 H342 M330 186 H342" strokeOpacity={0.12} />
        </g>
      </svg>
    </div>
  )
}
