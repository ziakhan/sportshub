/**
 * Scheduler v2 — public entry. solveSeasonV2 is the ONE way to a schedule:
 * snapshot → audit (BLOCK stops everything, before any solving) → solve →
 * proposal. applyProposal replays a proposal's operations verbatim in one
 * transaction — the commit path cannot reach the solver (preview == commit
 * is structural).
 */
import { prisma } from "@youthbasketballhub/db"
import { audit, hasBlock } from "./audit"
import { buildProposal } from "./proposal"
import { solveSeason } from "./season"
import { buildWorldSnapshot, snapshotHash, type WorldOptions } from "./world"
import type { Finding, Proposal } from "./types"

export interface SolveResult {
  ok: boolean
  findings: Finding[]
  proposal: Proposal | null
  /** Engine-bug escape hatch (§6.11): games the cell layer failed to place
   *  even though the audit passed. Always 0 in a healthy engine. */
  unplaced: number
  totals: Array<{ teamId: string; games: number }>
  sameRoundRematches: number
  errors: string[]
}

export async function solveSeasonV2(
  seasonId: string,
  options?: WorldOptions
): Promise<SolveResult> {
  const { snapshot, errors } = await buildWorldSnapshot(seasonId, options)
  if (!snapshot) {
    return {
      ok: false,
      findings: [],
      proposal: null,
      unplaced: 0,
      totals: [],
      sameRoundRematches: 0,
      errors,
    }
  }
  const findings = audit(snapshot)
  if (hasBlock(findings)) {
    return {
      ok: false,
      findings,
      proposal: null,
      unplaced: 0,
      totals: [],
      sameRoundRematches: 0,
      errors,
    }
  }
  const solution = solveSeason(snapshot)
  const proposal = buildProposal(
    snapshot,
    solution.cells,
    solution.countsByTeam,
    snapshotHash(snapshot)
  )
  return {
    ok: solution.unplaced === 0,
    findings,
    proposal,
    unplaced: solution.unplaced,
    totals: [...solution.totals.entries()]
      .map(([teamId, games]) => ({ teamId, games }))
      .sort((a, b) => (a.teamId < b.teamId ? -1 : 1)),
    sameRoundRematches: solution.sameRoundRematches,
    errors,
  }
}

/** Replay a proposal's operations in one transaction. Never solves. */
export async function applyProposal(
  seasonId: string,
  proposal: Proposal
): Promise<{ created: number; updated: number; deleted: number }> {
  let created = 0
  let updated = 0
  let deleted = 0
  await (prisma as any).$transaction(async (tx: any) => {
    const toDelete = proposal.operations
      .filter((o): o is Extract<typeof o, { op: "delete" }> => o.op === "delete")
      .map((o) => o.gameId)
    if (toDelete.length > 0) {
      const res = await tx.game.deleteMany({
        where: { id: { in: toDelete }, seasonId, status: "SCHEDULED", isLocked: false },
      })
      deleted = res.count
    }
    for (const op of proposal.operations) {
      if (op.op === "update") {
        await tx.game.update({
          where: { id: op.gameId },
          data: {
            sessionId: op.row.sessionId,
            dayId: op.row.dayId,
            dayVenueId: op.row.dayVenueId,
            courtId: op.row.courtId,
            venueId: op.row.venueId,
            homeTeamId: op.row.homeTeamId,
            awayTeamId: op.row.awayTeamId,
            scheduledAt: new Date(op.row.scheduledAt),
            duration: op.row.duration,
          },
        })
        updated++
      }
    }
    const creates = proposal.operations.filter(
      (o): o is Extract<typeof o, { op: "create" }> => o.op === "create"
    )
    if (creates.length > 0) {
      await tx.game.createMany({
        data: creates.map((o) => ({
          seasonId,
          phase: "REGULAR",
          sessionId: o.row.sessionId,
          dayId: o.row.dayId,
          dayVenueId: o.row.dayVenueId,
          courtId: o.row.courtId,
          venueId: o.row.venueId,
          homeTeamId: o.row.homeTeamId,
          awayTeamId: o.row.awayTeamId,
          scheduledAt: new Date(o.row.scheduledAt),
          duration: o.row.duration,
          status: "SCHEDULED",
          isLocked: false,
        })),
      })
      created = creates.length
    }
  })
  return { created, updated, deleted }
}

export { buildWorldSnapshot, snapshotHash } from "./world"
export { audit, hasBlock } from "./audit"
export type { Finding, Proposal } from "./types"
