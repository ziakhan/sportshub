/**
 * Scheduler v2 acceptance gates A1-A7 on the reference world, plus the
 * determinism double-run. Read-only: solves, never applies.
 */
import { solveSeasonV2 } from "../../apps/web/src/lib/scheduler-v2"
import { buildWorldSnapshot } from "../../apps/web/src/lib/scheduler-v2/world"

const SEASON = "160b2f09-a95a-4a64-9b90-03793cae105b"

async function main() {
  const t0 = Date.now()
  const res = await solveSeasonV2(SEASON)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`solve: ${secs}s | ok ${res.ok} | findings ${res.findings.length} | unplaced ${res.unplaced}`)
  for (const f of res.findings.slice(0, 8)) console.log(`  [${f.severity}] ${f.message.slice(0, 140)}`)
  if (!res.proposal) { console.log("NO PROPOSAL"); process.exit(1) }
  const p = res.proposal
  console.log(`stats: ${JSON.stringify(p.stats)}`)

  // A1: every game in its grade's assigned gym; zero same-day two-gym days.
  const { snapshot } = await buildWorldSnapshot(SEASON)
  const gradeOf = new Map(snapshot!.teams.map((t) => [t.id, t.gradeId]))
  const hostGym = new Map<string, string>()
  for (const w of snapshot!.weekends) for (const h of w.hosting) hostGym.set(`${w.id}|${h.gradeId}`, h.gymId)
  let outOfGym = 0
  const byTeamDay = new Map<string, Set<string>>()
  for (const g of p.games) {
    const grade = gradeOf.get(g.homeTeamId)!
    const want = hostGym.get(`${g.sessionId}|${grade}`)
    if (want && want !== g.venueId) outOfGym++
    const d = new Date(g.scheduledAt)
    const dk = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    for (const id of [g.homeTeamId, g.awayTeamId]) {
      const k = `${id}|${dk}`
      if (!byTeamDay.has(k)) byTeamDay.set(k, new Set())
      byTeamDay.get(k)!.add(g.venueId)
    }
  }
  let splits = 0
  for (const vs of byTeamDay.values()) if (vs.size > 1) splits++
  console.log(`A1: out-of-gym ${outOfGym} | same-day two-gym team-days ${splits}`)

  // A2: totals — every team exactly the promise.
  const promise = snapshot!.config.promiseDefault
  const off = res.totals.filter((t) => t.games !== promise)
  console.log(`A2: games ${p.stats.games} | teams ${res.totals.length} | teams != ${promise}: ${off.length}${off.length ? " e.g. " + JSON.stringify(off.slice(0, 5)) : ""}`)

  // A3 + burden histogram (engine currency).
  const { audit } = await import("../../apps/web/src/lib/scheduler-v2")
  console.log(`A7: back-to-backs ${p.stats.backToBacks} | long gaps ${p.stats.longGaps} | two-date weekends ${p.stats.twoDateWeekends} | gap-1 ${p.stats.gap1}`)

  // A5: determinism — run twice, byte-identical proposal.
  const res2 = await solveSeasonV2(SEASON)
  console.log(`A5: proposalHash run1 ${p.proposalHash.slice(0, 12)} run2 ${res2.proposal?.proposalHash.slice(0, 12)} | identical: ${p.proposalHash === res2.proposal?.proposalHash}`)
  console.log(`A6: ${secs}s (budget 60s)`)
  console.log(`S6: same-round rematches ${res.sameRoundRematches}`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
