/**
 * Backfill: name the HOME gym of every season — venue model v2 (owner ruling
 * 2026-08-03, "fill order is dead").
 *
 * SeasonVenue.role arrives defaulted to "pool", which is the safe default (a
 * gym costs money until somebody says otherwise) but the wrong answer for
 * every season that already exists: they all have a building the league owns,
 * and without this every weekend reads as rented and the planner prices a
 * season it should be getting for free.
 *
 * The rule, which is the same translation the board applies to a plan snapshot
 * saved under the old model: THE GYM THAT FILLED FIRST IS THE ONE THEY OWN.
 *   1. fillOrder = 0 (the league's own "fill this first"), else
 *   2. isPrimary  (the older flag that meant the same thing), else
 *   3. the gym with the LOWEST non-null fillOrder, else
 *   4. nothing — a season whose gyms nobody ever ordered keeps renting
 *      everything, because guessing which building a league owns would be
 *      worse than leaving the operator one thing to tick.
 *
 * Idempotent, and it never overwrites an answer: a season that already names a
 * home gym is left exactly as it is.
 *
 * Usage:
 *   export PATH="/usr/local/opt/node@18/bin:$PATH"
 *   npx tsx scripts/backfill-venue-roles.ts               # local DB
 *   npx tsx scripts/backfill-venue-roles.ts --dry         # say, do nothing
 *   DATABASE_URL="postgresql://..." npx tsx scripts/backfill-venue-roles.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

interface Link {
  id: string
  venueId: string
  role: string
  fillOrder: number | null
  isPrimary: boolean
  venue: { name: string }
}

/** Which of a season's gyms is the one it owns, or null when nothing says. */
function homeOf(links: Link[]): Link | null {
  const zero = links.find((l) => l.fillOrder === 0)
  if (zero) return zero
  const primary = links.find((l) => l.isPrimary)
  if (primary) return primary
  const ordered = links
    .filter((l) => l.fillOrder !== null)
    .sort((a, b) => (a.fillOrder as number) - (b.fillOrder as number))
  return ordered[0] ?? null
}

async function main(): Promise<void> {
  const dry = process.argv.includes("--dry")
  const seasons = await prisma.season.findMany({
    where: { seasonVenues: { some: {} } },
    select: {
      id: true,
      label: true,
      league: { select: { name: true } },
      seasonVenues: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          venueId: true,
          role: true,
          fillOrder: true,
          isPrimary: true,
          venue: { select: { name: true } },
        },
      },
    },
  })

  let named = 0
  let already = 0
  let unclear = 0
  for (const season of seasons) {
    const links = season.seasonVenues as Link[]
    const where = `${season.league?.name ?? "?"} / ${season.label ?? season.id}`
    if (links.some((l) => l.role === "home")) {
      already++
      continue
    }
    const home = homeOf(links)
    if (!home) {
      unclear++
      console.log(`  ~ ${where}: nothing says which gym they own, left renting everything`)
      continue
    }
    console.log(`  → ${where}: ${home.venue.name} is the home gym`)
    if (!dry) {
      await prisma.$transaction([
        prisma.seasonVenue.updateMany({
          where: { seasonId: season.id, id: { not: home.id } },
          data: { role: "pool" },
        }),
        prisma.seasonVenue.update({ where: { id: home.id }, data: { role: "home" } }),
      ])
    }
    named++
  }

  console.log(
    `\n${dry ? "[dry] " : ""}${named} season${named === 1 ? "" : "s"} given a home gym · ` +
      `${already} already had one · ${unclear} left renting everything`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
