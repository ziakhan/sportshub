/**
 * ONE definition of "counts toward capacity" for every program signup
 * (owner 2026-07-23 audit: camps and house leagues counted CANCELLED signups
 * forever — a cancelled kid could keep a program falsely Full — while
 * tryouts excluded them and training counted CONFIRMED only).
 *
 * The rule: every signup holds a spot unless it is CANCELLED. Use this
 * filter in every `_count`/`count` of program signups — signup APIs, public
 * pages, getAllPrograms, club dashboards, and the mobile detail API.
 */
export const ACTIVE_SIGNUPS = { status: { not: "CANCELLED" as const } }

export function spotsLeft(maxParticipants: number | null, activeCount: number): number | null {
  if (maxParticipants == null) return null
  return Math.max(0, maxParticipants - activeCount)
}

export function isFull(maxParticipants: number | null, activeCount: number): boolean {
  return maxParticipants != null && activeCount >= maxParticipants
}
