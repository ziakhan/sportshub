/**
 * League perks / "what's included" (QA-205).
 *
 * League.perks is a flat string[]: a mix of predefined perk keys (below) and
 * free-text custom entries, in whatever order the league owner arranged them.
 * There's no tag distinguishing the two — perkLabel() resolves a known key to
 * its display label and falls back to the raw string for custom entries.
 */
export interface PerkDefinition {
  key: string
  label: string
  icon?: string
}

export const PREDEFINED_PERKS: PerkDefinition[] = [
  { key: "livestream", label: "Livestreamed games" },
  { key: "film", label: "Game film for teams" },
  { key: "stats", label: "Full player stats" },
  { key: "media", label: "Media coverage" },
  { key: "potg", label: "Player of the Game awards" },
  { key: "interviews", label: "Player interviews" },
  { key: "scouts", label: "Scout exposure" },
  { key: "officials", label: "Certified officials" },
  { key: "venues", label: "Quality venues" },
  { key: "allstar", label: "All-Star game" },
  { key: "awards", label: "Season awards" },
]

const PERK_BY_KEY: Record<string, PerkDefinition> = Object.fromEntries(
  PREDEFINED_PERKS.map((p) => [p.key, p])
)

/** Resolves one entry from League.perks to its display label. */
export function perkLabel(entry: string): string {
  return PERK_BY_KEY[entry]?.label ?? entry
}
