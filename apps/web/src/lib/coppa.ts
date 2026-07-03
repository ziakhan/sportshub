/**
 * COPPA age logic — single source of truth.
 *
 * Children under 13 (COPPA_MIN_AGE) cannot self-register; a parent must add
 * them and give explicit consent. Before this module existed the age check
 * was implemented three times with two different formulas (365.25-day float
 * math in two API routes, calendar math in the zod schema) — near a birthday
 * the float variants disagree with the calendar. Calendar math is canonical.
 */

export const COPPA_MIN_AGE = 13

/** Calendar-accurate age in whole years at `at` (defaults to now). */
export function calculateAge(dateOfBirth: Date, at: Date = new Date()): number {
  let age = at.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = at.getMonth() - dateOfBirth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < dateOfBirth.getDate())) {
    age--
  }
  return age
}

/** True when the person is under the COPPA minimum age (13). */
export function isCoppaMinor(dateOfBirth: Date, at: Date = new Date()): boolean {
  return calculateAge(dateOfBirth, at) < COPPA_MIN_AGE
}
