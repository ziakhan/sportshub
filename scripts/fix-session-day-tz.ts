/**
 * QA T-015 heal: SeasonSessionDay rows stored at UTC MIDNIGHT read a day
 * early under TZ=America/Toronto (local rendering says Friday for a Saturday
 * row) and land engine slots on the wrong local day (the engine sets slot
 * times with local setHours — the runbook #81 gotcha). The law since #81:
 * day rows are LOCAL-midnight instants.
 *
 * This shifts every exact-UTC-midnight row to local midnight of the SAME UTC
 * calendar day (the intended one — labels and grid keys read UTC parts, so
 * the calendar day is unambiguous). Rows already at local midnight are left
 * alone. Games are untouched: Game.scheduledAt is its own instant and the
 * demo worlds' games already sit on the right local days.
 *
 * Usage (LOCAL ONLY, refuses remote hosts):
 *   TZ=America/Toronto npx tsx scripts/fix-session-day-tz.ts          # dry run
 *   TZ=America/Toronto npx tsx scripts/fix-session-day-tz.ts --apply
 */
import { PrismaClient } from "@prisma/client"

const APPLY = process.argv.includes("--apply")

const prisma = new PrismaClient()

async function main() {
  if (process.env.TZ !== "America/Toronto") {
    console.error("Run with TZ=America/Toronto — the heal writes local-midnight instants.")
    process.exit(1)
  }
  const url = process.env.DATABASE_URL ?? ""
  const host = url.match(/@([^/:]+)/)?.[1] ?? "localhost"
  const [{ current_database: db }] = (await prisma.$queryRaw`SELECT current_database()`) as any[]
  console.log(`Database: ${db} @ ${host} (${APPLY ? "APPLY" : "dry run"})`)
  if (host !== "localhost" && host !== "127.0.0.1") {
    console.error("This heal is LOCAL ONLY. Refusing to touch a remote database.")
    process.exit(1)
  }

  const days = (await (prisma as any).seasonSessionDay.findMany({
    select: {
      id: true,
      date: true,
      session: {
        select: { label: true, season: { select: { label: true, league: { select: { name: true } } } } },
      },
    },
    orderBy: { date: "asc" },
  })) as any[]

  const bySeason = new Map<string, number>()
  let shifted = 0
  for (const d of days) {
    const at: Date = d.date
    // Only rows stored at exactly UTC midnight are the drifted convention.
    if (at.getUTCHours() !== 0 || at.getUTCMinutes() !== 0 || at.getUTCSeconds() !== 0) continue
    const local = new Date(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())
    if (local.getTime() === at.getTime()) continue // TZ=UTC would make these equal
    const key = `${d.session.season.league.name} · ${d.session.season.label}`
    bySeason.set(key, (bySeason.get(key) ?? 0) + 1)
    shifted++
    if (APPLY) {
      await (prisma as any).seasonSessionDay.update({ where: { id: d.id }, data: { date: local } })
    }
  }

  for (const [season, count] of bySeason) console.log(`  ${season}: ${count} day rows`)
  console.log(
    `${APPLY ? "Shifted" : "Would shift"} ${shifted} of ${days.length} day rows to local midnight.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
