/**
 * Server-side v2 generate for one season (SEASON env): snapshot -> audit
 * -> solve -> apply, printing the shape and a weekday histogram (the TZ
 * proof). Used for the box's first v2 generation (owner-authorized deploy
 * night 2026-08-09); safe anywhere since the auditor gates all writes.
 */
import { solveSeasonV2, applyProposal } from "../../apps/web/src/lib/scheduler-v2"

async function main() {
  const seasonId = process.env.SEASON
  if (!seasonId) throw new Error("SEASON env required")
  const res = await solveSeasonV2(seasonId)
  for (const f of res.findings) console.log(`[${f.severity}] ${f.message.slice(0, 160)}`)
  if (!res.ok || !res.proposal) {
    console.log("REFUSED — nothing written.")
    process.exit(2)
  }
  await applyProposal(seasonId, res.proposal)
  const hist = new Map<string, number>()
  for (const g of res.proposal.games) {
    const day = new Date(g.scheduledAt).toLocaleDateString("en-CA", { weekday: "short" })
    hist.set(day, (hist.get(day) ?? 0) + 1)
  }
  console.log(`applied ${res.proposal.stats.games} games | b2b ${res.proposal.stats.backToBacks} | weekdays ${JSON.stringify([...hist.entries()])}`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
