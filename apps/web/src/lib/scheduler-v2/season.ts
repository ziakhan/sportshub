/**
 * Scheduler v2 — L4 Season Orchestrator. Threads the burden ledger through
 * cells chronologically, then one re-thread pass with full-season knowledge
 * (the bounded global fairness pass): each cell re-places against what the
 * whole season did to its teams, kept only if the season objective improves.
 */
import { placeCell, type CellLedger, type PrevPosition } from "./cell"
import { addCounts, burdenPoints, zeroCounts, type BurdenCounts } from "./ledger"
import { buildMatchups } from "./matchups"
import type { MatchupCell, PlacedCell, WorldSnapshot } from "./types"

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

export interface SeasonSolution {
  cells: PlacedCell[]
  countsByTeam: Map<string, BurdenCounts>
  totals: Map<string, number>
  /** Games the cell layer could not place — MUST be empty when the audit
   *  passed; anything here is an engine bug surfaced loudly (§6.11). */
  unplaced: number
  sameRoundRematches: number
}

/** Previous draft positions, for placement stickiness (minimal re-solve). */
function draftPositions(snapshot: WorldSnapshot): Map<string, PrevPosition> {
  const gradeOf = new Map(snapshot.teams.map((t) => [t.id, t.gradeId]))
  const map = new Map<string, PrevPosition>()
  // Occurrence within a pair counts pins first, then drafts by start time —
  // the same order the matchup layer consumes history.
  const pinCount = new Map<string, number>()
  for (const g of snapshot.existingGames) {
    if (g.state === "PIN") {
      const pk = pairKey(g.teamAId, g.teamBId)
      pinCount.set(pk, (pinCount.get(pk) ?? 0) + 1)
    }
  }
  const drafts = snapshot.existingGames
    .filter((g) => g.state === "DRAFT" && g.dayId && g.courtId)
    .sort((a, b) => (a.startIso < b.startIso ? -1 : a.startIso > b.startIso ? 1 : a.id < b.id ? -1 : 1))
  const seen = new Map<string, number>()
  for (const g of drafts) {
    const pk = pairKey(g.teamAId, g.teamBId)
    const occ = (pinCount.get(pk) ?? 0) + (seen.get(pk) ?? 0)
    seen.set(pk, (seen.get(pk) ?? 0) + 1)
    const gradeId = gradeOf.get(g.teamAId)
    if (!gradeId) continue
    map.set(`${gradeId}|${pk}|${occ}`, {
      dayId: g.dayId!,
      courtId: g.courtId!,
      startIso: g.startIso,
    })
  }
  return map
}

export function solveSeason(snapshot: WorldSnapshot): SeasonSolution {
  const { cells, totals, sameRoundRematches } = buildMatchups(snapshot)
  const prev = draftPositions(snapshot)
  const weights = snapshot.config.weights

  const cellsOfWeekend = new Map<string, MatchupCell[]>()
  for (const c of cells) {
    if (!cellsOfWeekend.has(c.weekendId)) cellsOfWeekend.set(c.weekendId, [])
    cellsOfWeekend.get(c.weekendId)!.push(c)
  }
  for (const list of cellsOfWeekend.values()) list.sort((a, b) => (a.gymId < b.gymId ? -1 : 1))

  interface CellRun {
    cell: MatchupCell
    placed: PlacedCell
    counts: Map<string, BurdenCounts>
  }

  const runPass = (
    pointsBeforeOf?: (cellKey: string) => Map<string, number>
  ): {
    runs: CellRun[]
    finalPoints: Map<string, number>
    countsByTeam: Map<string, BurdenCounts>
  } => {
    const runs: CellRun[] = []
    const running = new Map<string, number>()
    const courtUse = new Map<string, number>()
    const countsByTeam = new Map<string, BurdenCounts>()
    for (const w of snapshot.weekends) {
      for (const cell of cellsOfWeekend.get(w.id) ?? []) {
        const cellKey = `${cell.weekendId}|${cell.gymId}`
        const ledger: CellLedger = {
          pointsBefore: pointsBeforeOf?.(cellKey) ?? running,
          courtUse,
        }
        const { placed, counts } = placeCell(cell, w, snapshot, ledger, prev)
        runs.push({ cell, placed, counts })
        for (const [teamId, c] of counts) {
          running.set(teamId, (running.get(teamId) ?? 0) + burdenPoints(c, weights))
          countsByTeam.set(teamId, addCounts(countsByTeam.get(teamId) ?? zeroCounts(), c))
        }
        for (const g of placed.games) {
          for (const teamId of [g.teamAId, g.teamBId]) {
            const k = `${teamId}|${g.courtId}`
            courtUse.set(k, (courtUse.get(k) ?? 0) + 1)
          }
        }
      }
    }
    return { runs, finalPoints: running, countsByTeam }
  }

  // Pass 1: chronological threading (each cell sees the burdens so far).
  const pass1 = runPass()

  // Pass 2 (the global fairness re-thread): each cell re-places knowing the
  // WHOLE season's burden on its teams minus its own contribution, so late
  // knowledge can rescue early cells. Kept only if the season objective
  // (sum of squared team burdens) does not get worse.
  const cellPoints = new Map<string, Map<string, number>>()
  for (const run of pass1.runs) {
    const key = `${run.cell.weekendId}|${run.cell.gymId}`
    const m = new Map<string, number>()
    for (const [teamId, c] of run.counts) m.set(teamId, burdenPoints(c, weights))
    cellPoints.set(key, m)
  }
  const pass2 = runPass((cellKey: string) => {
    const own = cellPoints.get(cellKey) ?? new Map()
    const adjusted = new Map<string, number>()
    for (const [teamId, total] of pass1.finalPoints) {
      adjusted.set(teamId, Math.max(0, total - (own.get(teamId) ?? 0)))
    }
    return adjusted
  })

  const objective = (points: Map<string, number>): number => {
    let f = 0
    for (const p of points.values()) f += p * p
    return f
  }
  const winner = objective(pass2.finalPoints) <= objective(pass1.finalPoints) ? pass2 : pass1

  let expected = 0
  let got = 0
  for (const run of winner.runs) {
    expected += run.cell.games.length
    got += run.placed.games.length
  }

  return {
    cells: winner.runs.map((r) => r.placed),
    countsByTeam: winner.countsByTeam,
    totals,
    unplaced: expected - got,
    sameRoundRematches,
  }
}
