/**
 * Derived naming (league IA redesign §4, owner ruling 2026-07-30):
 * humans pick structure; the system composes every display name. Nobody
 * types "Burlington Force U15" or "U15 Boys · Tier 1" anywhere — that
 * kills duplicates and typos and makes standings/schedules read uniformly.
 *
 * Pure functions, safe on client and server.
 */

export type GenderKey = "MALE" | "FEMALE" | "COED" | null | undefined

/** Age groups offered by pickers (divisions and teams share the list). */
export const AGE_GROUPS = [
  "U9",
  "U10",
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "U17",
  "U18",
  "U19",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "Junior",
  "Senior",
]

/**
 * Suffix options when a club fields more than one team in the same bracket —
 * still a pick, never typing.
 */
export const TEAM_NAME_SUFFIXES = ["Blue", "White", "Black", "Red", "Gold", "Green", "2", "3"]

export function genderLabel(gender: GenderKey): string | null {
  if (gender === "MALE") return "Boys"
  if (gender === "FEMALE") return "Girls"
  if (gender === "COED") return "Co-ed"
  return null
}

/** "U15 Boys · Tier 1" — always composed, always the same shape. */
export function composeDivisionName(d: {
  ageGroup: string
  gender?: GenderKey
  tier?: number | null
}): string {
  const parts = [d.ageGroup.trim()]
  const g = genderLabel(d.gender)
  if (g) parts.push(g)
  const base = parts.join(" ")
  return d.tier != null && d.tier >= 1 ? `${base} · Tier ${d.tier}` : base
}

/**
 * "Burlington Force U15 Blue" — club short name + age group (+ picked
 * suffix). The short name is set once on club settings; the club's full
 * name is the fallback until then.
 */
export function composeTeamName(t: {
  clubName: string
  shortName?: string | null
  ageGroup: string
  suffix?: string | null
}): string {
  const base = (t.shortName ?? "").trim() || t.clubName.trim()
  const parts = [base, t.ageGroup.trim()]
  const suffix = (t.suffix ?? "").trim()
  if (suffix) parts.push(suffix)
  return parts.join(" ")
}
