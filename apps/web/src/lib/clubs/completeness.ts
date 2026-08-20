/**
 * One definition of "how complete is this club's record", shared by the
 * lifecycle API (SQL twin, see SCORE_SQL in the route), the admin clubs list,
 * and the club quick-view dialog — so a score always means the same thing.
 */

export interface CompletenessInput {
  website?: string | null
  contactEmail?: string | null
  phoneNumber?: string | null
  city?: string | null
  state?: string | null
  region?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  description?: string | null
}

export const COMPLETENESS_FIELDS = [
  { key: "website", label: "Website" },
  { key: "contactEmail", label: "Email" },
  { key: "phoneNumber", label: "Phone" },
  { key: "city", label: "City" },
  { key: "state", label: "Province" },
  { key: "region", label: "Region" },
  { key: "address", label: "Address" },
  { key: "location", label: "Map pin" },
  { key: "description", label: "Description" },
] as const

export const COMPLETENESS_TOTAL = COMPLETENESS_FIELDS.length

export function completeness(c: CompletenessInput): {
  filled: number
  total: number
  missing: string[]
} {
  const missing: string[] = []
  for (const f of COMPLETENESS_FIELDS) {
    const ok =
      f.key === "location"
        ? c.latitude != null && c.longitude != null
        : !!(c[f.key as keyof CompletenessInput] as string | null | undefined)?.toString().trim()
    if (!ok) missing.push(f.label)
  }
  return { filled: COMPLETENESS_TOTAL - missing.length, total: COMPLETENESS_TOTAL, missing }
}

/** The analytics buckets the console filters by. */
export const SCORE_BUCKETS = [
  { key: "full", label: "Everything filled", min: 9, max: 9 },
  { key: "high", label: "Nearly there", min: 7, max: 8 },
  { key: "mid", label: "Halfway", min: 4, max: 6 },
  { key: "low", label: "Thin", min: 0, max: 3 },
] as const

export type ScoreBucketKey = (typeof SCORE_BUCKETS)[number]["key"]
