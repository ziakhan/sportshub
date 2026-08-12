/**
 * Birth-year age math for the family layer (owner ruling 2026-08-12).
 *
 * Deliberately NOT `lib/coppa.ts`'s calendar math. COPPA's under-13 line is a
 * legal test that has to be exact to the day. The money gate and the
 * link-your-parent nudge are product rules the owner defined on the birth
 * year alone: "a 13-17 self-owned account never sees a payment form",
 * "18+ pays normally", both computed from the year. Same single-birth-year
 * convention the rest of the platform uses for age groups (Canada).
 *
 * Keeping the two apart on purpose: mixing them would silently move the COPPA
 * boundary by up to a year.
 */

/** The age a person turns during the current calendar year. */
export function ageByBirthYear(dateOfBirth: Date, at: Date = new Date()): number {
  return at.getFullYear() - dateOfBirth.getFullYear()
}

/** Adults pay for themselves; everyone younger needs a guardian on the money. */
export const SELF_PAY_MIN_AGE = 18

/** True when this person is too young to be their own payer. */
export function isPayingMinor(dateOfBirth: Date, at: Date = new Date()): boolean {
  return ageByBirthYear(dateOfBirth, at) < SELF_PAY_MIN_AGE
}

/**
 * The nudge audience: old enough to hold their own account (13+), young
 * enough to still need a guardian (under 18). Under-13 accounts do not exist
 * (COPPA) and 18+ never sees the banner.
 */
export function isNudgeAge(dateOfBirth: Date, at: Date = new Date()): boolean {
  const age = ageByBirthYear(dateOfBirth, at)
  return age >= 13 && age < SELF_PAY_MIN_AGE
}
