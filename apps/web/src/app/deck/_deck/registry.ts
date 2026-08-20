/**
 * Who each deck is for (owner 2026-08-20).
 *
 * There is ONE deck. Every slide and every sentence lives in
 * `league-deck.tsx`, so a wording change lands on every recipient at once and
 * the variants cannot drift apart. All a row here does is decide which
 * screenshot set to use, what the embedded demo calls its league, and whose
 * name goes on the title slide.
 *
 * ADDING A LEAGUE IS ONE ROW. Give it a slug, a display name, and optionally a
 * logo file dropped in `public/deck/logos/`. It is live at /deck/<slug> on the
 * next deploy. Do not fork the deck.
 *
 * NPH is the one exception: it has its own screenshot set and its own league
 * name inside the demo, because the seeded world is built from their real
 * teams, so showing it back to them is honest. Everyone else shares the neutral
 * set, where the sample league is plainly a sample. Putting a prospect's own
 * league name on invented teams and invented scores reads as a mockup of their
 * league, and a commissioner notices the games are not real.
 */

export interface DeckBrand {
  /** Folder under /public holding this variant's screenshots. */
  shots: string
  /** League name the embedded game-day demo shows. */
  league: string
  /** Recipient, rendered as "Prepared for <name>" on the title slide. */
  recipient?: string
  /** Optional logo beside the name, e.g. "/deck/logos/coalition.png". */
  logo?: string
}

const NEUTRAL = { shots: "/deck/neutral", league: "Parkview Summer League" } as const

export const DECKS: Record<string, DeckBrand> = {
  /** The unaddressed cut. Send it to anyone; it names nobody. */
  leagues: { ...NEUTRAL },

  /** North Pole Hoops: their own screenshots and their own league in the demo. */
  nph: {
    shots: "/deck",
    league: "NPH Summer League",
    recipient: "North Pole Hoops",
  },

  coalition: { ...NEUTRAL, recipient: "The Coalition League" },
  hoopcity: { ...NEUTRAL, recipient: "HoopCity Basketball" },
}

export function getDeck(slug: string): DeckBrand | null {
  return DECKS[slug.toLowerCase()] ?? null
}

/** Title shown in the browser tab and in link previews. */
export function deckTitle(brand: DeckBrand): string {
  return brand.recipient ? `SportsHub for ${brand.recipient}` : "SportsHub for Leagues"
}
