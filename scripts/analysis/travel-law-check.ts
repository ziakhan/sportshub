/**
 * Post-change measurement (owner rulings 2026-08-07): clean-sheet run on
 * the live world. Reports splits, tight splits (cross-gym gap < 2 slots),
 * per-team split distribution, monster/mid waits, b2b — before/after story
 * for the judge fix + travel law.
 */
import { loadSchedulerInput } from "../../apps/web/src/lib/scheduler/load"
import { generateSchedule, type ProposedGame } from "../../apps/web/src/lib/scheduler/generate"

const SEASON = "160b2f09-a95a-4a64-9b90-03793cae105b"

async function main() {
  const { input, errors } = await loadSchedulerInput(SEASON)
  if (!input) throw new Error(errors.join("; "))
  input.existingGames = []
  const t0 = Date.now()
  const res = generateSchedule(input)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  const slotMs = input.gameSlotMinutes * 60000

  const byTd = new Map<string, Array<{ t: number; v: string }>>()
  for (const g of res.games as ProposedGame[]) {
    const d = new Date(g.scheduledAt)
    const dk = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    for (const id of [g.homeTeamId, g.awayTeamId]) {
      const k = `${id}|${dk}`
      if (!byTd.has(k)) byTd.set(k, [])
      byTd.get(k)!.push({ t: d.getTime(), v: g.venueId })
    }
  }
  let splits = 0, tight = 0, monster = 0, mid = 0, b2b = 0
  const splitsByTeam = new Map<string, number>()
  for (const [k, list] of byTd) {
    const id = k.split("|")[0]
    list.sort((a, b) => a.t - b.t)
    if (new Set(list.map((x) => x.v)).size > 1) {
      splits++
      splitsByTeam.set(id, (splitsByTeam.get(id) ?? 0) + 1)
    }
    for (let i = 1; i < list.length; i++) {
      const gap = (list[i].t - list[i - 1].t) / slotMs - 1
      if (list[i].v !== list[i - 1].v) {
        if (gap < 2) tight++
        continue
      }
      if (gap <= 0) b2b++
      else if (gap > 4) monster++
      else if (gap > 2) mid++
    }
  }
  const dist = new Map<number, number>()
  for (const n of splitsByTeam.values()) dist.set(n, (dist.get(n) ?? 0) + 1)
  // Burden-score histogram exactly as the fairness table scores it.
  const per = new Map<string, { split: number; tight: number; b2b: number; monster: number; mid: number }>()
  const bump = (id: string, k: "split" | "tight" | "b2b" | "monster" | "mid") => {
    const o = per.get(id) ?? { split: 0, tight: 0, b2b: 0, monster: 0, mid: 0 }
    o[k]++
    per.set(id, o)
  }
  const teamIds = new Set<string>()
  for (const g of res.games) { teamIds.add(g.homeTeamId); teamIds.add(g.awayTeamId) }
  for (const [k, list] of byTd) {
    const id = k.split("|")[0]
    if (new Set(list.map((x) => x.v)).size > 1) bump(id, "split")
    for (let i = 1; i < list.length; i++) {
      const gap = (list[i].t - list[i - 1].t) / slotMs - 1
      if (list[i].v !== list[i - 1].v) { if (gap < 2) bump(id, "tight"); continue }
      if (gap <= 0) bump(id, "b2b")
      else if (gap > 4) bump(id, "monster")
      else if (gap > 2) bump(id, "mid")
    }
  }
  const hist: Record<string, number> = {}
  for (const id of teamIds) {
    const o = per.get(id) ?? { split: 0, tight: 0, b2b: 0, monster: 0, mid: 0 }
    const score = o.split * 20 + o.tight * 30 + o.monster * 8 + o.b2b * 5 + o.mid * 2
    const b = score === 0 ? "0" : score <= 10 ? "1-10" : score <= 20 ? "11-20" : score <= 40 ? "21-40" : "41+"
    hist[b] = (hist[b] ?? 0) + 1
  }
  console.log(`burden histogram: ${JSON.stringify(hist)}`)
  console.log(`games ${res.games.length} | unscheduled ${res.unscheduled.length} | ${secs}s`)
  console.log(`splits ${splits} | TIGHT (undriveable) ${tight} | b2b ${b2b} | monster ${monster} | mid ${mid}`)
  console.log(`split distribution (splits-per-team: teams): ${JSON.stringify(Object.fromEntries([...dist.entries()].sort()))}`)
  console.log(`teams with any split: ${splitsByTeam.size} of 145`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
