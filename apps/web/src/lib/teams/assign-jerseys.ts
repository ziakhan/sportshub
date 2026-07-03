/**
 * Jersey number allocation — pure, first-come-first-served over preferences.
 *
 * Extracted from the team-finalize route so the algorithm is unit-testable
 * like the scheduler and standings engines. Given accepted offers (in the
 * order they should be honored) and the numbers already taken on the roster,
 * walk each player's preferences and assign the first free one; players whose
 * preferences are all taken get `null` (assigned manually later).
 */

export interface JerseyCandidate {
  offerId: string
  playerId: string
  playerName: string
  /** Preferences in priority order; nulls are skipped. */
  jerseyPrefs: (number | null)[]
}

export interface JerseyAssignment {
  offerId: string
  playerId: string
  playerName: string
  jerseyNumber: number | null
}

export function assignJerseys(
  candidates: JerseyCandidate[],
  takenNumbers: Iterable<number>
): JerseyAssignment[] {
  const assigned = new Set<number>(takenNumbers)
  const assignments: JerseyAssignment[] = []

  for (const candidate of candidates) {
    let jerseyNumber: number | null = null
    for (const pref of candidate.jerseyPrefs) {
      if (pref === null) continue
      if (!assigned.has(pref)) {
        jerseyNumber = pref
        assigned.add(pref)
        break
      }
    }
    assignments.push({
      offerId: candidate.offerId,
      playerId: candidate.playerId,
      playerName: candidate.playerName,
      jerseyNumber,
    })
  }

  return assignments
}
