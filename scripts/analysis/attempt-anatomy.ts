/**
 * WHY DID +10% HOURS "MAKE SPLITS WORSE"? (owner challenge, 2026-08-07)
 *
 * In theory more capacity can never hurt. This probe taps every internal
 * attempt of generateSchedule for the baseline and the +10%-hours variant
 * and prints each candidate's REAL burden numbers next to the selection key
 * the judge actually used — so we can see whether a better-on-splits
 * candidate existed and lost the selection. Read-only; reuses the slack
 * experiment's input builders.
 */
import { loadSchedulerInput } from "../../apps/web/src/lib/scheduler/load"
import { generateSchedule, type ProposedGame, type SchedulerInput } from "../../apps/web/src/lib/scheduler/generate"

const SEASON = "160b2f09-a95a-4a64-9b90-03793cae105b"

function burdens(games: ProposedGame[], slotMin: number) {
  const byTd = new Map<string, { ts: number[]; venues: Set<string> }>()
  for (const g of games) {
    const d = new Date(g.scheduledAt)
    const dk = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    for (const id of [g.homeTeamId, g.awayTeamId]) {
      const k = `${id}|${dk}`
      if (!byTd.has(k)) byTd.set(k, { ts: [], venues: new Set() })
      byTd.get(k)!.ts.push(d.getTime())
      byTd.get(k)!.venues.add(g.venueId)
    }
  }
  let splits = 0
  let b2b = 0
  let monster = 0
  for (const { ts, venues } of byTd.values()) {
    if (venues.size > 1) splits++
    ts.sort((a, b) => a - b)
    for (let i = 1; i < ts.length; i++) {
      const gap = (ts[i] - ts[i - 1]) / (slotMin * 60000) - 1
      if (gap <= 0) b2b++
      else if (gap > 4) monster++
    }
  }
  return { splits, b2b, monster }
}

// +10% hours variant: same arithmetic the slack experiment used.
function extendHours(input: SchedulerInput, extraSlotsPerDay: number): SchedulerInput {
  const slot = input.gameSlotMinutes
  const clone: SchedulerInput = JSON.parse(JSON.stringify(input), (key, value) => {
    if ((key === "startAt" || key === "endAt" || key === "scheduledAt" || key === "date") && typeof value === "string") {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) return d
    }
    return value
  })
  for (const sess of clone.sessions) {
    for (const day of sess.days) {
      for (const dv of day.dayVenues) {
        const close = dv.endTime ?? clone.defaultVenueCloseTime
        const [h, m] = String(close).split(":").map(Number)
        const mins = h * 60 + m + extraSlotsPerDay * slot
        dv.endTime = `${String(Math.min(23, Math.floor(mins / 60))).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`
      }
    }
  }
  return clone
}

async function main() {
  const { input, errors } = await loadSchedulerInput(SEASON)
  if (!input) throw new Error(errors.join("; "))
  input.existingGames = []

  for (const [label, variant] of [
    ["baseline", input],
    ["+1 slot/day (~10%)", extendHours(input, 1)],
  ] as const) {
    console.log(`\n=== ${label} — every internal attempt ===`)
    console.log("attempt | key [unsched,b2b,req,style,spread,tradeoffs] | splits | monster")
    const probe: SchedulerInput = { ...variant }
    probe.debugAttempt = (k, games, key) => {
      const b = burdens(games, probe.gameSlotMinutes)
      console.log(
        `   ${k}    | [${key.join(",")}] | ${String(b.splits).padStart(4)} | ${String(b.monster).padStart(4)}`
      )
    }
    const winner = generateSchedule(probe)
    const wb = burdens(winner.games, probe.gameSlotMinutes)
    console.log(`WINNER: splits ${wb.splits} · b2b ${wb.b2b} · monster ${wb.monster}`)
  }
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
