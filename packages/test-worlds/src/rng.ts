/**
 * Deterministic pseudo-randomness for world building.
 *
 * No faker dependency, no Math.random — a seeded mulberry32 PRNG plus small
 * curated name pools. The same seed always produces the same world, which is
 * what makes scenario tests reproducible and demo data stable.
 */

export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]
}

export function pickInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export const FIRST_NAMES = [
  "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn", "Jamie",
  "Alex", "Cameron", "Dakota", "Emerson", "Finley", "Harper", "Jesse", "Kai",
  "Logan", "Micah", "Noor", "Omar", "Priya", "Rowan", "Sasha", "Tobi",
] as const

export const LAST_NAMES = [
  "Lee", "Chen", "Patel", "Garcia", "Kim", "Nguyen", "Brown", "Wilson",
  "Martin", "Singh", "Lopez", "Clark", "Walker", "Hall", "Young", "Wright",
  "Scott", "Adams", "Baker", "Rivera", "Campbell", "Mitchell", "Carter", "Diaz",
] as const

export const TEAM_ADJECTIVES = [
  "Riverside", "Northgate", "Lakeshore", "Harbourview", "Maplewood", "Eastside",
  "Summit", "Valleyfield", "Brookhill", "Westport",
] as const

export const TEAM_MASCOTS = [
  "Raptors", "Hawks", "Wolves", "Kings", "Chargers", "Storm", "Titans",
  "Comets", "Falcons", "Bulls",
] as const

export function personName(rng: Rng): { firstName: string; lastName: string } {
  return { firstName: pick(rng, FIRST_NAMES), lastName: pick(rng, LAST_NAMES) }
}

export function teamName(rng: Rng): string {
  return `${pick(rng, TEAM_ADJECTIVES)} ${pick(rng, TEAM_MASCOTS)}`
}

/** Relative date helper — never hardcode absolute future dates (time bombs). */
export function daysFromNow(days: number, hour = 12): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d
}

/** A date-of-birth producing exactly `age` years today (calendar-accurate). */
export function dobForAge(age: number, offsetDays = -30): Date {
  const d = new Date()
  d.setFullYear(d.getFullYear() - age)
  d.setDate(d.getDate() + offsetDays) // safely inside the age year
  return d
}
