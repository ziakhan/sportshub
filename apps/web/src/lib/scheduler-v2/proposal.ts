/**
 * Scheduler v2 — L5 Proposal / diff. Matches the placed season to existing
 * rows so game identity survives regeneration (published URLs and
 * notifications never churn): a game is the same game when grade + pair +
 * occurrence match; updates keep the DB id. Home/away alternates
 * deterministically per pair (first meeting: lower id is home; each
 * rematch flips) — report-only fairness, no scheduling weight.
 */
import { createHash } from "crypto"
import type { Operation, PlacedCell, Proposal, ProposedRow, WorldSnapshot } from "./types"
import { burdenPoints, type BurdenCounts } from "./ledger"

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

export function buildProposal(
  snapshot: WorldSnapshot,
  cells: PlacedCell[],
  countsByTeam: Map<string, BurdenCounts>,
  snapshotHashValue: string
): Proposal {
  const gradeOf = new Map(snapshot.teams.map((t) => [t.id, t.gradeId]))

  /* Existing DRAFT rows by identity key. Pins are untouchable and appear in
     the placed cells already (they diff to "unchanged" by construction). */
  const pinIds = new Set(
    snapshot.existingGames.filter((g) => g.state === "PIN").map((g) => g.id)
  )
  const pinCount = new Map<string, number>()
  for (const g of snapshot.existingGames) {
    if (g.state !== "PIN") continue
    const pk = pairKey(g.teamAId, g.teamBId)
    pinCount.set(pk, (pinCount.get(pk) ?? 0) + 1)
  }
  const draftByKey = new Map<string, { id: string; row: ProposedRow | null }>()
  {
    const drafts = snapshot.existingGames
      .filter((g) => g.state === "DRAFT")
      .sort((a, b) =>
        a.startIso < b.startIso ? -1 : a.startIso > b.startIso ? 1 : a.id < b.id ? -1 : 1
      )
    const seen = new Map<string, number>()
    for (const g of drafts) {
      const pk = pairKey(g.teamAId, g.teamBId)
      const occ = (pinCount.get(pk) ?? 0) + (seen.get(pk) ?? 0)
      seen.set(pk, (seen.get(pk) ?? 0) + 1)
      const gradeId = gradeOf.get(g.teamAId) ?? "?"
      draftByKey.set(`${gradeId}|${pk}|${occ}`, {
        id: g.id,
        row:
          g.weekendId && g.dayId && g.dayVenueId && g.courtId && g.gymId
            ? {
                sessionId: g.weekendId,
                dayId: g.dayId,
                dayVenueId: g.dayVenueId,
                courtId: g.courtId,
                venueId: g.gymId,
                homeTeamId: "", // filled on compare — home/away not part of identity
                awayTeamId: "",
                scheduledAt: g.startIso,
                duration: g.durationMin,
              }
            : null,
      })
    }
  }

  const operations: Operation[] = []
  const games: Proposal["games"] = []
  let created = 0
  let updated = 0
  let unchanged = 0

  const matchedDraftIds = new Set<string>()
  const sortedPlaced = [...cells]
    .flatMap((c) => c.games.map((g) => ({ cell: c, g })))
    .sort((x, y) => {
      const kx = `${x.g.gradeId}|${pairKey(x.g.teamAId, x.g.teamBId)}|${x.g.occurrence}`
      const ky = `${y.g.gradeId}|${pairKey(y.g.teamAId, y.g.teamBId)}|${y.g.occurrence}`
      return kx < ky ? -1 : 1
    })

  for (const { cell, g } of sortedPlaced) {
    // Home/away alternation: even occurrence -> lower id (teamA) is home.
    const home = g.occurrence % 2 === 0 ? g.teamAId : g.teamBId
    const away = g.occurrence % 2 === 0 ? g.teamBId : g.teamAId
    const row: ProposedRow = {
      sessionId: cell.weekendId,
      dayId: g.dayId,
      dayVenueId: g.dayVenueId,
      courtId: g.courtId,
      venueId: cell.gymId,
      homeTeamId: home,
      awayTeamId: away,
      scheduledAt: g.startIso,
      duration: snapshot.config.slotMinutes,
    }
    const pinned = !!g.pinned
    games.push({ ...row, pinned })
    if (pinned) {
      unchanged++
      continue // pins are never operations
    }
    const key = `${g.gradeId}|${pairKey(g.teamAId, g.teamBId)}|${g.occurrence}`
    const draft = draftByKey.get(key)
    if (draft) {
      matchedDraftIds.add(draft.id)
      const same =
        draft.row &&
        draft.row.sessionId === row.sessionId &&
        draft.row.dayId === row.dayId &&
        draft.row.courtId === row.courtId &&
        draft.row.scheduledAt === row.scheduledAt
      if (same) {
        unchanged++
      } else {
        updated++
        operations.push({ op: "update", gameId: draft.id, row })
      }
    } else {
      created++
      operations.push({ op: "create", row })
    }
  }

  let deleted = 0
  for (const [, draft] of [...draftByKey.entries()].sort()) {
    if (matchedDraftIds.has(draft.id) || pinIds.has(draft.id)) continue
    deleted++
    operations.push({ op: "delete", gameId: draft.id })
  }

  /* Shape stats for A7's honest report. */
  let backToBacks = 0
  let longGaps = 0
  let twoDateWeekends = 0
  let gap1 = 0
  for (const c of countsByTeam.values()) {
    backToBacks += c.b2b
    longGaps += c.longGap
    twoDateWeekends += c.twoDates
    gap1 += c.gap1
  }

  const proposalHash = createHash("sha256")
    .update(JSON.stringify(operations))
    .digest("hex")

  return {
    snapshotHash: snapshotHashValue,
    proposalHash,
    operations,
    games,
    stats: {
      games: games.length,
      created,
      updated,
      deleted,
      unchanged,
      backToBacks,
      longGaps,
      twoDateWeekends,
      gap1,
    },
  }
}

export { burdenPoints }
