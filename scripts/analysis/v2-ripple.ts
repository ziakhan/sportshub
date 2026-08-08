/** A4: drop one team, measure the ripple. Read-only (solve, never apply). */
import { solveSeasonV2 } from "../../apps/web/src/lib/scheduler-v2"

const SEASON = "160b2f09-a95a-4a64-9b90-03793cae105b"

async function main() {
  const base = await solveSeasonV2(SEASON)
  if (!base.proposal) throw new Error("base solve failed")
  console.log(`base: ${JSON.stringify(base.proposal.stats)}`)

  // Drop the first team of the largest grade (deterministic pick).
  const victim = base.totals[0].teamId
  const dropped = await solveSeasonV2(SEASON, { excludedTeamIds: [victim] })
  if (!dropped.proposal) {
    console.log("dropped solve findings:", dropped.findings.map((f) => f.message))
    throw new Error("dropped solve failed")
  }
  const s = dropped.proposal.stats
  console.log(`dropped team ${victim.slice(0, 8)}…: ${JSON.stringify(s)}`)
  console.log(
    `A4 ripple: unchanged ${s.unchanged} of ${s.games} — changed ${s.updated + s.created + s.deleted} (upd ${s.updated} / new ${s.created} / del ${s.deleted})`
  )
  const short = dropped.totals.filter((t) => t.games !== 10)
  console.log(`teams not at 10 after drop: ${short.length} (their games: ${short.map((t) => t.games).slice(0, 8).join(",")})`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
