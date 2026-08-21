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

/**
 * THE SLUG CARRIES A SECRET (owner 2026-08-21). Every link is sent to one named
 * prospect, and the decks are not the same: NPH's is built from NPH's own clubs
 * and team names. A readable slug meant anyone holding one link could reach
 * every other by typing — read a competitor's deck, or learn who else is being
 * pitched. The token is what makes a link private; nothing else here does.
 *
 * ADDING A LEAGUE IS STILL ONE ROW. Generate the token, never hand-type it:
 *
 *     node -e "console.log(require('crypto').randomBytes(5).toString('hex'))"
 *
 * The prefix is there so a link is recognisable to US at a glance. It is not
 * the secret and it does not have to be a real name. Unknown slugs 404 and
 * every deck is noindex, so a link is only as private as who you send it to.
 * Rotate a token by editing the key: the old URL dies immediately.
 */
export const DECKS: Record<string, DeckBrand> = {
  /** The unaddressed cut. Send it to anyone; it names nobody. */
  "leagues-92057948e3": { ...NEUTRAL },

  /** North Pole Hoops: their own screenshots and their own league in the demo. */
  "nph-78f51df659": {
    shots: "/deck",
    league: "NPH Summer League",
    recipient: "North Pole Hoops",
  },

  "coalition-67acde08df": { ...NEUTRAL, recipient: "The Coalition League" },
  "hoopcity-137861a86b": { ...NEUTRAL, recipient: "HoopCity Basketball" },
}

export function getDeck(slug: string): DeckBrand | null {
  return DECKS[slug.toLowerCase()] ?? null
}

/** Title shown in the browser tab and in link previews. */
export function deckTitle(brand: DeckBrand): string {
  return brand.recipient ? `SportsHub for ${brand.recipient}` : "SportsHub for Leagues"
}
