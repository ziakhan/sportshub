/**
 * League perks / "what's included" (QA-205) — native twin of the web's
 * apps/web/src/lib/leagues/perks.ts. Duplicated rather than shared: the two
 * apps don't share a lib package for this, and the list is small/static.
 * Keep in sync with the web copy if perk keys change.
 */
const PERK_LABELS: Record<string, string> = {
  livestream: "Livestreamed games",
  film: "Game film for teams",
  stats: "Full player stats",
  media: "Media coverage",
  potg: "Player of the Game awards",
  interviews: "Player interviews",
  scouts: "Scout exposure",
  officials: "Certified officials",
  venues: "Quality venues",
  allstar: "All-Star game",
  awards: "Season awards",
}

/** Resolves one League.perks entry to its display label (falls back to the
 *  raw string for free-text custom entries). */
export function perkLabel(entry: string): string {
  return PERK_LABELS[entry] ?? entry
}
