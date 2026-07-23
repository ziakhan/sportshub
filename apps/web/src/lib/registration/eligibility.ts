import { calculateAge } from "@/lib/coppa"

/**
 * Age-group eligibility — THE single source for "does this kid fit this
 * program" (owner 2026-07-23). Programs carry an `agePolicy`:
 *   STRICT    → ineligible players are blocked server-side (and greyed out)
 *   PREFERRED → mismatch shows a warning, parent may proceed
 *   OPEN      → no check
 *
 * Age groups are free text, so parsing is best-effort; anything we can't
 * parse means "no constraint" (never block on a string we don't understand).
 * Supported: "2012" · "2008-2010" (birth years, Canada single-birth-year
 * convention) · "U12"/"U8" (12-and-under in the calendar year → born in or
 * after refYear-12) · "Ages 9-14"/"Age 10" (calendar-year ages) ·
 * "Grade 9"/"Grades 9-10" (turning grade+5 or grade+6 that year — covers the
 * fall school-year split) · comma/slash lists of any of those (union).
 */

export type AgePolicyValue = "STRICT" | "PREFERRED" | "OPEN"

export interface BirthYearRange {
  minYear: number | null // earliest allowed birth year (oldest player)
  maxYear: number | null // latest allowed birth year (youngest player)
}

function parseOne(token: string, refYear: number): BirthYearRange | null {
  const t = token.trim()
  if (!t) return null

  const under = /^[uU]\s?(\d{1,2})$/.exec(t)
  if (under) {
    // U12 = age 12 or under in the calendar year → born refYear-12 or later.
    return { minYear: refYear - Number(under[1]), maxYear: null }
  }

  const range = /^(\d{4})\s*[-–]\s*(\d{4})$/.exec(t)
  if (range) {
    const a = Number(range[1])
    const b = Number(range[2])
    return { minYear: Math.min(a, b), maxYear: Math.max(a, b) }
  }

  const single = /^(\d{4})$/.exec(t)
  if (single) {
    const y = Number(single[1])
    // Sanity: birth years only (1990..refYear) — "2010" yes, "6045" no.
    if (y >= 1990 && y <= refYear) return { minYear: y, maxYear: y }
  }

  // "Ages 9-14", "Age 10", "9-14 years": turning that age in the calendar year.
  const ages = /^ages?\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?$/i.exec(t) ?? /^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s*(?:yrs?|years?)( old)?$/i.exec(t)
  if (ages) {
    const younger = Number(ages[1])
    const older = ages[2] ? Number(ages[2]) : younger
    return { minYear: refYear - Math.max(younger, older), maxYear: refYear - Math.min(younger, older) }
  }

  // "Grade 9", "Grades 9-10": grade G students turn G+5 or G+6 that year.
  const grade = /^grades?\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?$/i.exec(t)
  if (grade) {
    const lo = Number(grade[1])
    const hi = grade[2] ? Number(grade[2]) : lo
    return { minYear: refYear - (Math.max(lo, hi) + 6), maxYear: refYear - (Math.min(lo, hi) + 5) }
  }

  return null
}

/** Union of every parseable token; null when nothing parses (no constraint). */
export function parseAgeGroup(ageGroup: string | null | undefined, refYear: number): BirthYearRange | null {
  if (!ageGroup) return null
  const parts = ageGroup.split(/[,/]/).map((p) => parseOne(p, refYear)).filter(Boolean) as BirthYearRange[]
  if (parts.length === 0) return null
  const mins = parts.map((p) => p.minYear).filter((y): y is number => y != null)
  const maxs = parts.map((p) => p.maxYear)
  return {
    minYear: mins.length === parts.length ? Math.min(...mins) : null,
    maxYear: maxs.every((y) => y != null) ? Math.max(...(maxs as number[])) : null,
  }
}

export type EligibilityStatus = "ok" | "warn" | "block"

export interface Eligibility {
  status: EligibilityStatus
  /** Parent-readable reason, set when status != ok. */
  reason: string | null
}

export function checkEligibility(opts: {
  dateOfBirth: Date | string
  gender?: string | null
  program: { ageGroup: string | null; agePolicy: AgePolicyValue; gender?: string | null }
  now?: Date
}): Eligibility {
  const { program } = opts
  if (program.agePolicy === "OPEN") return { status: "ok", reason: null }

  const now = opts.now ?? new Date()
  const dob = new Date(opts.dateOfBirth)
  const birthYear = dob.getFullYear()
  const mismatches: string[] = []

  const range = parseAgeGroup(program.ageGroup, now.getFullYear())
  if (range) {
    const tooOld = range.minYear != null && birthYear < range.minYear
    const tooYoung = range.maxYear != null && birthYear > range.maxYear
    if (tooOld || tooYoung) {
      const rangeText =
        range.minYear != null && range.maxYear != null
          ? range.minYear === range.maxYear
            ? `players born in ${range.minYear}`
            : `players born ${range.minYear}–${range.maxYear}`
          : range.minYear != null
            ? `players born ${range.minYear} or later`
            : `players born up to ${range.maxYear}`
      mismatches.push(`born in ${birthYear}, but this program is for ${rangeText} (${program.ageGroup})`)
    }
  }

  if (program.gender && opts.gender && program.gender !== opts.gender) {
    mismatches.push(`this program is listed as ${program.gender.toLowerCase()}`)
  }

  if (mismatches.length === 0) return { status: "ok", reason: null }
  return {
    status: program.agePolicy === "STRICT" ? "block" : "warn",
    reason: mismatches.join("; "),
  }
}

/** Convenience for surfaces that show an age, not a birth year. */
export function ageOf(dateOfBirth: Date | string, now = new Date()): number {
  return calculateAge(new Date(dateOfBirth), now)
}
