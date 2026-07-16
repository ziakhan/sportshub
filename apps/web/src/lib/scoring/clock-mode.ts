import type { ClockMode } from "@prisma/client"

/**
 * Effective game-clock mode: the scorekeeper's pre-game choice
 * (Game.clockEnabled) overrides the league default (gameClockMode) — an
 * unoperated clock counts minutes wrongly, so the person at the table
 * decides (owner 2026-07-15). Null inherits the league setting.
 */
export function effectiveClockMode(
  clockEnabled: boolean | null | undefined,
  leagueMode: ClockMode | null | undefined
): ClockMode {
  if (clockEnabled === true) return "SIMPLE"
  if (clockEnabled === false) return "OFF"
  return leagueMode ?? "SIMPLE"
}
