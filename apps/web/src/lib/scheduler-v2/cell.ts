/**
 * Scheduler v2 — L3 Cell Placement. One weekend, one gym: place the cell's
 * games onto the gym's court-slots. Deterministic construction (marginal
 * quadratic-fairness cost, canonical tie-breaks) followed by bounded
 * monotone repair (relocate + swap). Other gyms do not exist here — H1 is
 * satisfied by construction, not by penalty.
 */
import {
  addCounts,
  burdenPoints,
  weekendCounts,
  zeroCounts,
  type BurdenCounts,
  type TeamStop,
} from "./ledger"
import type { MatchupCell, PlacedCell, PlacedGame, SnapTeam, SnapWeekend, WorldSnapshot } from "./types"

export interface GridPosition {
  idx: number
  dayId: string
  dayVenueId: string
  courtId: string
  slotIdx: number
  slotCount: number
  startMs: number
  startIso: string
  startMin: number
  dow: number
  dateKey: string
  dayOrder: number
}

export function buildGrid(weekend: SnapWeekend, gymId: string, slotMinutes: number): GridPosition[] {
  const positions: GridPosition[] = []
  let idx = 0
  weekend.days.forEach((day, dayOrder) => {
    const base = new Date(day.date)
    for (const v of day.venues) {
      if (v.gymId !== gymId) continue
      const slotCount = Math.floor((v.closeMin - v.openMin) / slotMinutes)
      for (let s = 0; s < slotCount; s++) {
        const startMin = v.openMin + s * slotMinutes
        const start = new Date(base)
        start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0)
        for (const court of v.courts) {
          positions.push({
            idx: idx++,
            dayId: day.id,
            dayVenueId: v.dayVenueId,
            courtId: court.id,
            slotIdx: s,
            slotCount,
            startMs: start.getTime(),
            startIso: start.toISOString(),
            startMin,
            dow: day.dow,
            dateKey: day.dateKey,
            dayOrder,
          })
        }
      }
    }
  })
  return positions
}

export interface CellLedger {
  /** Season burden points accumulated BEFORE this cell, per team. */
  pointsBefore: Map<string, number>
  /** Season court usage before this cell: `${teamId}|${courtId}` -> games. */
  courtUse: Map<string, number>
}

export interface PrevPosition {
  dayId: string
  courtId: string
  startIso: string
}

const gameKeyOf = (g: { gradeId: string; teamAId: string; teamBId: string; occurrence: number }) =>
  `${g.gradeId}|${g.teamAId}|${g.teamBId}|${g.occurrence}`

export function placeCell(
  cell: MatchupCell,
  weekend: SnapWeekend,
  snapshot: WorldSnapshot,
  ledger: CellLedger,
  prevPositions: Map<string, PrevPosition>
): { placed: PlacedCell; counts: Map<string, BurdenCounts> } {
  const { slotMinutes, weights, keepTheta } = {
    slotMinutes: snapshot.config.slotMinutes,
    weights: snapshot.config.weights,
    keepTheta: snapshot.config.keepTheta,
  }
  const teamById = new Map(snapshot.teams.map((t) => [t.id, t]))
  const grid = buildGrid(weekend, cell.gymId, slotMinutes)

  const occupied = new Array<boolean>(grid.length).fill(false)
  const teamBusy = new Set<string>() // `${teamId}|${startMs}`
  /** teamId -> stops (pins + placed so far). */
  const stopsOf = new Map<string, TeamStop[]>()
  const pushStop = (teamId: string, pos: GridPosition) => {
    if (!stopsOf.has(teamId)) stopsOf.set(teamId, [])
    stopsOf.get(teamId)!.push({
      dayId: pos.dayId,
      startMs: pos.startMs,
      startMin: pos.startMin,
      dow: pos.dow,
      dateKey: pos.dateKey,
      first: pos.slotIdx === 0,
      last: pos.slotIdx === pos.slotCount - 1,
    })
  }
  const popStop = (teamId: string, startMs: number) => {
    const list = stopsOf.get(teamId) ?? []
    const i = list.findIndex((s) => s.startMs === startMs)
    if (i >= 0) list.splice(i, 1)
  }

  const teamPoints = (teamId: string): number => {
    const t = teamById.get(teamId)!
    return burdenPoints(weekendCounts(stopsOf.get(teamId) ?? [], t, slotMinutes), weights)
  }
  const B = (teamId: string): number => ledger.pointsBefore.get(teamId) ?? 0

  /* ------------------------------- pins first ------------------------------- */

  const pinnedGames: PlacedGame[] = []
  const unplaced: typeof cell.games = []
  for (const g of cell.games) {
    if (!g.pinned) {
      unplaced.push(g)
      continue
    }
    const pos = grid.find(
      (p) => p.courtId === g.pinned!.courtId && p.startIso === g.pinned!.startIso
    )
    if (pos) occupied[pos.idx] = true
    const startMs = new Date(g.pinned.startIso).getTime()
    for (const teamId of [g.teamAId, g.teamBId]) {
      teamBusy.add(`${teamId}|${startMs}`)
      pushStop(
        teamId,
        pos ?? {
          ...grid[0],
          dayId: g.pinned.dayId,
          startMs,
          startIso: g.pinned.startIso,
          startMin: new Date(g.pinned.startIso).getHours() * 60 + new Date(g.pinned.startIso).getMinutes(),
          slotIdx: 1,
          slotCount: 99,
        }
      )
    }
    pinnedGames.push({
      ...g,
      dayId: g.pinned.dayId,
      dayVenueId: g.pinned.dayVenueId,
      courtId: g.pinned.courtId,
      slotIdx: pos?.slotIdx ?? 0,
      startIso: g.pinned.startIso,
    })
  }

  /* ----------------------------- construction ------------------------------ */

  const feasible = (g: { teamAId: string; teamBId: string }, pos: GridPosition): boolean => {
    if (occupied[pos.idx]) return false
    for (const teamId of [g.teamAId, g.teamBId]) {
      if (teamBusy.has(`${teamId}|${pos.startMs}`)) return false
      const allow = cell.dayAllow[teamId]
      if (allow && !allow.includes(pos.dayId)) return false
    }
    return true
  }

  /** Marginal quadratic cost of adding this game at pos, plus the plain
   *  points added (for the stickiness threshold). */
  const evalAt = (
    g: { teamAId: string; teamBId: string },
    pos: GridPosition
  ): { quad: number; points: number } => {
    let quad = 0
    let points = 0
    for (const teamId of [g.teamAId, g.teamBId]) {
      const before = teamPoints(teamId)
      pushStop(teamId, pos)
      const after = teamPoints(teamId)
      popStop(teamId, pos.startMs)
      quad += (B(teamId) + after) ** 2 - (B(teamId) + before) ** 2
      points += after - before
    }
    return { quad, points }
  }

  const courtUseOf = (g: { teamAId: string; teamBId: string }, courtId: string): number =>
    (ledger.courtUse.get(`${g.teamAId}|${courtId}`) ?? 0) +
    (ledger.courtUse.get(`${g.teamBId}|${courtId}`) ?? 0)

  // Constrainedness order: day-locked, then window-requested, then most
  // burdened first (protect them), then canonical key.
  const constrainedRank = (g: (typeof unplaced)[number]): number => {
    const locked = cell.dayAllow[g.teamAId] || cell.dayAllow[g.teamBId] ? 0 : 1
    const windowed =
      (teamById.get(g.teamAId)?.windows.length ?? 0) + (teamById.get(g.teamBId)?.windows.length ?? 0) > 0
        ? 0
        : 1
    return locked * 2 + windowed
  }
  unplaced.sort((x, y) => {
    const r = constrainedRank(x) - constrainedRank(y)
    if (r !== 0) return r
    const bx = Math.max(B(x.teamAId), B(x.teamBId))
    const by = Math.max(B(y.teamAId), B(y.teamBId))
    if (bx !== by) return by - bx
    return gameKeyOf(x) < gameKeyOf(y) ? -1 : 1
  })

  const placements = new Map<string, GridPosition>() // gameKey -> pos
  const placedList: PlacedGame[] = []
  for (const g of unplaced) {
    let best: GridPosition | null = null
    let bestEval = { quad: Number.POSITIVE_INFINITY, points: Number.POSITIVE_INFINITY }
    for (const pos of grid) {
      if (!feasible(g, pos)) continue
      const e = evalAt(g, pos)
      if (best === null) {
        best = pos
        bestEval = e
        continue
      }
      if (e.quad < bestEval.quad) {
        best = pos
        bestEval = e
        continue
      }
      if (e.quad > bestEval.quad) continue
      // Canonical tie-breaks: earlier day; slot closest to the day middle
      // (then earlier); the court these teams have used least (S7); court
      // order; venue id.
      const mid = (p: GridPosition) => Math.abs(p.slotIdx * 2 - (p.slotCount - 1))
      const t =
        pos.dayOrder - best.dayOrder ||
        mid(pos) - mid(best) ||
        pos.slotIdx - best.slotIdx ||
        courtUseOf(g, pos.courtId) - courtUseOf(g, best.courtId) ||
        (pos.courtId < best.courtId ? -1 : pos.courtId > best.courtId ? 1 : 0) ||
        (pos.dayVenueId < best.dayVenueId ? -1 : 1)
      if (t < 0) {
        best = pos
        bestEval = e
      }
    }
    if (!best) {
      // L1 verified fit, so this is the §6.11 escape hatch, stage 1:
      // first-fit any free slot ignoring soft costs.
      best = grid.find((p) => feasible(g, p)) ?? null
      if (best) bestEval = evalAt(g, best)
    }
    if (!best) {
      // Stage 2 (completion repair): every free slot clashes with this
      // game's teams — evict an occupant whose game can relocate to a free
      // feasible slot, and take its place. Deterministic first success.
      for (const pos of grid) {
        if (!occupied[pos.idx]) continue
        let clash = false
        for (const teamId of [g.teamAId, g.teamBId]) {
          if (teamBusy.has(`${teamId}|${pos.startMs}`)) clash = true
          const allow = cell.dayAllow[teamId]
          if (allow && !allow.includes(pos.dayId)) clash = true
        }
        if (clash) continue
        const occIdx = placedList.findIndex((x) => {
          const xp = placements.get(gameKeyOf(x))
          return xp !== undefined && xp.idx === pos.idx
        })
        if (occIdx < 0) continue // a pin — never evicted
        const occupant = placedList[occIdx]
        // Free the slot, look for a new home for the occupant.
        const freeSlot = placements.get(gameKeyOf(occupant))!
        occupied[freeSlot.idx] = false
        for (const teamId of [occupant.teamAId, occupant.teamBId]) {
          teamBusy.delete(`${teamId}|${freeSlot.startMs}`)
          popStop(teamId, freeSlot.startMs)
        }
        placements.delete(gameKeyOf(occupant))
        const newHome = grid.find((p) => p.idx !== pos.idx && feasible(occupant, p))
        if (!newHome) {
          // Put the occupant back and try the next slot.
          occupied[freeSlot.idx] = true
          for (const teamId of [occupant.teamAId, occupant.teamBId]) {
            teamBusy.add(`${teamId}|${freeSlot.startMs}`)
            pushStop(teamId, freeSlot)
          }
          placements.set(gameKeyOf(occupant), freeSlot)
          continue
        }
        occupied[newHome.idx] = true
        for (const teamId of [occupant.teamAId, occupant.teamBId]) {
          teamBusy.add(`${teamId}|${newHome.startMs}`)
          pushStop(teamId, newHome)
        }
        placements.set(gameKeyOf(occupant), newHome)
        placedList[occIdx] = {
          ...occupant,
          dayId: newHome.dayId,
          dayVenueId: newHome.dayVenueId,
          courtId: newHome.courtId,
          slotIdx: newHome.slotIdx,
          startIso: newHome.startIso,
        }
        best = pos
        bestEval = evalAt(g, pos)
        break
      }
      if (!best) continue // reported by season.ts as unplaced — engine bug
    }
    // Draft stickiness: keep the previous position unless the winner beats
    // it by more than keepTheta points.
    const prev = prevPositions.get(gameKeyOf(g))
    if (prev) {
      const prevPos = grid.find(
        (p) => p.courtId === prev.courtId && p.startIso === prev.startIso && p.dayId === prev.dayId
      )
      if (prevPos && feasible(g, prevPos)) {
        const e = evalAt(g, prevPos)
        if (e.points - bestEval.points <= keepTheta) {
          best = prevPos
          bestEval = e
        }
      }
    }
    occupied[best.idx] = true
    for (const teamId of [g.teamAId, g.teamBId]) {
      teamBusy.add(`${teamId}|${best.startMs}`)
      pushStop(teamId, best)
    }
    placements.set(gameKeyOf(g), best)
    placedList.push({
      ...g,
      dayId: best.dayId,
      dayVenueId: best.dayVenueId,
      courtId: best.courtId,
      slotIdx: best.slotIdx,
      startIso: best.startIso,
    })
  }

  /* --------------------------------- repair -------------------------------- */

  const objective = (teamIds: Iterable<string>): number => {
    let f = 0
    for (const id of teamIds) f += (B(id) + teamPoints(id)) ** 2
    return f
  }
  const unplace = (gi: number) => {
    const g = placedList[gi]
    const from = placements.get(gameKeyOf(g))
    if (!from) return
    occupied[from.idx] = false
    for (const teamId of [g.teamAId, g.teamBId]) {
      teamBusy.delete(`${teamId}|${from.startMs}`)
      popStop(teamId, from.startMs)
    }
    placements.delete(gameKeyOf(g))
  }
  const place = (gi: number, to: GridPosition) => {
    const g = placedList[gi]
    occupied[to.idx] = true
    for (const teamId of [g.teamAId, g.teamBId]) {
      teamBusy.add(`${teamId}|${to.startMs}`)
      pushStop(teamId, to)
    }
    placements.set(gameKeyOf(g), to)
    placedList[gi] = {
      ...g,
      dayId: to.dayId,
      dayVenueId: to.dayVenueId,
      courtId: to.courtId,
      slotIdx: to.slotIdx,
      startIso: to.startIso,
    }
  }

  for (let accepted = 0; accepted < 200; accepted++) {
    let bestDelta = 0
    let bestAction: (() => void) | null = null

    for (let gi = 0; gi < placedList.length; gi++) {
      const g = placedList[gi]
      const from = placements.get(gameKeyOf(g))!
      const affected = [g.teamAId, g.teamBId]
      const before = objective(affected)
      // Relocate to any free feasible position.
      unplace(gi)
      for (const pos of grid) {
        if (pos.idx === from.idx || !feasible(g, pos)) continue
        place(gi, pos)
        const delta = objective(affected) - before
        unplace(gi)
        if (delta < bestDelta) {
          bestDelta = delta
          const target = pos
          const at = gi
          bestAction = () => {
            unplace(at)
            place(at, target)
          }
        }
      }
      place(gi, from)
      // Swap with a later game: unplace both, re-place crossed. The
      // unplace/replace dance makes feasibility checks exact (each game
      // sees the world without the other), and revert is symmetric.
      for (let gj = gi + 1; gj < placedList.length; gj++) {
        const h = placedList[gj]
        const to = placements.get(gameKeyOf(h))!
        const four = [...new Set([g.teamAId, g.teamBId, h.teamAId, h.teamBId])]
        const before4 = objective(four)
        unplace(gi)
        unplace(gj)
        const okSwap = feasible(placedList[gi], to) && (place(gi, to), feasible(placedList[gj], from))
        if (!okSwap) {
          // Revert whatever happened.
          if (placements.has(gameKeyOf(placedList[gi]))) unplace(gi)
          place(gi, from)
          place(gj, to)
          continue
        }
        place(gj, from)
        const delta = objective(four) - before4
        unplace(gi)
        unplace(gj)
        place(gi, from)
        place(gj, to)
        if (delta < bestDelta) {
          bestDelta = delta
          const a = gi
          const b = gj
          const pa = to
          const pb = from
          bestAction = () => {
            unplace(a)
            unplace(b)
            place(a, pa)
            place(b, pb)
          }
        }
      }
    }
    if (!bestAction) break
    bestAction()
  }

  /* --------------------------------- result -------------------------------- */

  const counts = new Map<string, BurdenCounts>()
  const cellTeams = new Set<string>()
  for (const g of [...pinnedGames, ...placedList]) {
    cellTeams.add(g.teamAId)
    cellTeams.add(g.teamBId)
  }
  for (const teamId of cellTeams) {
    const t = teamById.get(teamId)!
    counts.set(teamId, weekendCounts(stopsOf.get(teamId) ?? [], t, slotMinutes))
  }
  for (const teamId of cellTeams) {
    if (!counts.has(teamId)) counts.set(teamId, zeroCounts())
  }

  const games = [...pinnedGames, ...placedList].sort((x, y) =>
    x.startIso < y.startIso
      ? -1
      : x.startIso > y.startIso
        ? 1
        : x.courtId < y.courtId
          ? -1
          : 1
  )
  return { placed: { weekendId: cell.weekendId, gymId: cell.gymId, games }, counts }
}

export { addCounts }
