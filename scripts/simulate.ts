/**
 * Volume simulation — a realistic populated universe, generated directly
 * through the world builders (Prisma), never the UI. (Owner requirement,
 * 2026-07-03: simulate hundreds of clubs, thousands of players/parents,
 * referees, multiple leagues with clubs in several at once.)
 *
 * Names are realistic (no test-namespace prefixes) so the data reads like a
 * real deployment when browsing the app. Every user shares the password
 * TestPass123!. Teardown stays exact: users/tenants are namespaced by the
 * seed-derived runId under the hood (emails end @<runId>.world).
 *
 *   npx tsx scripts/simulate.ts --clubs 50 --families 300 --referees 25 --leagues 3
 *   npx tsx scripts/simulate.ts --summary            # counts for the default seed
 *   npx tsx scripts/simulate.ts --wipe               # tear the world down
 *
 * Options: --seed N (default 7777 — one namespace per seed), --concurrency N
 * (default 20). Roster families are created per submitted team on top of
 * --families, so player counts scale with clubs × leagues too.
 */

import { prisma } from "@youthbasketballhub/db"
import {
  createWorldContext,
  createClub,
  createLeague,
  createParentWithChildren,
  createReferee,
  createTryout,
  destroyWorld,
  submitTeamToSeason,
  type BuiltClub,
  type BuiltLeague,
  type WorldContext,
} from "@youthbasketballhub/test-worlds"

// ---------- CLI ----------

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = parseInt(process.argv[i + 1], 10)
  if (Number.isNaN(v)) throw new Error(`--${name} needs a number`)
  return v
}
const has = (name: string) => process.argv.includes(`--${name}`)

const SEED = arg("seed", 7777)
const CLUBS = arg("clubs", 25)
const FAMILIES = arg("families", 200)
const REFEREES = arg("referees", 15)
const LEAGUES = arg("leagues", 3)
const CONCURRENCY = arg("concurrency", 20)

const AGE_GROUPS = ["U10", "U12", "U14", "U16"]

// ---------- helpers ----------

async function inBatches<T>(count: number, make: (i: number) => Promise<T>, label: string) {
  const results: T[] = []
  for (let start = 0; start < count; start += CONCURRENCY) {
    const batch = Math.min(CONCURRENCY, count - start)
    results.push(...(await Promise.all(Array.from({ length: batch }, (_, j) => make(start + j)))))
    if ((start + batch) % 100 === 0 || start + batch === count) {
      console.log(`  ${label}: ${start + batch}/${count}`)
    }
  }
  return results
}

async function summarize(ctx: WorldContext) {
  const emailDomain = `@${ctx.runId}.world`
  const simUsers = await prisma.user.findMany({
    where: { email: { endsWith: emailDomain } },
    select: { id: true },
  })
  const simUserIds = simUsers.map((u) => u.id)
  const users = simUserIds.length
  const players = await prisma.player.count({ where: { parentId: { in: simUserIds } } })
  const tenants = await prisma.tenant.count({ where: { slug: { startsWith: `${ctx.runId}-` } } })
  const teams = await prisma.team.count({
    where: { tenant: { slug: { startsWith: `${ctx.runId}-` } } },
  })
  const referees = await prisma.refereeProfile.count({
    where: { userId: { in: simUserIds } },
  })
  const leagues = await prisma.league.count({ where: { ownerId: { in: simUserIds } } })
  const submissions = await prisma.teamSubmission.count({
    where: { season: { league: { ownerId: { in: simUserIds } } } },
  })
  console.log(
    `WORLD ${ctx.runId} (seed ${ctx.seed}):`,
    JSON.stringify({ users, players, tenants, teams, referees, leagues, submissions })
  )
  return users
}

// ---------- main ----------

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? ""
  if (/neon|amazonaws|vercel/i.test(dbUrl) && !has("force-remote")) {
    throw new Error("DATABASE_URL looks like production — refusing without --force-remote")
  }

  const ctx = createWorldContext(SEED, { realistic: true })

  if (has("summary")) {
    await summarize(ctx)
    return
  }

  if (has("wipe")) {
    console.log(`Wiping simulation world ${ctx.runId} (seed ${SEED})…`)
    await destroyWorld(ctx)
    const left = await summarize(ctx)
    console.log(left === 0 ? "WIPE CLEAN" : "WIPE INCOMPLETE — rows remain!")
    return
  }

  const t0 = Date.now()
  console.log(`Simulating into world ${ctx.runId} (seed ${SEED}) — wiping any previous run first…`)
  await destroyWorld(ctx)

  // 1. Clubs: 1–4 teams each, head coach on some, tryouts (with signups) on a third
  console.log(`Clubs: ${CLUBS}`)
  const clubs: BuiltClub[] = await inBatches(
    CLUBS,
    async (i) => {
      const teamCount = 1 + (ctx.next() % 4)
      const club = await createClub(ctx, {
        teams: Array.from({ length: teamCount }, (_, t) => ({
          ageGroup: AGE_GROUPS[(i + t) % AGE_GROUPS.length],
          headCoach: t === 0,
        })),
      })
      if (i % 3 === 0) {
        await createTryout(ctx, {
          tenantId: club.tenantId,
          teamId: club.teams[0].id,
          capacity: 20,
          signups: 2 + (ctx.next() % 5),
          published: true,
        })
      }
      return club
    },
    "clubs"
  )

  // 2. Unattached families (browse the marketplace, sign up to tryouts later)
  console.log(`Families: ${FAMILIES}`)
  await inBatches(
    FAMILIES,
    (i) =>
      createParentWithChildren(ctx, {
        children: Array.from({ length: 1 + (i % 3) }, (_, c) => ({
          age: 7 + ((i + c * 3) % 11),
          gender: (i + c) % 2 === 0 ? "MALE" : "FEMALE",
        })),
      }),
    "families"
  )

  // 3. Referees
  console.log(`Referees: ${REFEREES}`)
  await inBatches(REFEREES, () => createReferee(ctx), "referees")

  // 4. Leagues: seasons in REGISTRATION, divisions but NO feeder teams —
  //    real sim clubs submit instead, several leagues per club.
  console.log(`Leagues: ${LEAGUES}`)
  const leagues: BuiltLeague[] = []
  for (let l = 0; l < LEAGUES; l++) {
    leagues.push(
      await createLeague(ctx, {
        seasons: [
          {
            status: "REGISTRATION",
            divisions: AGE_GROUPS.slice(0, 2 + (l % 3)).map((ag) => ({ ageGroup: ag, teams: 0 })),
            venue: { courts: 2 },
            gamesGuaranteed: 3,
          },
        ],
      })
    )
  }

  // 5. Club → league submissions: each club joins 1–3 leagues, one team per
  //    matching division. Roster families are created per submitted team.
  console.log(`Submissions (clubs joining leagues)…`)
  let submitted = 0
  for (let i = 0; i < clubs.length; i++) {
    const club = clubs[i]
    const joins = 1 + (ctx.next() % Math.min(3, leagues.length))
    for (let j = 0; j < joins; j++) {
      const league = leagues[(i + j) % leagues.length]
      const season = league.seasons[0]
      const division = season.divisions[(i + j) % season.divisions.length]
      await submitTeamToSeason(ctx, {
        seasonId: season.id,
        divisionId: division.id,
        tenantId: club.tenantId,
        ageGroup: division.ageGroup,
        seasonLabel: season.label,
        rosterSize: 8 + (ctx.next() % 3),
        status: ctx.next() % 5 === 0 ? "PENDING" : "APPROVED",
      })
      submitted++
    }
    if ((i + 1) % 10 === 0) console.log(`  submissions: club ${i + 1}/${clubs.length}`)
  }
  console.log(`  submissions: ${submitted} teams across ${leagues.length} leagues`)

  await summarize(ctx)
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s.`)
  console.log(`Log in as any generated user with password TestPass123!`)
  console.log(`  a club owner:  ${clubs[0].owner.email}`)
  console.log(`  a league owner: ${leagues[0].owner.email}`)
  console.log(`Tear down with: npx tsx scripts/simulate.ts --wipe --seed ${SEED}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
