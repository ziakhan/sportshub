/**
 * OWNER'S REFRAME (2026-08-08): "We put the whole grade in one gym at
 * planning. Why are games leaving it?" Tests, per (weekend, gym):
 *   1. Do the grades assigned to a gym actually FIT its court-slots?
 *   2. Are all splits caused by fallback games (games off their assigned gym)?
 *   3. Which fallbacks are REAL over-demand vs engine packing artifacts?
 */
import { loadSchedulerInput } from "../../apps/web/src/lib/scheduler/load"
import { generateSchedule, type ProposedGame } from "../../apps/web/src/lib/scheduler/generate"

const SEASON = "160b2f09-a95a-4a64-9b90-03793cae105b"

async function main() {
  const { input, errors } = await loadSchedulerInput(SEASON)
  if (!input) throw new Error(errors.join("; "))
  input.existingGames = []
  const res = generateSchedule(input)
  const slotMin = input.gameSlotMinutes

  // capacity per (session, venue): usable courts x slots across its days
  const capacity = new Map<string, number>()
  const minutes = (t: string | null, fallback: string) => {
    const [h, m] = String(t ?? fallback).split(":").map(Number)
    return h * 60 + m
  }
  for (const sess of input.sessions) {
    if (sess.phase !== "REGULAR") continue
    for (const day of sess.days) {
      for (const dv of day.dayVenues) {
        const open = minutes(dv.startTime, input.defaultVenueOpenTime)
        const close = minutes(dv.endTime, input.defaultVenueCloseTime)
        const slots = Math.max(0, Math.floor((close - open) / slotMin))
        const courts = Math.max(0, dv.courts.length - (input.courtBuffer ?? 0))
        const k = `${sess.id}|${dv.venueId}`
        capacity.set(k, (capacity.get(k) ?? 0) + slots * courts)
      }
    }
  }

  // demand per (session, unit) from the generated schedule
  const demand = new Map<string, number>()
  for (const g of res.games as ProposedGame[]) {
    const k = `${g.sessionId}|${g.unitKey}`
    demand.set(k, (demand.get(k) ?? 0) + 1)
  }

  const va = input.venueAssignments ?? {}
  // Resolve EXACTLY like the engine's assignedVenue: assignments are keyed
  // by DIVISION id; a unit maps to its divisions, and a group whose
  // divisions were sent to different gyms has no one gym.
  const divisionsOfUnit = new Map<string, string[]>()
  for (const d of input.divisions) divisionsOfUnit.set(`division:${d.id}`, [d.id])
  for (const grp of input.schedulingGroups) divisionsOfUnit.set(`group:${grp.id}`, grp.divisionIds)
  const resolve = (sid: string, unitKey: string): string | null => {
    const per = va[sid]
    let out: string | null = null
    const divs = divisionsOfUnit.get(unitKey) ?? (unitKey.startsWith("division:") ? [unitKey.slice(9)] : [])
    for (const div of divs) {
      const v = per?.[div]
      if (!v) continue
      if (out === null) out = v
      else if (out !== v) return null
    }
    return out
  }
  let unassignedCells = 0
  let fallbacks = 0
  let fallbacksInFittingCells = 0
  let overCells: string[] = []
  const cellDemand = new Map<string, number>() // session|venue -> games assigned there by plan
  for (const [k, n] of demand) {
    const [sid, unit] = k.split("|")
    const v = resolve(sid, unit)
    if (!v) { unassignedCells++; continue }
    const ck = `${sid}|${v}`
    cellDemand.set(ck, (cellDemand.get(ck) ?? 0) + n)
  }
  const overSet = new Set<string>()
  for (const [ck, dem] of cellDemand) {
    const cap = capacity.get(ck) ?? 0
    if (dem > cap) { overSet.add(ck); overCells.push(`${ck.slice(0, 8)}… demand ${dem} > capacity ${cap}`) }
  }
  const sessLabel = new Map(input.sessions.map((s) => [s.id, s.label ?? s.id.slice(0, 8)]))
  for (const g of res.games as ProposedGame[]) {
    const want = resolve(g.sessionId, g.unitKey)
    if (want && want !== g.venueId) {
      fallbacks++
      if (!overSet.has(`${g.sessionId}|${want}`)) fallbacksInFittingCells++
    }
  }

  // splits: every split day should involve >=1 fallback game
  const byTd = new Map<string, ProposedGame[]>()
  for (const g of res.games as ProposedGame[]) {
    const d = new Date(g.scheduledAt)
    const dk = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    for (const id of [g.homeTeamId, g.awayTeamId]) {
      const k = `${id}|${dk}`
      if (!byTd.has(k)) byTd.set(k, [])
      byTd.get(k)!.push(g)
    }
  }
  let splitDays = 0
  let splitDaysWithFallback = 0
  for (const list of byTd.values()) {
    if (new Set(list.map((g) => g.venueId)).size < 2) continue
    splitDays++
    if (list.some((g) => (resolve(g.sessionId, g.unitKey) ?? g.venueId) !== g.venueId)) splitDaysWithFallback++
  }

  console.log(`grade-weekend cells with NO assigned gym: ${unassignedCells}`)
  console.log(`plan cells where assigned grades EXCEED the gym: ${overSet.size}`)
  for (const line of overCells.slice(0, 10)) console.log(`   OVER: ${line}`)
  console.log(`fallback games (left their assigned gym): ${fallbacks}`)
  console.log(`   ...of which in cells that DID fit (engine artifacts): ${fallbacksInFittingCells}`)
  console.log(`split team-days: ${splitDays} | involving a fallback game: ${splitDaysWithFallback}`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
