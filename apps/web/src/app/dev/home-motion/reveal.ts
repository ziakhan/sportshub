/**
 * Scroll reveals for the launch page (draft, 2026-08-19).
 *
 * WHY THIS EXISTS
 * `hp-rise` appears exactly once in preview.tsx, on the hero, and it fires on
 * mount. Everything from ClaimYourClub down has no entrance at all: you scroll
 * and the section is simply there. This is the missing motion.
 *
 * THE RULES IT FOLLOWS (ui-ux-pro-max consult, 2026-08-19)
 *   · "Animate 1-2 key elements per view maximum" (severity High). So a
 *     section reveals as ONE gesture. Where a section holds a card row, the
 *     cards stagger and the section itself does NOT fade, because fading a
 *     parent and its children is two animations doing one job.
 *   · ease-out for entering. The curve below is a standard soft-landing
 *     cubic-bezier, not `linear`, which the consult flags as robotic.
 *   · transform and opacity only. Never width, height, top or left.
 *   · prefers-reduced-motion is honoured, and reveals are once-only: an
 *     element that has arrived stays arrived. Re-animating on scroll-back is
 *     the thing that makes these feel cheap.
 *
 * TIMINGS, and why these numbers
 *   560ms section / 520ms item: long enough to read as deliberate, under the
 *     600ms mark where motion starts feeling like latency.
 *   18px section / 14px item: the distance is small on purpose. A big travel
 *     reads as a slide-show; a small one reads as the page settling.
 *   70ms stagger: below ~50ms the row looks simultaneous, above ~110ms it
 *     looks like items queueing. 70 reads as one hand dealing cards.
 *   threshold 0.12 with a -8% bottom margin: the section commits just after
 *     its top edge clears the fold, so the motion is seen rather than finished
 *     off-screen.
 */

export const REVEAL_CSS = `
  [data-reveal] {
    opacity: 0;
    transform: translateY(18px);
    will-change: opacity, transform;
  }
  [data-reveal][data-revealed] {
    opacity: 1;
    transform: none;
    transition:
      opacity 560ms cubic-bezier(0.16, 1, 0.3, 1),
      transform 560ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  [data-reveal-item] {
    opacity: 0;
    transform: translateY(14px);
    will-change: opacity, transform;
  }
  [data-revealed] [data-reveal-item] {
    opacity: 1;
    transform: none;
    transition:
      opacity 520ms cubic-bezier(0.16, 1, 0.3, 1) var(--reveal-delay, 0ms),
      transform 520ms cubic-bezier(0.16, 1, 0.3, 1) var(--reveal-delay, 0ms);
  }
  @media (prefers-reduced-motion: reduce) {
    [data-reveal],
    [data-reveal-item] {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }
  }
`

const STAGGER_MS = 70
const MAX_STAGGER_ITEMS = 6

/**
 * The card row inside a section, if it has one.
 *
 * Deliberately conservative: it wants a real grid holding between three and
 * six element children. Anything else returns empty and the section reveals as
 * a single block, which is the safe default. A wrong guess here would stagger
 * something that is not a row, so the test is narrow on purpose.
 */
function cardRow(section: HTMLElement): HTMLElement[] {
  const containers = Array.from(section.querySelectorAll<HTMLElement>("div, ul"))
  for (const el of containers) {
    if (!/\bgrid-cols-/.test(el.className)) continue
    const kids = Array.from(el.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement
    )
    if (kids.length >= 3 && kids.length <= MAX_STAGGER_ITEMS) return kids
  }
  return []
}

/** Strip every attribute and inline style this module sets. */
export function clearReveal(sections: HTMLElement[]) {
  for (const section of sections) {
    section.removeAttribute("data-reveal")
    section.removeAttribute("data-revealed")
    for (const item of Array.from(
      section.querySelectorAll<HTMLElement>("[data-reveal-item]")
    )) {
      item.removeAttribute("data-reveal-item")
      item.style.removeProperty("--reveal-delay")
    }
  }
}

/**
 * Arm the given sections and start watching. Returns a teardown that both
 * disconnects the observer and restores the DOM, so toggling this off in the
 * lab leaves no trace.
 */
export function armReveal(sections: HTMLElement[]): () => void {
  for (const section of sections) {
    const row = cardRow(section)
    if (row.length > 0) {
      /* The row carries the motion; the section stays a plain host so the
         page never runs two fades over the same pixels. */
      row.forEach((item, i) => {
        item.setAttribute("data-reveal-item", "")
        item.style.setProperty("--reveal-delay", `${i * STAGGER_MS}ms`)
      })
    } else {
      section.setAttribute("data-reveal", "")
    }
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.setAttribute("data-revealed", "")
        io.unobserve(entry.target)
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  )
  for (const section of sections) io.observe(section)

  return () => {
    io.disconnect()
    clearReveal(sections)
  }
}
