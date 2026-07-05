/**
 * SHOWCASE SEEDER — a living, realistic content universe on top of the REAL
 * imported Ontario clubs, so the public homepage demos the destination vision
 * (docs/public-site-content-plan.md §3).
 *
 * Creates: the "Ontario Youth Basketball League" (Winter 2026) across 12 real
 * clubs (branded colors), 4 divisions (U12/U14/U16 Boys + U14 Girls), 24
 * teams, 240 named players, 5 completed weekly rounds with full realistic
 * event streams (folded exactly like the finalize API), 2 LIVE games mid-3rd
 * quarter, next weekend's schedule, auto-generated recaps with photo covers,
 * YouTube highlight posts, public announcements, and a demo parent account
 * (showcase-parent@sportshub.test / TestPass123!) with two kids on rosters so
 * the signed-in "Your teams" rail lights up.
 *
 * Idempotent: re-running tears down the previous showcase world first (real
 * club tenants are never deleted — only the teams/league/users it created).
 * Also scrubs test-world noise ("[abc123] Team" names, bracket-titled posts)
 * from public surfaces.
 *
 *   npx tsx scripts/seed-showcase.ts
 */

import bcrypt from "bcryptjs"
import { prisma } from "@youthbasketballhub/db"
import { foldEvents, totalRebounds, type FoldEvent } from "../apps/web/src/lib/scoring/fold"
import { upsertGameRecap } from "../apps/web/src/lib/content/recap-service"

const LEAGUE_NAME = "Ontario Youth Basketball League"
const SEASON_LABEL = "Winter 2026"
const MARKER = "SHOWCASE_SEED"
const EMAIL_DOMAIN = "showcase.demo"
const PARENT_LOGIN = "showcase-parent@sportshub.test"
const PASSWORD = "TestPass123!"

// Real imported Ontario clubs (by slug) that field showcase teams
const CLUBS: Array<{ slug: string; shortName: string; color: string }> = [
  { slug: "scarborough-basketball-association-sba", shortName: "SBA", color: "#dc2626" },
  { slug: "416-united", shortName: "416 United", color: "#2563eb" },
  { slug: "canadian-basketball-academy-cba", shortName: "CBA", color: "#7c3aed" },
  { slug: "basketball-world-toronto-bwt", shortName: "BWT", color: "#ea580c" },
  { slug: "17-basketball-club", shortName: "17 Basketball", color: "#0d9488" },
  { slug: "lincoln-prep", shortName: "Lincoln Prep", color: "#4f46e5" },
  { slug: "windsor-suns", shortName: "Windsor Suns", color: "#f59e0b" },
  { slug: "trc-academy", shortName: "TRC Academy", color: "#16a34a" },
  { slug: "st-benedicts", shortName: "St. Benedicts", color: "#9333ea" },
  { slug: "gwillimbury-basketball-united", shortName: "Gwillimbury United", color: "#0891b2" },
  { slug: "f-o-r-m-basketball-academy", shortName: "FORM Academy", color: "#be123c" },
  { slug: "central-tech", shortName: "Central Tech", color: "#374151" },
]

// pace ≈ plays per quarter; tuned so per-team finals land in realistic
// ranges (U12 ~28–38, U14 ~36–48, U16 ~46–60)
const DIVISIONS = [
  { name: "U12 Boys", ageGroup: "U12", gender: "MALE" as const, pace: 20, birthYear: 2014 },
  { name: "U14 Boys", ageGroup: "U14", gender: "MALE" as const, pace: 26, birthYear: 2012 },
  { name: "U16 Boys", ageGroup: "U16", gender: "MALE" as const, pace: 32, birthYear: 2010 },
  { name: "U14 Girls", ageGroup: "U14", gender: "FEMALE" as const, pace: 24, birthYear: 2012 },
]

const VENUES = [
  { name: "Pan Am Sports Centre", address: "875 Morningside Ave", city: "Toronto" },
  { name: "Monarch Park Collegiate Gym", address: "1 Hanson St", city: "Toronto" },
  { name: "Humber Athletic Centre", address: "205 Humber College Blvd", city: "Etobicoke" },
  { name: "Bramalea Community Centre", address: "225 Central Park Dr", city: "Brampton" },
]

const BOY_NAMES = [
  "Liam", "Noah", "Jayden", "Ethan", "Marcus", "Malik", "Owen", "Lucas", "Mason", "Elijah",
  "Kai", "Aiden", "Josiah", "Xavier", "Isaiah", "Andre", "Devon", "Tyler", "Jordan", "Cameron",
  "Darius", "Amir", "Omar", "Ravi", "Arjun", "Wei", "Kevin", "Daniel", "Nathan", "Zion",
  "Trey", "Cole", "Miles", "Jaxon", "Theo", "Felix", "Santiago", "Mateo", "Ibrahim", "Yusuf",
]
const GIRL_NAMES = [
  "Maya", "Ava", "Zoe", "Aaliyah", "Sophia", "Olivia", "Emma", "Nia", "Jasmine", "Kayla",
  "Simone", "Priya", "Amara", "Leila", "Naomi", "Grace", "Chloe", "Sadie", "Imani", "Riley",
  "Skye", "Jade", "Mia", "Layla", "Serena", "Tiana", "Keisha", "Anika", "Mei", "Sofia",
]
const LAST_NAMES = [
  "Thompson", "Williams", "Chen", "Patel", "Singh", "Osei", "Diallo", "Nguyen", "Garcia",
  "Martinez", "Brown", "Wilson", "Campbell", "Grant", "Baptiste", "Charles", "Pierre",
  "Ahmed", "Hassan", "Ali", "Khan", "Kim", "Park", "Lee", "Wong", "Liu", "Sharma", "Gupta",
  "Okafor", "Mensah", "Boateng", "Silva", "Santos", "Rodriguez", "Taylor", "Anderson",
  "Jackson", "White", "Harris", "Robinson", "Clarke", "Lewis", "Walker", "Young", "Allen",
  "Wright", "Scott", "Green", "Baker", "Adams", "Morris", "Reid", "Murray", "Sinclair",
]

// Verified-live media (thumbnails checked 200 on 2026-07-05)
const HIGHLIGHT_VIDEOS = [
  { id: "DLgjY3EF_fo", title: "Tournament of Champions — Best Plays of the Weekend" },
  { id: "LGBsYRZ0jmU", title: "U16 Boys: SBA vs 416 United — Full Game Highlights" },
  { id: "QKvLqlGZEic", title: "Future Stars: U12 Development Division Top Plays" },
  { id: "2OYIiF2YwIs", title: "Saturday Showcase — Week 4 Around the League" },
  { id: "kmhxcuhYNjk", title: "Player Spotlight: Rising Stars of Winter 2026" },
  { id: "TmslsvOqTUU", title: "U14 Girls: CBA vs Lincoln Prep — Game of the Week" },
]
const COVER_PHOTOS = [
  "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&q=70",
  "https://images.unsplash.com/photo-1519861531473-9200262188bf?w=1200&q=70",
  "https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=1200&q=70",
  "https://images.unsplash.com/photo-1574623452334-1e0ac2b3ccb4?w=1200&q=70",
  "https://images.unsplash.com/photo-1608245449230-4ac19066d2d0?w=1200&q=70",
  "https://images.unsplash.com/photo-1519766304817-4f37bda74a26?w=1200&q=70",
]

// Deterministic RNG (mulberry32)
let rngState = 20260705
function rnd(): number {
  rngState |= 0
  rngState = (rngState + 0x6d2b79f5) | 0
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]

const p = prisma as any

async function cleanupPreviousShowcase() {
  const league = await p.league.findFirst({ where: { name: LEAGUE_NAME }, select: { id: true } })
  if (league) {
    const seasons = await p.season.findMany({ where: { leagueId: league.id }, select: { id: true } })
    const seasonIds = seasons.map((s: any) => s.id)
    const games = await p.game.findMany({ where: { seasonId: { in: seasonIds } }, select: { id: true } })
    const gameIds = games.map((g: any) => g.id)
    // Posts tagged to showcase games/league (recaps + highlights)
    const posts = await p.post.findMany({
      where: { OR: [{ tags: { some: { gameId: { in: gameIds } } } }, { tags: { some: { leagueId: league.id } } }] },
      select: { id: true },
    })
    await p.post.deleteMany({ where: { id: { in: posts.map((x: any) => x.id) } } })
    await p.game.deleteMany({ where: { id: { in: gameIds } } })
    await p.season.deleteMany({ where: { id: { in: seasonIds } } })
    await p.league.delete({ where: { id: league.id } })
  }
  // Showcase teams live on REAL tenants — marked via description
  await p.post.deleteMany({ where: { slug: { startsWith: "showcase-" } } })
  const users = await p.user.findMany({
    where: { OR: [{ email: { endsWith: `@${EMAIL_DOMAIN}` } }, { email: PARENT_LOGIN }] },
    select: { id: true },
  })
  const userIds = users.map((u: any) => u.id)
  await p.announcement.deleteMany({ where: { authorId: { in: userIds } } })
  await p.player.deleteMany({ where: { parentId: { in: userIds } } })
  await p.team.deleteMany({ where: { description: MARKER } })
  await p.user.deleteMany({ where: { id: { in: userIds } } })
  console.log("✓ previous showcase world removed")
}

async function scrubTestNoise() {
  // Bracket-titled recap posts from throwaway test worlds
  const noisy = await p.post.deleteMany({
    where: { OR: [{ title: { startsWith: "[" } }, { title: { contains: "Phase9to15" } }] },
  })
  // "[w1fka6j] Maplewood Falcons" → "Maplewood Falcons" on public surfaces
  const prefix = /^\[[^\]]+\]\s*/
  for (const model of ["team", "tenant"] as const) {
    const rows = await p[model].findMany({
      where: { name: { startsWith: "[" } },
      select: { id: true, name: true },
    })
    for (const row of rows) {
      try {
        await p[model].update({ where: { id: row.id }, data: { name: row.name.replace(prefix, "") } })
      } catch {
        /* unique collision — leave as-is */
      }
    }
  }
  console.log(`✓ test noise scrubbed (${noisy.count} bracket posts removed)`)
}

function makeName(gender: "MALE" | "FEMALE"): { firstName: string; lastName: string } {
  return {
    firstName: gender === "FEMALE" ? pick(GIRL_NAMES) : pick(BOY_NAMES),
    lastName: pick(LAST_NAMES),
  }
}

/** Realistic 4-quarter event stream; stars get double usage. */
function buildGameEvents(opts: {
  gameId: string
  homeTeamId: string
  awayTeamId: string
  homeRoster: string[]
  awayRoster: string[]
  pace: number
  startAt: Date
  homeEdge: number // 0.44..0.56 — slight quality difference between the sides
  throughPeriod?: number // for LIVE games
}) {
  const { gameId, homeTeamId, awayTeamId, homeRoster, awayRoster, pace, startAt, homeEdge } = opts
  const lastPeriod = opts.throughPeriod ?? 4
  let seq = 0
  const events: any[] = []
  const push = (e: any) =>
    events.push({
      gameId,
      eventType: e.eventType,
      teamId: e.teamId ?? null,
      playerId: e.playerId ?? null,
      made: e.made ?? null,
      period: e.period ?? null,
      sequence: ++seq,
      clientEventId: `showcase-${gameId.slice(0, 8)}-${seq}`,
      metadata: e.metadata ?? undefined,
      timestamp: new Date(startAt.getTime() + seq * 18_000),
    })

  push({ eventType: "ATTENDANCE", teamId: homeTeamId, metadata: { presentIds: homeRoster, absentIds: [] } })
  push({ eventType: "ATTENDANCE", teamId: awayTeamId, metadata: { presentIds: awayRoster, absentIds: [] } })
  push({ eventType: "LINEUP", teamId: homeTeamId, metadata: { playerIds: homeRoster.slice(0, 5) } })
  push({ eventType: "LINEUP", teamId: awayTeamId, metadata: { playerIds: awayRoster.slice(0, 5) } })

  const onFloor: Record<string, string[]> = {
    [homeTeamId]: homeRoster.slice(0, 5),
    [awayTeamId]: awayRoster.slice(0, 5),
  }
  // Stars = first two roster spots, weighted double when picking the shooter
  const weighted = (teamId: string) => {
    const five = onFloor[teamId]
    const pool = [...five, five[0], five[1]].filter(Boolean)
    return pick(pool)
  }

  for (let q = 1; q <= lastPeriod; q++) {
    push({ eventType: "PERIOD_START", period: q })
    const plays = pace + Math.floor(rnd() * 6)
    for (let i = 0; i < plays; i++) {
      const team = rnd() < homeEdge ? homeTeamId : awayTeamId
      const opp = team === homeTeamId ? awayTeamId : homeTeamId
      const shooter = weighted(team)
      const r = rnd()
      if (r < 0.5) {
        const made = rnd() < 0.5
        push({ eventType: "SCORE_2PT", teamId: team, playerId: shooter, made, period: q })
        if (made && rnd() < 0.55) {
          push({ eventType: "ASSIST", teamId: team, playerId: pick(onFloor[team].filter((x) => x !== shooter)), period: q })
        }
        if (!made) {
          const offensive = rnd() < 0.25
          push({
            eventType: "REBOUND",
            teamId: offensive ? team : opp,
            playerId: pick(onFloor[offensive ? team : opp]),
            period: q,
            metadata: { offensive },
          })
        }
      } else if (r < 0.64) {
        const made = rnd() < 0.33
        push({ eventType: "SCORE_3PT", teamId: team, playerId: shooter, made, period: q })
        if (!made) {
          push({ eventType: "REBOUND", teamId: opp, playerId: pick(onFloor[opp]), period: q, metadata: { offensive: false } })
        }
      } else if (r < 0.74) {
        push({ eventType: "FOUL", teamId: opp, playerId: pick(onFloor[opp]), period: q })
        push({ eventType: "SCORE_FT", teamId: team, playerId: shooter, made: rnd() < 0.66, period: q })
        push({ eventType: "SCORE_FT", teamId: team, playerId: shooter, made: rnd() < 0.66, period: q })
      } else if (r < 0.84) {
        push({ eventType: "TURNOVER", teamId: team, playerId: shooter, period: q })
        if (rnd() < 0.5) push({ eventType: "STEAL", teamId: opp, playerId: pick(onFloor[opp]), period: q })
      } else if (r < 0.92) {
        push({ eventType: "FOUL", teamId: team, playerId: shooter, period: q })
      } else if (r < 0.97) {
        push({ eventType: "BLOCK", teamId: opp, playerId: pick(onFloor[opp]), period: q })
      } else {
        push({ eventType: "STEAL", teamId: team, playerId: shooter, period: q })
      }
    }
    // Rotate two bench players in per team each quarter
    for (const [teamId, roster] of [
      [homeTeamId, homeRoster],
      [awayTeamId, awayRoster],
    ] as const) {
      for (let s = 0; s < 2; s++) {
        const five = onFloor[teamId]
        const bench = roster.filter((x) => !five.includes(x))
        if (bench.length === 0) continue
        const inP = bench[Math.floor(rnd() * bench.length)]
        const outP = five[2 + ((q + s) % 3)]
        onFloor[teamId] = five.map((x) => (x === outP ? inP : x))
        push({ eventType: "SUBSTITUTION", teamId, period: q, metadata: { inPlayerId: inP, outPlayerId: outP } })
      }
    }
    if (q < lastPeriod || lastPeriod === 4) push({ eventType: "PERIOD_END", period: q })
  }
  return events
}

/** Circle-method round robin: 6 teams → 5 rounds × 3 pairings. */
function roundRobin(teamIds: string[]): Array<Array<[string, string]>> {
  const n = teamIds.length
  const rounds: Array<Array<[string, string]>> = []
  const arr = [...teamIds]
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = []
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      pairs.push(r % 2 === 0 ? [a, b] : [b, a])
    }
    rounds.push(pairs)
    arr.splice(1, 0, arr.pop() as string)
  }
  return rounds
}

async function main() {
  console.log("— SHOWCASE SEEDER —")
  await cleanupPreviousShowcase()
  await scrubTestNoise()

  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  // ── Real clubs get branding ────────────────────────────────────────────
  const tenants: any[] = []
  for (const club of CLUBS) {
    const tenant = await p.tenant.findUnique({ where: { slug: club.slug }, select: { id: true, name: true, city: true } })
    if (!tenant) throw new Error(`Real club not found: ${club.slug} — check the imported clubs`)
    await p.tenantBranding.upsert({
      where: { tenantId: tenant.id },
      create: { tenantId: tenant.id, primaryColor: club.color },
      update: { primaryColor: club.color },
    })
    tenants.push({ ...tenant, ...club })
  }
  console.log(`✓ ${tenants.length} real clubs branded`)

  // ── League + season + divisions ────────────────────────────────────────
  const commissioner = await p.user.create({
    data: {
      email: `commissioner@${EMAIL_DOMAIN}`,
      passwordHash,
      firstName: "Dana",
      lastName: "Whitfield",
      onboardedAt: new Date(),
      city: "Toronto",
      state: "ON",
    },
  })
  const league = await p.league.create({
    data: {
      name: LEAGUE_NAME,
      description:
        "Ontario's competitive youth circuit — twelve clubs, four divisions, every game scored live with stats, standings and recaps.",
      ownerId: commissioner.id,
      statDepth: "STANDARD",
      periodType: "QUARTERS",
    },
  })
  await p.userRole.create({ data: { userId: commissioner.id, role: "LeagueOwner", leagueId: league.id } })

  const now = new Date()
  const season = await p.season.create({
    data: {
      leagueId: league.id,
      label: SEASON_LABEL,
      status: "IN_PROGRESS",
      startDate: new Date(now.getTime() - 42 * 86400_000),
      endDate: new Date(now.getTime() + 42 * 86400_000),
      gamePeriods: "QUARTERS",
    },
  })
  const divisions: any[] = []
  for (const d of DIVISIONS) {
    divisions.push({
      ...d,
      row: await p.division.create({
        data: { seasonId: season.id, name: d.name, ageGroup: d.ageGroup, gender: d.gender },
      }),
    })
  }
  console.log(`✓ league "${LEAGUE_NAME}" · ${SEASON_LABEL} · ${divisions.length} divisions`)

  // ── Venues (find-or-create; global) ────────────────────────────────────
  const venues: any[] = []
  for (const v of VENUES) {
    let venue = await p.venue.findFirst({ where: { name: v.name }, select: { id: true } })
    if (!venue) venue = await p.venue.create({ data: { ...v, state: "ON", country: "CA" } })
    venues.push(venue)
  }

  // ── Teams, players, parents, rosters ──────────────────────────────────
  // Each division gets 6 teams; each club fields exactly 2 teams overall.
  let parentSeq = 0
  const makeParent = async () =>
    p.user.create({
      data: {
        email: `parent-${++parentSeq}@${EMAIL_DOMAIN}`,
        passwordHash,
        firstName: pick(BOY_NAMES.concat(GIRL_NAMES)),
        lastName: pick(LAST_NAMES),
        onboardedAt: new Date(),
      },
      select: { id: true },
    })

  interface ShowTeam {
    id: string
    name: string
    tenantId: string
    divisionIdx: number
    roster: string[] // playerIds, index 0-1 are the stars
  }
  const teams: ShowTeam[] = []
  let clubCursor = 0
  for (let d = 0; d < divisions.length; d++) {
    const div = divisions[d]
    for (let t = 0; t < 6; t++) {
      const club = tenants[clubCursor % tenants.length]
      clubCursor++
      const teamName = `${club.shortName} ${div.ageGroup} ${div.gender === "FEMALE" ? "Girls" : "Boys"}`
      const team = await p.team.create({
        data: {
          tenantId: club.id,
          name: teamName,
          ageGroup: div.ageGroup,
          gender: div.gender,
          season: SEASON_LABEL,
          description: MARKER,
        },
      })
      const roster: string[] = []
      let parent = await makeParent()
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0 && i > 0) parent = await makeParent()
        const name = makeName(div.gender)
        const player = await p.player.create({
          data: {
            ...name,
            dateOfBirth: new Date(Date.UTC(div.birthYear, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28))),
            gender: div.gender,
            isMinor: true,
            parentId: parent.id,
            position: pick(["Guard", "Guard", "Forward", "Forward", "Center"]),
            // A third of parents opted into public full names (plan §11.1)
            mediaConsent: rnd() < 0.33 ? "GRANTED" : "UNSET",
          },
          select: { id: true },
        })
        roster.push(player.id)
        await p.teamPlayer.create({
          data: { teamId: team.id, playerId: player.id, jerseyNumber: [3, 4, 5, 7, 8, 10, 11, 12, 15, 21][i] },
        })
      }
      // League paper trail: submission + frozen roster
      const submission = await p.teamSubmission.create({
        data: { seasonId: season.id, divisionId: div.row.id, teamId: team.id, status: "APPROVED" },
      })
      await p.seasonRoster.create({
        data: {
          seasonId: season.id,
          teamSubmissionId: submission.id,
          isLocked: true,
          submittedAt: new Date(now.getTime() - 40 * 86400_000),
          lockedAt: new Date(now.getTime() - 38 * 86400_000),
          players: {
            create: roster.map((playerId, i) => ({ playerId, jerseyNumber: [3, 4, 5, 7, 8, 10, 11, 12, 15, 21][i] })),
          },
        },
      })
      teams.push({ id: team.id, name: teamName, tenantId: club.id, divisionIdx: d, roster })
    }
  }
  console.log(`✓ ${teams.length} teams · ${teams.length * 10} players rostered (frozen)`)

  // ── Games: 5 completed weekend rounds + live now + next weekend ───────
  const rosterOf = new Map(teams.map((t) => [t.id, t.roster]))
  const completedGameIds: string[] = []
  const liveGameIds: string[] = []

  const saturdayHours = [9, 10.5, 12, 13.5, 15, 16.5]
  for (let d = 0; d < divisions.length; d++) {
    const div = divisions[d]
    const divTeams = teams.filter((t) => t.divisionIdx === d).map((t) => t.id)
    const rounds = roundRobin(divTeams)

    for (let r = 0; r < rounds.length; r++) {
      // Round 0 = 5 weekends ago … round 4 = yesterday; round 5 (re-pairing of
      // round 0) = next weekend's schedule.
      const daysAgo = [29, 22, 15, 8, 1][r]
      for (let gIdx = 0; gIdx < rounds[r].length; gIdx++) {
        const [homeId, awayId] = rounds[r][gIdx]
        const startAt = new Date(now.getTime() - daysAgo * 86400_000)
        startAt.setHours(Math.floor(saturdayHours[gIdx % 6] + d), (saturdayHours[gIdx % 6] % 1) * 60, 0, 0)
        const game = await p.game.create({
          data: {
            seasonId: season.id,
            homeTeamId: homeId,
            awayTeamId: awayId,
            venueId: venues[(d + gIdx) % venues.length].id,
            scheduledAt: startAt,
            duration: 90,
            status: "SCHEDULED",
          },
        })
        const events = buildGameEvents({
          gameId: game.id,
          homeTeamId: homeId,
          awayTeamId: awayId,
          homeRoster: rosterOf.get(homeId)!,
          awayRoster: rosterOf.get(awayId)!,
          pace: div.pace,
          startAt,
          homeEdge: 0.44 + rnd() * 0.12,
        })
        await p.gameEvent.createMany({ data: events })
        const folded = foldEvents(
          events.map((e: any) => ({ ...e, timestampMs: e.timestamp.getTime() })),
          { homeTeamId: homeId, awayTeamId: awayId }
        )
        await p.$transaction(async (tx: any) => {
          await tx.game.update({
            where: { id: game.id },
            data: {
              homeScore: folded.homeScore,
              awayScore: folded.awayScore,
              status: "COMPLETED",
              finalizedAt: new Date(startAt.getTime() + 90 * 60_000),
              refereeName: pick(["Riley Whistler", "Sam Okafor", "Jo Tremblay", "Chris Vandermeer"]),
              refereeSignedAt: new Date(startAt.getTime() + 90 * 60_000),
              refereeVerified: true,
            },
          })
          await tx.playerStat.createMany({
            data: Object.values(folded.players).map((l: any) => ({
              gameId: game.id,
              playerId: l.playerId,
              points: l.points,
              rebounds: totalRebounds(l),
              assists: l.assists,
              steals: l.steals,
              blocks: l.blocks,
              turnovers: l.turnovers,
              fouls: l.fouls,
              minutesPlayed: l.secondsPlayed > 0 ? Math.round(l.secondsPlayed / 60) : null,
            })),
          })
        })
        completedGameIds.push(game.id)
      }
    }

    // Next weekend: round-0 pairings flipped, SCHEDULED
    const nextSat = new Date(now.getTime() + 6 * 86400_000)
    for (let gIdx = 0; gIdx < rounds[0].length; gIdx++) {
      const [a, b] = rounds[0][gIdx]
      const startAt = new Date(nextSat)
      startAt.setHours(Math.floor(saturdayHours[gIdx % 6] + d), (saturdayHours[gIdx % 6] % 1) * 60, 0, 0)
      await p.game.create({
        data: {
          seasonId: season.id,
          homeTeamId: b,
          awayTeamId: a,
          venueId: venues[(d + gIdx + 1) % venues.length].id,
          scheduledAt: startAt,
          duration: 90,
          status: "SCHEDULED",
        },
      })
    }

    // One LIVE game per boys' U14/U16 division, mid-3rd quarter right now
    if (div.ageGroup !== "U12" && div.gender === "MALE") {
      const [homeId, awayId] = rounds[1][d % 3]
      const startAt = new Date(now.getTime() - 55 * 60_000)
      const game = await p.game.create({
        data: {
          seasonId: season.id,
          homeTeamId: awayId, // re-pairing: swap sides vs their earlier meeting
          awayTeamId: homeId,
          venueId: venues[d % venues.length].id,
          scheduledAt: startAt,
          duration: 90,
          status: "LIVE",
        },
      })
      const events = buildGameEvents({
        gameId: game.id,
        homeTeamId: awayId,
        awayTeamId: homeId,
        homeRoster: rosterOf.get(awayId)!,
        awayRoster: rosterOf.get(homeId)!,
        pace: div.pace,
        startAt,
        homeEdge: 0.5,
        throughPeriod: 3,
      })
      await p.gameEvent.createMany({ data: events })
      const folded = foldEvents(
        events.map((e: any) => ({ ...e, timestampMs: e.timestamp.getTime() })),
        { homeTeamId: awayId, awayTeamId: homeId }
      )
      // Running score on the game row so the public scoreboard strip shows it
      await p.game.update({
        where: { id: game.id },
        data: { homeScore: folded.homeScore, awayScore: folded.awayScore },
      })
      liveGameIds.push(game.id)
    }
  }
  console.log(`✓ ${completedGameIds.length} completed games scored · ${liveGameIds.length} LIVE now · next weekend scheduled`)

  // ── Recaps (auto-published, publish date = game day) + photo covers ───
  let recapCount = 0
  for (const gameId of completedGameIds) {
    const result = await upsertGameRecap(gameId)
    if (!result) continue
    recapCount++
    const game = await p.game.findUnique({ where: { id: gameId }, select: { finalizedAt: true } })
    await p.post.update({
      where: { id: result.postId },
      data: { publishedAt: game?.finalizedAt ?? new Date() },
    })
  }
  // Covers on the most recent recaps (the ones the homepage feed shows)
  const recentRecaps = await p.post.findMany({
    where: { kind: "RECAP_AI", tags: { some: { leagueId: league.id } } },
    orderBy: { publishedAt: "desc" },
    take: 12,
    select: { id: true },
  })
  for (let i = 0; i < recentRecaps.length; i++) {
    await p.mediaAsset.create({
      data: {
        postId: recentRecaps[i].id,
        type: "IMAGE",
        url: COVER_PHOTOS[i % COVER_PHOTOS.length],
        title: "Game action",
      },
    })
  }
  console.log(`✓ ${recapCount} recaps published · covers on the ${recentRecaps.length} freshest`)

  // ── Highlight video posts (YouTube embeds — plan §11.3 PoC) ───────────
  for (let i = 0; i < HIGHLIGHT_VIDEOS.length; i++) {
    const v = HIGHLIGHT_VIDEOS[i]
    const team = teams[(i * 5) % teams.length]
    await p.post.create({
      data: {
        kind: "VIDEO",
        title: v.title,
        slug: `showcase-highlights-${i + 1}`,
        body: "Courtside highlights from around the Ontario Youth Basketball League — follow your team to catch every clip.",
        status: "PUBLISHED",
        publishedAt: new Date(now.getTime() - (i * 2 + 1) * 86400_000),
        authorId: commissioner.id,
        tags: { create: [{ leagueId: league.id }, { teamId: team.id }, { tenantId: team.tenantId }] },
        media: {
          create: [
            {
              type: "VIDEO_EMBED",
              url: `https://www.youtube.com/embed/${v.id}`,
              posterUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
              title: v.title,
            },
          ],
        },
      },
    })
  }
  console.log(`✓ ${HIGHLIGHT_VIDEOS.length} highlight videos posted`)

  // ── Public announcements ──────────────────────────────────────────────
  const announcements = [
    { title: "Winter 2026 playoff format announced", content: "Top four teams in each division qualify for championship weekend at Pan Am Sports Centre, March 7–8. Semifinals Saturday, finals Sunday — all games streamed with live stats.", tenant: tenants[0] },
    { title: "March Break Elite Camp — registration open", content: "Five days of skill development with our club coaches and guest trainers. Ages 10–16, all levels welcome. Early-bird pricing ends February 1.", tenant: tenants[1] },
    { title: "Team photo day this Saturday", content: "All teams: arrive 45 minutes before your scheduled game in full uniform. Individual and team packages available for order online.", tenant: tenants[2] },
    { title: "New officials clinic — earn your whistle", content: "The league is certifying new referees for the spring season. Two-evening clinic plus on-court mentorship. Ages 16+ welcome.", tenant: tenants[3] },
  ]
  for (let i = 0; i < announcements.length; i++) {
    const a = announcements[i]
    await p.announcement.create({
      data: {
        tenantId: a.tenant.id,
        authorId: commissioner.id,
        title: a.title,
        content: a.content,
        isPublic: true,
        createdAt: new Date(now.getTime() - (i * 3 + 2) * 86400_000),
      },
    })
  }
  console.log(`✓ ${announcements.length} public announcements`)

  // ── Demo parent (the owner's viewing account) ─────────────────────────
  const parent = await p.user.create({
    data: {
      email: PARENT_LOGIN,
      passwordHash,
      firstName: "Zia",
      lastName: "Khan",
      onboardedAt: new Date(),
      city: "Toronto",
      state: "ON",
    },
  })
  await p.userRole.create({ data: { userId: parent.id, role: "Parent" } })
  // Adopt one star from a U14 Boys team and one from the U14 Girls division
  const u14bTeam = teams.find((t) => divisions[t.divisionIdx].name === "U14 Boys")!
  const u14gTeam = teams.find((t) => divisions[t.divisionIdx].name === "U14 Girls")!
  await p.player.update({ where: { id: u14bTeam.roster[0] }, data: { parentId: parent.id } })
  await p.player.update({ where: { id: u14gTeam.roster[1] }, data: { parentId: parent.id } })
  // Plus an explicit league follow + a neutral team follow
  await p.follow.create({ data: { userId: parent.id, leagueId: league.id } })
  const thirdTeam = teams.find((t) => t.divisionIdx === 2)!
  await p.follow.create({ data: { userId: parent.id, teamId: thirdTeam.id } })

  const kidB = await p.player.findUnique({ where: { id: u14bTeam.roster[0] }, select: { firstName: true, lastName: true } })
  const kidG = await p.player.findUnique({ where: { id: u14gTeam.roster[1] }, select: { firstName: true, lastName: true } })

  console.log("")
  console.log("════════════════════════════════════════════════════════════")
  console.log("SHOWCASE READY — open http://localhost:3000")
  console.log("")
  console.log(`  Anonymous view:   scoreboard (${liveGameIds.length} LIVE), recaps w/ photos,`)
  console.log("                    leaders, highlights reel, announcements")
  console.log(`  Parent view:      ${PARENT_LOGIN} / ${PASSWORD}`)
  console.log(`                    kids: ${kidB?.firstName} ${kidB?.lastName} (${u14bTeam.name}),`)
  console.log(`                          ${kidG?.firstName} ${kidG?.lastName} (${u14gTeam.name})`)
  console.log(`  League owner:     commissioner@${EMAIL_DOMAIN} / ${PASSWORD}`)
  console.log("════════════════════════════════════════════════════════════")
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => p.$disconnect())
