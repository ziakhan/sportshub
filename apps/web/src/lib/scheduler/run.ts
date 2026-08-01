import { loadSchedulerInput, type LoadSchedulerOptions } from "./load"
import { generateSchedule, type SchedulerInput, type SchedulerResult } from "./generate"
import {
  computeFairnessReport,
  type ScheduleFairnessReport,
} from "./report"

/**
 * One-stop simulation runner (owner 2026-08-01): load a season, generate a
 * schedule, and score it with the fairness report — used by the approval
 * cost simulator, the scenario recommendations, and the org planner. Writes
 * NOTHING.
 */
export interface SeasonRun {
  input: SchedulerInput
  result: SchedulerResult
  report: ScheduleFairnessReport
}

export function reportForRun(input: SchedulerInput, result: SchedulerResult): ScheduleFairnessReport {
  const names = new Map<string, string>()
  const styles = new Map<string, "SAME_DAY" | "SPLIT_DAYS">()
  const unitByTeam = new Map<string, string>()
  const windowsByTeam = new Map<string, NonNullable<SchedulerInput["divisions"][0]["teams"][0]["windows"]>>()
  const blackoutsByTeam = new Map<
    string,
    NonNullable<SchedulerInput["divisions"][0]["teams"][0]["blackouts"]>
  >()
  for (const d of input.divisions) {
    for (const t of d.teams) {
      names.set(t.teamId, t.name)
      if (t.weekendStyle) styles.set(t.teamId, t.weekendStyle)
      unitByTeam.set(t.teamId, d.id)
      if (t.windows?.length) windowsByTeam.set(t.teamId, t.windows)
      if (t.blackouts?.length) blackoutsByTeam.set(t.teamId, t.blackouts)
    }
  }
  const sessionByGame = new Map<string, string>()
  const games = result.games.map((g, i) => {
    const id = `sim-${i}`
    sessionByGame.set(id, g.sessionId)
    return {
      id,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      scheduledAt: g.scheduledAt,
      venueId: g.venueId,
      courtId: g.courtId,
    }
  })
  return computeFairnessReport(
    games,
    names,
    input.gameSlotMinutes,
    styles,
    sessionByGame,
    unitByTeam.size > 0 ? unitByTeam : undefined,
    windowsByTeam.size > 0 ? windowsByTeam : undefined,
    blackoutsByTeam.size > 0 ? blackoutsByTeam : undefined
  )
}

export async function runSeasonSchedule(
  seasonId: string,
  loadOptions?: LoadSchedulerOptions,
  inputOverrides?: Partial<SchedulerInput>
): Promise<{ run: SeasonRun | null; errors: string[] }> {
  const { input, errors } = await loadSchedulerInput(seasonId, loadOptions)
  if (!input || errors.length > 0) return { run: null, errors }
  const merged: SchedulerInput = { ...input, ...inputOverrides }
  const result = generateSchedule(merged)
  return { run: { input: merged, result, report: reportForRun(merged, result) }, errors: [] }
}
