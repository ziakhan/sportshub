/**
 * Nightly demo-world reset (limited-launch design §"Population mechanics"):
 * rebuild the frozen world, purge session-scoped visitor actions, return
 * the carousel pool to SCHEDULED. Everything it calls is isDemo-guarded.
 *
 *   npx tsx scripts/demo-world-reset.ts
 *
 * Cron (box, once deployed — America/Toronto):
 *   0 3 * * * cd /opt/sportshub && npx tsx scripts/demo-world-reset.ts >> /var/log/sportshub/demo-reset.log 2>&1
 *
 * The carousel loop (`npx tsx scripts/live-carousel.ts --loop`) picks the
 * rebuilt pool up on its next tick — no restart needed.
 */
import { execFileSync } from "child_process"
import path from "path"

async function main() {
  const root = path.resolve(__dirname, "..")
  const run = (args: string[]) =>
    execFileSync("npx", ["tsx", ...args], { cwd: root, stdio: "inherit" })

  console.log("[reset] carousel → SCHEDULED")
  run(["scripts/live-carousel.ts", "--reset"])

  console.log("[reset] rebuilding demo world")
  run(["scripts/seed-demo-world.ts"])

  console.log("[reset] purging session overlay")
  const { purgeDemoActions } = await import("../apps/web/src/lib/demo/session-overlay")
  const purged = await purgeDemoActions(0)
  console.log(`[reset] purged ${purged.count} session actions`)

  console.log("[reset] done")
  process.exit(0)
}

main().catch((e) => {
  console.error("[reset] FAILED:", e)
  process.exit(1)
})
