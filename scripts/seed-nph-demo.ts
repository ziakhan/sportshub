/**
 * NPH DEMO SEEDER — the production demo world. Plan + owner approvals:
 * docs/nph-demo-seed-plan.md (v2).
 *
 * Builds: 16 real Toronto/West-End NPH clubs (12 adopted UNCLAIMED import
 * tenants + 4 created), NPH Summer League (Summer 2026) mid-season (4 grade
 * divisions × 8 teams, 64 completed games w/ full stats + recaps, 3 LIVE,
 * ~45 scheduled, standings, referees signed), NPH Fall League in OPEN
 * registration (tryouts live, check-in demo, open offer for the demo
 * parent), complete per-team pipeline history (templates → tryout → signups
 * → offers in every status → sizes → roster → payments → submit → lock),
 * chats with unread state, reviews + featured clubs, and memorable logins
 * (cheat sheet printed at the end — everything @sportshub.demo).
 *
 * Modes:
 *   (none)          reset: wipe the demo world (incl. legacy showcase) + reseed
 *   --wipe          wipe only, no reseed
 *   --report        list test-noise candidates (users/tenants/leagues), no writes
 *   --scrub-noise   delete what --report lists (run --report first!)
 *   --yes-prod      REQUIRED when DATABASE_URL is not localhost
 *
 *   npx tsx scripts/seed-nph-demo.ts [flags]
 */

import bcrypt from "bcryptjs"
import { prisma } from "@youthbasketballhub/db"
import { foldEvents, totalRebounds } from "../apps/web/src/lib/scoring/fold"
import { upsertGameRecap } from "../apps/web/src/lib/content/recap-service"
import { loadSchedulerInput } from "../apps/web/src/lib/scheduler/load"
import { generateSchedule } from "../apps/web/src/lib/scheduler/generate"

// Deterministic recaps: force the template engine even if a key is present.
// Re-run scripts/backfill-recaps.ts with ANTHROPIC_API_KEY for AI prose.
delete process.env.ANTHROPIC_API_KEY

const MARKER = "NPH_DEMO_SEED"
const EMAIL_DOMAIN = "sportshub.demo"
const PASSWORD = "TestPass123!"
// Active league: summer, weekly weekend sessions, wraps up end of July.
// Open league: fall, monthly sessions, runs October through March.
const WINTER_LEAGUE = "NPH Summer League"
const WINTER_SEASON = "Summer 2026"
const SPRING_LEAGUE = "NPH Fall League"
const SPRING_SEASON = "Fall 2026"
const LEAGUE_TEAM_FEE = 3990 // real NPH SL per-team fee (docs/research)
const SUMMER_GAMES_PER_TEAM = 10 // 2 per weekend × 5 weekends — never less than 2/weekend
const FALL_GAMES_PER_TEAM = 12 // monthly sessions Oct–Mar

const p = prisma as any

// ── Club config (docs/nph-demo-seed-plan.md §2) ─────────────────────────
interface ClubCfg {
  key: string // login + email fragment: owner-<key>@sportshub.demo
  name: string
  slug: string
  create?: boolean // no import tenant — create fresh
  city: string
  color: string
  grades: number[] // summer divisions this club fields (8 teams per grade)
  featured?: boolean
  elite?: boolean // gets the Elite All-In template
  spring?: "submitted" | "recruiting" // NPH Fall League participation
}

const CLUBS: ClubCfg[] = [
  { key: "lords", name: "Toronto Lords", slug: "toronto-lords-basketball", city: "Toronto", color: "#1d4ed8", grades: [8, 9, 11], featured: true, elite: true, spring: "recruiting" },
  { key: "huskies", name: "North Toronto Huskies", slug: "north-toronto-huskies", create: true, city: "Toronto", color: "#7c3aed", grades: [10, 11], spring: "recruiting" },
  { key: "lions", name: "North York Lions", slug: "north-york-lions", city: "North York", color: "#b45309", grades: [9, 10] },
  { key: "cityabove", name: "City Above Elite", slug: "city-above-elite", city: "Toronto", color: "#0f766e", grades: [8, 10] },
  { key: "six", name: "Against The Six Prep", slug: "against-the-six-prep", city: "Toronto", color: "#111827", grades: [11] },
  { key: "crown", name: "Royal Crown", slug: "royal-crown-school", city: "Scarborough", color: "#9333ea", grades: [9, 10], spring: "recruiting" },
  { key: "uchenna", name: "Uchenna Academy", slug: "uchenna-academy", create: true, city: "Toronto", color: "#dc2626", grades: [11] },
  { key: "kings", name: "Kings Court", slug: "kings-court-academy", city: "Hamilton", color: "#ca8a04", grades: [8, 9] },
  { key: "west", name: "West United Prep", slug: "west-united", city: "Mississauga", color: "#0891b2", grades: [10, 11], spring: "submitted" },
  { key: "force", name: "Burlington Force", slug: "burlington-force-elite", city: "Burlington", color: "#16a34a", grades: [8, 9, 10], featured: true, elite: true, spring: "submitted" },
  { key: "burloak", name: "Burloak Elite", slug: "burloak-elite", city: "Burlington", color: "#ea580c", grades: [8, 9], spring: "recruiting" },
  { key: "monarchs", name: "Mississauga Monarchs", slug: "monarchs-basketball-rep-aau", city: "Mississauga", color: "#4f46e5", grades: [8, 9], spring: "submitted" },
  { key: "panthers", name: "Oakville Panthers", slug: "oakville-panthers", create: true, city: "Oakville", color: "#be123c", grades: [9, 10], spring: "recruiting" },
  { key: "ckatt", name: "CKATT Basketball", slug: "ckatt-cooksville", city: "Mississauga", color: "#374151", grades: [8, 11] },
  { key: "pdm", name: "PDM Basketball", slug: "pdm-basketball", city: "Oakville", color: "#059669", grades: [8, 11] },
  { key: "polaris", name: "Polaris Prep", slug: "polaris-prep", city: "Burlington", color: "#d97706", grades: [10, 11] },
]

// pace ≈ plays per quarter — tuned per age band like the old showcase
const GRADES: Record<number, { pace: number; birthYear: number; age: number }> = {
  8: { pace: 24, birthYear: 2012, age: 13 },
  9: { pace: 27, birthYear: 2011, age: 14 },
  10: { pace: 30, birthYear: 2010, age: 15 },
  11: { pace: 32, birthYear: 2009, age: 16 },
}
const GRADE_LIST = [8, 9, 10, 11]

const VENUES = [
  { name: "Pan Am Sports Centre", address: "875 Morningside Ave", city: "Toronto" },
  { name: "Humber Athletic Centre", address: "205 Humber College Blvd", city: "Etobicoke" },
  { name: "Haber Recreation Centre", address: "3040 Tim Dobbie Dr", city: "Burlington" },
  { name: "Paramount Fine Foods Centre", address: "5500 Rose Cherry Pl", city: "Mississauga" },
]

const REFS: Array<[string, string, string]> = [
  ["Mike", "Ferreira", "ref-mike"],
  ["Sarah", "Whitlock", "ref-sarah"],
  ["James", "Okonkwo", "ref-james"],
  ["Priya", "Raman", "ref-priya"],
]

const BOY_NAMES = ["Liam","Noah","Jayden","Ethan","Marcus","Malik","Owen","Lucas","Mason","Elijah","Kai","Aiden","Josiah","Xavier","Isaiah","Andre","Devon","Tyler","Jordan","Cameron","Darius","Amir","Omar","Ravi","Arjun","Wei","Kevin","Daniel","Nathan","Zion","Trey","Cole","Miles","Jaxon","Theo","Felix","Santiago","Mateo","Ibrahim","Yusuf"]
const ADULT_NAMES = ["Alex","Sam","Jordan","Taylor","Morgan","Casey","Jamie","Robin","Dana","Chris","Pat","Lee","Maria","David","Sarah","Kevin","Lisa","Mark","Anita","Paul","Nadia","Victor","Elena","Tunde","Fatima","Carlos","Wendy","Raj","Grace","Dmitri"]
const LAST_NAMES = ["Thompson","Williams","Chen","Patel","Singh","Osei","Diallo","Nguyen","Garcia","Martinez","Brown","Wilson","Campbell","Grant","Baptiste","Charles","Pierre","Ahmed","Hassan","Ali","Khan","Kim","Park","Lee","Wong","Liu","Sharma","Gupta","Okafor","Mensah","Boateng","Silva","Santos","Rodriguez","Taylor","Anderson","Jackson","White","Harris","Robinson","Clarke","Lewis","Walker","Young","Allen","Wright","Scott","Green","Baker","Adams","Morris","Reid","Murray","Sinclair"]

const HIGHLIGHT_VIDEOS = [
  { id: "DLgjY3EF_fo", title: "NPH Showcase — Best Plays of the Weekend" },
  { id: "LGBsYRZ0jmU", title: "Grade 11: Toronto Lords vs West United — Full Highlights" },
  { id: "QKvLqlGZEic", title: "Grade 8 Division — Top Plays, Week 4" },
  { id: "2OYIiF2YwIs", title: "Saturday Showcase — Around the League" },
  { id: "kmhxcuhYNjk", title: "Player Spotlight: Rising Stars of Summer 2026" },
  { id: "TmslsvOqTUU", title: "Grade 10 Game of the Week: Burlington Force vs Royal Crown" },
]

const APPAREL_BY_GRADE: Record<number, string[]> = {
  8: ["YM", "YL", "AS", "AS", "AM"],
  9: ["YL", "AS", "AS", "AM", "AM"],
  10: ["AS", "AM", "AM", "AL", "AL"],
  11: ["AM", "AL", "AL", "AXL", "AM"],
}
const SHOE_BY_GRADE: Record<number, string[]> = {
  8: ["6", "6.5", "7", "7.5", "8"],
  9: ["7", "7.5", "8", "8.5", "9"],
  10: ["8.5", "9", "9.5", "10", "10.5"],
  11: ["9.5", "10", "10.5", "11", "12"],
}

// ── Deterministic RNG (mulberry32) ──────────────────────────────────────
let rngState = 20260707
function rnd(): number {
  rngState |= 0
  rngState = (rngState + 0x6d2b79f5) | 0
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
const days = (n: number) => n * 86400_000

// ── Prod safety rail ────────────────────────────────────────────────────
async function guardProd(args: string[]) {
  const url = process.env.DATABASE_URL || ""
  const host = url.match(/@([^/:]+)/)?.[1] ?? "unknown"
  const local = host === "localhost" || host === "127.0.0.1"
  const [{ current_database: db }] = (await p.$queryRaw`SELECT current_database()`) as any[]
  console.log(`Database: ${db} @ ${host} ${local ? "(local)" : "(REMOTE)"}`)
  if (!local && !args.includes("--yes-prod")) {
    console.error("✗ Remote database detected — re-run with --yes-prod to confirm.")
    process.exit(1)
  }
}

// ── Noise report / scrub (owner-approved cleanup of old test data) ──────
// .test and .local are reserved TLDs (RFC 6761/2606) — never real accounts
const NOISE_EMAIL = [
  { endsWith: ".world" },
  { endsWith: ".local" },
  { endsWith: ".test" },
  { endsWith: "@showcase.demo" },
] as const

async function findNoise() {
  const users = await p.user.findMany({
    where: { OR: NOISE_EMAIL.map((c) => ({ email: c })) },
    select: { id: true, email: true },
  })
  const userIds = users.map((u: any) => u.id)
  const leagues = await p.league.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true, name: true },
  })
  // Tenants whose only owner-level roles belong to noise users
  const ownedRoles = await p.userRole.findMany({
    where: { role: { in: ["ClubOwner", "ClubManager"] }, tenantId: { not: null } },
    select: { tenantId: true, userId: true },
  })
  const byTenant = new Map<string, string[]>()
  for (const r of ownedRoles) {
    byTenant.set(r.tenantId, [...(byTenant.get(r.tenantId) ?? []), r.userId])
  }
  const noiseSet = new Set(userIds)
  const orphanTenantIds = [...byTenant.entries()]
    .filter(([, owners]) => owners.every((o) => noiseSet.has(o)))
    .map(([tenantId]) => tenantId)
  const tenants = await p.tenant.findMany({
    where: {
      OR: [{ id: { in: orphanTenantIds } }, { name: { startsWith: "[" } }],
    },
    select: { id: true, name: true, slug: true, status: true },
  })
  return { users, leagues, tenants }
}

async function reportNoise() {
  const { users, leagues, tenants } = await findNoise()
  console.log(`\n— NOISE REPORT (nothing deleted) —`)
  console.log(`Test users (${users.length}):`)
  for (const u of users) console.log(`  ${u.email}`)
  console.log(`Leagues owned by test users (${leagues.length}):`)
  for (const l of leagues) console.log(`  ${l.name}`)
  console.log(`Tenants owned only by test users or bracket-named (${tenants.length}):`)
  for (const t of tenants) console.log(`  ${t.name} (${t.slug}, ${t.status})`)
  console.log(`\nRun with --scrub-noise to delete all of the above.`)
}

async function deleteLeagueDeep(leagueId: string) {
  const seasons = await p.season.findMany({ where: { leagueId }, select: { id: true } })
  const seasonIds = seasons.map((s: any) => s.id)
  const games = await p.game.findMany({ where: { seasonId: { in: seasonIds } }, select: { id: true } })
  const gameIds = games.map((g: any) => g.id)
  const posts = await p.post.findMany({
    where: { OR: [{ tags: { some: { gameId: { in: gameIds } } } }, { tags: { some: { leagueId } } }] },
    select: { id: true },
  })
  await p.post.deleteMany({ where: { id: { in: posts.map((x: any) => x.id) } } })
  await p.game.deleteMany({ where: { id: { in: gameIds } } })
  await p.paymentObligation.deleteMany({ where: { payeeLeagueId: leagueId } })
  await p.season.deleteMany({ where: { id: { in: seasonIds } } })
  await p.league.delete({ where: { id: leagueId } })
}

/** Delete users + everything hanging off them, FK-safe. */
async function deleteUsersDeep(userIds: string[]) {
  if (userIds.length === 0) return
  // RESTRICT FKs first: leagues/tournaments they own, audit trails, invites
  const ownedLeagues = await p.league.findMany({ where: { ownerId: { in: userIds } }, select: { id: true } })
  for (const l of ownedLeagues) await deleteLeagueDeep(l.id)
  await p.tournament.deleteMany({ where: { ownerId: { in: userIds } } })
  await p.auditLog.deleteMany({ where: { userId: { in: userIds } } })
  await p.staffInvitation.deleteMany({ where: { OR: [{ invitedById: { in: userIds } }, { invitedUserId: { in: userIds } }] } })
  await p.playerInvitation.deleteMany({ where: { OR: [{ invitedById: { in: userIds } }, { invitedUserId: { in: userIds } }] } })
  await p.review.deleteMany({ where: { OR: [{ reviewerId: { in: userIds } }, { revieweeId: { in: userIds } }] } })
  await p.payment.deleteMany({ where: { OR: [{ payerId: { in: userIds } }, { payeeId: { in: userIds } }, { recordedById: { in: userIds } }] } })
  await p.paymentObligation.deleteMany({ where: { payerUserId: { in: userIds } } })
  await p.offer.deleteMany({ where: { player: { parentId: { in: userIds } } } })
  await p.tryoutSignup.deleteMany({ where: { userId: { in: userIds } } })
  await p.player.deleteMany({ where: { parentId: { in: userIds } } })
  await p.announcement.deleteMany({ where: { authorId: { in: userIds } } })
  const posts = await p.post.findMany({ where: { authorId: { in: userIds } }, select: { id: true } })
  await p.post.deleteMany({ where: { id: { in: posts.map((x: any) => x.id) } } })
  await p.user.deleteMany({ where: { id: { in: userIds } } })
}

async function scrubNoise() {
  const { users, leagues, tenants } = await findNoise()
  for (const l of leagues) await deleteLeagueDeep(l.id)
  // Tenant delete cascades teams/tryouts/templates/announcements/reviews
  for (const t of tenants) {
    await p.paymentObligation.deleteMany({
      where: { OR: [{ payeeTenantId: t.id }, { payerTenantId: t.id }] },
    })
    await p.payment.deleteMany({ where: { tenantId: t.id } })
    await p.tenant.delete({ where: { id: t.id } }).catch((e: any) => {
      console.log(`  ! could not delete tenant ${t.name}: ${e.message?.slice(0, 100)}`)
    })
  }
  await deleteUsersDeep(users.map((u: any) => u.id))
  // Bracket-named leftovers on kept rows → strip the prefix
  const prefix = /^\[[^\]]+\]\s*/
  for (const model of ["team", "tenant"] as const) {
    const rows = await p[model].findMany({ where: { name: { startsWith: "[" } }, select: { id: true, name: true } })
    for (const row of rows) {
      await p[model].update({ where: { id: row.id }, data: { name: row.name.replace(prefix, "") } }).catch(() => {})
    }
  }
  await p.post.deleteMany({ where: { title: { startsWith: "[" } } })
  console.log(`✓ scrubbed: ${users.length} test users, ${leagues.length} leagues, ${tenants.length} tenants`)
}

// ── Demo-world wipe (config-driven, surgical, restores adopted tenants) ─
async function wipeDemoWorld() {
  for (const name of [
    WINTER_LEAGUE,
    SPRING_LEAGUE,
    "NPH Showcase League",
    "NPH Spring Circuit",
    "Ontario Youth Basketball League",
  ]) {
    const league = await p.league.findFirst({ where: { name }, select: { id: true } })
    if (league) await deleteLeagueDeep(league.id)
  }
  await p.post.deleteMany({ where: { slug: { startsWith: "nph-demo-" } } })
  await p.post.deleteMany({ where: { slug: { startsWith: "showcase-" } } })

  const users = await p.user.findMany({
    where: {
      OR: [
        { email: { endsWith: `@${EMAIL_DOMAIN}` } },
        { email: { endsWith: "@showcase.demo" } },
        { email: "showcase-parent@sportshub.test" },
      ],
    },
    select: { id: true },
  })
  const userIds = users.map((u: any) => u.id)
  // Teams first (cascades TeamPlayer/messages/chatReads/tryout links)
  await p.team.deleteMany({ where: { description: MARKER } })
  await p.team.deleteMany({ where: { description: "SHOWCASE_SEED" } })
  await deleteUsersDeep(userIds)

  for (const club of CLUBS) {
    const tenant = await p.tenant.findUnique({ where: { slug: club.slug }, select: { id: true } })
    if (!tenant) continue
    await p.tryout.deleteMany({ where: { tenantId: tenant.id } })
    await p.offerTemplate.deleteMany({ where: { tenantId: tenant.id } })
    await p.announcement.deleteMany({ where: { tenantId: tenant.id } })
    await p.review.deleteMany({ where: { tenantId: tenant.id } })
    if (club.create) {
      await p.tenant.delete({ where: { id: tenant.id } }).catch(() => {})
    } else {
      await p.tenant.update({
        where: { id: tenant.id },
        data: { status: "UNCLAIMED", isFeatured: false },
      })
    }
  }
  console.log("✓ demo world wiped (adopted tenants restored to UNCLAIMED)")
}

// ── Game event stream (proven showcase generator) ───────────────────────
function buildGameEvents(opts: {
  gameId: string
  homeTeamId: string
  awayTeamId: string
  homeRoster: string[]
  awayRoster: string[]
  pace: number
  startAt: Date
  homeEdge: number
  throughPeriod?: number
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
      clientEventId: `nphdemo-${gameId.slice(0, 8)}-${seq}`,
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
  const weighted = (teamId: string) => {
    const five = onFloor[teamId]
    return pick([...five, five[0], five[1]].filter(Boolean))
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
          push({ eventType: "REBOUND", teamId: offensive ? team : opp, playerId: pick(onFloor[offensive ? team : opp]), period: q, metadata: { offensive } })
        }
      } else if (r < 0.64) {
        const made = rnd() < 0.33
        push({ eventType: "SCORE_3PT", teamId: team, playerId: shooter, made, period: q })
        if (!made) push({ eventType: "REBOUND", teamId: opp, playerId: pick(onFloor[opp]), period: q, metadata: { offensive: false } })
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

/** Circle-method round robin: 8 teams → 7 rounds × 4 pairings. */
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

// ── The seed ────────────────────────────────────────────────────────────
interface SeededTeam {
  id: string
  name: string
  tenantId: string
  clubKey: string
  grade: number
  roster: string[] // playerIds; 0-1 are stars
  rosterParents: string[] // parent userIds aligned with roster
  coachId: string
  templateId: string
  seasonFee: number
  installments: number
}

async function seed() {
  const now = new Date()
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const mkUser = (email: string, firstName: string, lastName: string, extra: any = {}) =>
    p.user.create({
      data: { email, passwordHash, firstName, lastName, onboardedAt: new Date(), city: "Toronto", state: "ON", ...extra },
      select: { id: true },
    })

  // Platform admin + league owner
  const admin = await mkUser(`admin@${EMAIL_DOMAIN}`, "Avery", "Admin")
  await p.userRole.create({ data: { userId: admin.id, role: "PlatformAdmin" } })
  const nph = await mkUser(`owner-nph@${EMAIL_DOMAIN}`, "Nathan", "Hoops")
  console.log("✓ admin + league owner")

  // Venues (find-or-create, global) — each with 2 real courts so the
  // session substrate and scheduler have something to allocate
  const venues: Array<{ id: string; courtIds: string[] }> = []
  for (const v of VENUES) {
    let venue = await p.venue.findFirst({ where: { name: v.name }, select: { id: true } })
    if (!venue) venue = await p.venue.create({ data: { ...v, state: "ON", country: "CA" }, select: { id: true } })
    const courtIds: string[] = []
    for (let c = 1; c <= 2; c++) {
      let court = await p.court.findFirst({ where: { venueId: venue.id, name: `Court ${c}` }, select: { id: true } })
      if (!court) court = await p.court.create({ data: { venueId: venue.id, name: `Court ${c}`, displayOrder: c }, select: { id: true } })
      courtIds.push(court.id)
    }
    venues.push({ id: venue.id, courtIds })
  }

  // ── Clubs: adopt real import tenants / create the missing ones ────────
  const clubRows = new Map<string, { id: string; ownerId: string; templates: any[] }>()
  for (const club of CLUBS) {
    let tenant = await p.tenant.findUnique({ where: { slug: club.slug }, select: { id: true } })
    if (!tenant && club.create) {
      tenant = await p.tenant.create({
        data: { slug: club.slug, name: club.name, status: "ACTIVE", city: club.city, state: "ON", country: "CA", currency: "CAD", timezone: "America/Toronto" },
        select: { id: true },
      })
    } else if (tenant) {
      await p.tenant.update({
        where: { id: tenant.id },
        data: { status: "ACTIVE", city: club.city, state: "ON", isFeatured: !!club.featured },
      })
    } else {
      throw new Error(`Club tenant missing and not marked create: ${club.slug}`)
    }
    if (club.featured) {
      await p.tenant.update({ where: { id: tenant.id }, data: { isFeatured: true } })
    }
    await p.tenantBranding.upsert({
      where: { tenantId: tenant.id },
      create: { tenantId: tenant.id, primaryColor: club.color },
      update: { primaryColor: club.color },
    })
    const owner = await mkUser(`owner-${club.key}@${EMAIL_DOMAIN}`, pick(ADULT_NAMES), pick(LAST_NAMES), { city: club.city })
    await p.userRole.create({ data: { userId: owner.id, role: "ClubOwner", tenantId: tenant.id } })

    // Offer templates — the package story (plan §3)
    const base = 425 + Math.floor(rnd() * 5) * 10
    const mkTemplate = (name: string, fee: number, installments: number, inc: any, practice = 0) =>
      p.offerTemplate.create({
        data: { tenantId: tenant.id, name, seasonFee: fee, installments, practiceSessions: practice, isActive: true, ...inc },
        select: { id: true, name: true, seasonFee: true, installments: true, practiceSessions: true, includesBall: true, includesBag: true, includesShoes: true, includesUniform: true, includesTracksuit: true },
      })
    const templates = [
      await mkTemplate("Standard Package", base, 1, { includesUniform: true, includesBall: true }),
      await mkTemplate("Premium Package", base + 330, 3, { includesUniform: true, includesBall: true, includesShoes: true, includesBag: true, includesTracksuit: true }),
      await mkTemplate("Returning Player", base - 80, 2, { includesUniform: true }),
    ]
    if (club.elite) {
      templates.push(await mkTemplate("Elite All-In", 999, 4, { includesUniform: true, includesBall: true, includesShoes: true, includesBag: true, includesTracksuit: true }, 2))
    }
    clubRows.set(club.key, { id: tenant.id, ownerId: owner.id, templates })
  }
  console.log(`✓ ${CLUBS.length} clubs adopted/created, branded, templated (${CLUBS.filter((c) => c.featured).length} featured)`)

  // ── Summer league + season + divisions ────────────────────────────────
  const winterLeague = await p.league.create({
    data: {
      name: WINTER_LEAGUE,
      description: "North Pole Hoops' flagship grade-based circuit — every game scored live with stats, standings and recaps.",
      ownerId: nph.id,
      statDepth: "STANDARD",
      periodType: "QUARTERS",
    },
  })
  await p.userRole.create({ data: { userId: nph.id, role: "LeagueOwner", leagueId: winterLeague.id } })
  const winterSeason = await p.season.create({
    data: {
      leagueId: winterLeague.id,
      label: WINTER_SEASON,
      status: "IN_PROGRESS",
      type: "SUMMER",
      startDate: new Date(now.getTime() - days(32)),
      endDate: new Date(now.getTime() + days(24)), // wraps up end of July
      teamFee: LEAGUE_TEAM_FEE,
      gamePeriods: "QUARTERS",
      gamesGuaranteed: SUMMER_GAMES_PER_TEAM,
      gameSlotMinutes: 90,
      gameLengthMinutes: 40,
      idealGamesPerDayPerTeam: 1, // 2-day weekend sessions → 2 games/weekend
      defaultVenueOpenTime: "09:00",
      defaultVenueCloseTime: "18:00",
      rosterChangePolicy: "REQUEST_ONLY", // locked rosters need commissioner approval
      tiebreakerOrder: ["HEAD_TO_HEAD", "POINT_DIFFERENTIAL", "POINTS_SCORED"],
      tiebreakersLockedAt: now,
    },
  })
  const winterDivisions = new Map<number, any>()
  for (const g of GRADE_LIST) {
    winterDivisions.set(g, await p.division.create({
      data: { seasonId: winterSeason.id, name: `Grade ${g}`, ageGroup: `Grade ${g}`, gender: "MALE" },
    }))
  }

  // Season venue allocations + weekly weekend sessions (the substrate the
  // Venues/Sessions tabs display and the scheduler consumes)
  const buildSessions = async (
    seasonId: string,
    spec: Array<{ label: string; dayOffsets: number[] }>,
    targetGamesPerTeam: number
  ): Promise<Array<{ id: string; label: string }>> => {
    const created: Array<{ id: string; label: string }> = []
    for (const v of venues) {
      await p.seasonVenue.upsert({
        where: { seasonId_venueId: { seasonId, venueId: v.id } },
        create: { seasonId, venueId: v.id, courtsAvailable: v.courtIds.length },
        update: {},
      })
    }
    for (const s of spec) {
      const session = await p.seasonSession.create({
        data: { seasonId, label: s.label, phase: "REGULAR", targetGamesPerTeam },
        select: { id: true },
      })
      created.push({ id: session.id, label: s.label })
      for (const offset of s.dayOffsets) {
        const date = new Date(now.getTime() + days(offset))
        date.setHours(0, 0, 0, 0)
        const day = await p.seasonSessionDay.create({
          data: { sessionId: session.id, date },
          select: { id: true },
        })
        for (const v of venues) {
          const dayVenue = await p.seasonSessionDayVenue.create({
            data: { dayId: day.id, venueId: v.id, startTime: "09:00", endTime: "18:00" },
            select: { id: true },
          })
          for (const courtId of v.courtIds) {
            await p.seasonSessionDayVenueCourt.create({ data: { dayVenueId: dayVenue.id, courtId } })
          }
        }
      }
    }
    return created
  }

  // 5 weekend sessions: 4 played, week 5 = today + next Saturday
  const dow = now.getDay()
  const lastSaturday = dow === 6 ? 0 : -((dow + 1) % 7)
  const summerSessions = await buildSessions(
    winterSeason.id,
    [
      { label: "Week 1", dayOffsets: [lastSaturday - 28, lastSaturday - 27] },
      { label: "Week 2", dayOffsets: [lastSaturday - 21, lastSaturday - 20] },
      { label: "Week 3", dayOffsets: [lastSaturday - 14, lastSaturday - 13] },
      { label: "Week 4", dayOffsets: [lastSaturday - 7, lastSaturday - 6] },
      { label: "Week 5", dayOffsets: [0, lastSaturday + 7] }, // today + next Saturday
    ],
    2
  )
  console.log(`✓ ${WINTER_LEAGUE} · ${WINTER_SEASON} · 4 grade divisions · 4 venues (2 courts each) · 5 weekend sessions`)

  // ── Teams + the full pipeline history per team ─────────────────────────
  const teams: SeededTeam[] = []
  const parentSeqByClub = new Map<string, number>()
  const gymFor = (city: string) => VENUES.find((v) => v.city === city)?.name ?? `${city} Community Gym`

  // The two named demo parents (kids get attached during roster builds)
  const demoParent = await mkUser(`parent@${EMAIL_DOMAIN}`, "Jordan", "Reyes")
  await p.userRole.create({ data: { userId: demoParent.id, role: "Parent" } })
  const demoParent2 = await mkUser(`parent2@${EMAIL_DOMAIN}`, "Sana", "Malik")
  await p.userRole.create({ data: { userId: demoParent2.id, role: "Parent" } })

  for (const club of CLUBS) {
    const row = clubRows.get(club.key)!
    for (const grade of club.grades) {
      const g = GRADES[grade]
      const teamName = `${club.name} Grade ${grade}`
      const team = await p.team.create({
        data: { tenantId: row.id, name: teamName, ageGroup: `Grade ${grade}`, gender: "MALE", season: WINTER_SEASON, description: MARKER },
        select: { id: true },
      })
      // Head coach = the chat admin by default
      const coach = await mkUser(`coach-${club.key}-gr${grade}@${EMAIL_DOMAIN}`, pick(ADULT_NAMES), pick(LAST_NAMES), { city: club.city })
      await p.userRole.create({ data: { userId: coach.id, role: "Staff", tenantId: row.id } })
      await p.userRole.create({ data: { userId: coach.id, role: "Staff", tenantId: row.id, teamId: team.id, designation: "HeadCoach" } })

      // Template by grade: G8/9 Standard-heavy, G10/11 mixes Premium/Returning
      const template = grade <= 9 ? row.templates[0] : pick(row.templates)
      const seasonFee = Number(template.seasonFee)

      // Tryout ~10-11 weeks back, published, with roll-call history
      const tryoutAt = new Date(now.getTime() - days(74 - Math.floor(rnd() * 6)))
      tryoutAt.setHours(18, 0, 0, 0)
      const tryout = await p.tryout.create({
        data: {
          tenantId: row.id, teamId: team.id,
          title: `${club.name} Grade ${grade} Tryouts — ${WINTER_SEASON}`,
          description: `Open evaluation for the ${WINTER_SEASON} NPH Showcase League squad.`,
          ageGroup: `Grade ${grade}`, gender: "MALE",
          location: gymFor(club.city),
          scheduledAt: tryoutAt, duration: 120, fee: 0, maxParticipants: 25,
          isPublished: true, isPublic: true,
        },
        select: { id: true },
      })

      // 14 signups: 10 accepted / 2 declined / 1 expired / 1 no-offer
      const roster: string[] = []
      const rosterParents: string[] = []
      const usedJerseys = new Set<number>()
      for (let i = 0; i < 14; i++) {
        // Named demo kids land on specific rosters (plan §4: full history for parent@)
        const special =
          club.key === "lords" && grade === 9 && i === 0 ? demoParent :
          club.key === "force" && grade === 10 && i === 1 ? demoParent :
          club.key === "lions" && grade === 9 && i === 2 ? demoParent2 : null
        const seq = (parentSeqByClub.get(club.key) ?? 0) + 1
        parentSeqByClub.set(club.key, seq)
        const parent = special ?? (await mkUser(`parent-${club.key}-${String(seq).padStart(2, "0")}@${EMAIL_DOMAIN}`, pick(ADULT_NAMES), pick(LAST_NAMES), { city: club.city }))
        if (!special) await p.userRole.create({ data: { userId: parent.id, role: "Parent" } })
        const kidName = { firstName: pick(BOY_NAMES), lastName: special ? (special === demoParent ? "Reyes" : "Malik") : pick(LAST_NAMES) }
        const player = await p.player.create({
          data: {
            ...kidName,
            dateOfBirth: new Date(Date.UTC(g.birthYear, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28))),
            gender: "MALE", isMinor: true, parentId: parent.id,
            position: pick(["Guard", "Guard", "Forward", "Forward", "Center"]),
            mediaConsent: rnd() < 0.33 ? "GRANTED" : "UNSET",
          },
          select: { id: true },
        })
        const outcome = i < 10 ? "ACCEPTED" : i < 12 ? "DECLINED" : i < 13 ? "EXPIRED" : "NONE"
        const signup = await p.tryoutSignup.create({
          data: {
            tryoutId: tryout.id, userId: parent.id, playerId: player.id,
            playerName: `${kidName.firstName} ${kidName.lastName}`,
            playerAge: g.age, playerGender: "MALE",
            status: outcome === "NONE" ? "CONFIRMED" : "OFFERED",
            checkedInAt: i < 12 ? new Date(tryoutAt.getTime() + (5 + i * 3) * 60_000) : null,
            createdAt: new Date(tryoutAt.getTime() - days(4 + Math.floor(rnd() * 10))),
          },
          select: { id: true },
        })
        if (outcome === "NONE") continue

        const respondedAt = new Date(tryoutAt.getTime() + days(2 + Math.floor(rnd() * 4)))
        const jerseyPrefs = [0, 0, 0].map(() => 1 + Math.floor(rnd() * 44))
        const accepted = outcome === "ACCEPTED"
        const offer = await p.offer.create({
          data: {
            teamId: team.id, playerId: player.id, tryoutSignupId: signup.id, templateId: template.id,
            status: outcome === "EXPIRED" ? "EXPIRED" : outcome,
            seasonFee, installments: template.installments, practiceSessions: template.practiceSessions,
            includesBall: template.includesBall, includesBag: template.includesBag,
            includesShoes: template.includesShoes, includesUniform: template.includesUniform,
            includesTracksuit: template.includesTracksuit,
            message: `Congratulations — we'd love to have ${kidName.firstName} on the Grade ${grade} squad this season.`,
            expiresAt: new Date(tryoutAt.getTime() + days(10)),
            respondedAt: outcome === "EXPIRED" ? null : respondedAt,
            createdAt: new Date(tryoutAt.getTime() + days(1)),
            ...(accepted
              ? {
                  uniformSize: template.includesUniform ? pick(APPAREL_BY_GRADE[grade]) : null,
                  tracksuitSize: template.includesTracksuit ? pick(APPAREL_BY_GRADE[grade]) : null,
                  shoeSize: template.includesShoes ? pick(SHOE_BY_GRADE[grade]) : null,
                  jerseyPref1: jerseyPrefs[0], jerseyPref2: jerseyPrefs[1], jerseyPref3: jerseyPrefs[2],
                }
              : {}),
          },
          select: { id: true, uniformSize: true, shoeSize: true, tracksuitSize: true },
        })
        if (!accepted) continue

        // Roster + jersey honoring prefs
        let jersey = jerseyPrefs.find((n) => !usedJerseys.has(n))
        if (jersey === undefined) {
          jersey = 1
          while (usedJerseys.has(jersey)) jersey++
        }
        usedJerseys.add(jersey)
        await p.teamPlayer.create({
          data: {
            teamId: team.id, playerId: player.id, jerseyNumber: jersey, status: "ACTIVE",
            uniformSize: offer.uniformSize, shoeSize: offer.shoeSize, tracksuitSize: offer.tracksuitSize,
          },
        })
        roster.push(player.id)
        rosterParents.push(parent.id)

        // Money: obligation + recorded offline payments (~75% paid in full,
        // 15% mid-installments, 10% still owing). Demo parent's Force kid is
        // deliberately mid-plan so the payments page shows a live balance.
        const roll = special === demoParent && club.key === "force" ? 0.8 : rnd()
        const obligationStatus = roll < 0.75 ? "PAID" : roll < 0.9 ? "PARTIALLY_PAID" : "PENDING"
        const obligation = await p.paymentObligation.create({
          data: {
            payerUserId: parent.id, payeeTenantId: row.id,
            referenceType: "Offer", referenceId: offer.id,
            description: `${WINTER_SEASON} season fee — ${teamName}`,
            amount: seasonFee, status: obligationStatus,
            dueDate: new Date(tryoutAt.getTime() + days(30)),
          },
          select: { id: true },
        })
        if (obligationStatus !== "PENDING") {
          const n = template.installments
          const perInstallment = Math.round((seasonFee / n) * 100) / 100
          const paidCount = obligationStatus === "PAID" ? n : Math.max(1, n - 1)
          for (let k = 0; k < paidCount; k++) {
            await p.payment.create({
              data: {
                payerId: parent.id, tenantId: row.id,
                amount: n === 1 ? seasonFee : perInstallment, currency: "CAD",
                status: "SUCCEEDED", paymentType: "SEASON_FEE",
                method: pick(["ETRANSFER", "ETRANSFER", "CASH", "CHEQUE"]),
                obligationId: obligation.id, recordedById: row.ownerId,
                description: `${WINTER_SEASON} season fee — ${teamName}${n > 1 ? ` (installment ${k + 1}/${n})` : ""}`,
                ...(n > 1 ? { installmentNumber: k + 1 } : {}),
                createdAt: new Date(respondedAt.getTime() + days(k * 21)),
              },
            })
          }
        }
      }

      // One-click league submit → frozen, locked roster
      const submission = await p.teamSubmission.create({
        data: { seasonId: winterSeason.id, divisionId: winterDivisions.get(grade).id, teamId: team.id, status: "APPROVED" },
        select: { id: true },
      })
      const rosterRows = await p.teamPlayer.findMany({ where: { teamId: team.id }, select: { playerId: true, jerseyNumber: true } })
      await p.seasonRoster.create({
        data: {
          seasonId: winterSeason.id, teamSubmissionId: submission.id,
          isLocked: true,
          submittedAt: new Date(now.getTime() - days(44)),
          lockedAt: new Date(now.getTime() - days(42)),
          players: { create: rosterRows.map((r: any) => ({ playerId: r.playerId, jerseyNumber: r.jerseyNumber })) },
        },
      })
      // Club → league entry fee, PAID — with the actual Payment row so the
      // league payments page sums real collected money
      const leagueFeeObligation = await p.paymentObligation.create({
        data: {
          payerTenantId: row.id, payeeLeagueId: winterLeague.id,
          referenceType: "TeamSubmission", referenceId: submission.id,
          description: `${WINTER_LEAGUE} team entry — ${teamName} (${WINTER_SEASON})`,
          amount: LEAGUE_TEAM_FEE, status: "PAID",
        },
        select: { id: true },
      })
      await p.payment.create({
        data: {
          obligationId: leagueFeeObligation.id,
          amount: LEAGUE_TEAM_FEE, currency: "CAD",
          status: "SUCCEEDED", paymentType: "LEAGUE_FEE", method: "ETRANSFER",
          payeeId: nph.id, recordedById: nph.id,
          description: `${WINTER_LEAGUE} team entry — ${teamName} (${WINTER_SEASON})`,
          createdAt: new Date(now.getTime() - days(40)),
        },
      })

      teams.push({
        id: team.id, name: teamName, tenantId: row.id, clubKey: club.key, grade,
        roster, rosterParents, coachId: coach.id,
        templateId: template.id, seasonFee, installments: template.installments,
      })
    }
  }
  console.log(`✓ ${teams.length} summer teams: tryout + 14 signups + offers (10✓ 2✗ 1 expired) + sizes + payments + locked league roster each`)

  // ── Summer schedule: generated by the REAL scheduler over the session
  // substrate (same code path as the owner's "Commit schedule" button) ──
  const rosterOf = new Map(teams.map((t) => [t.id, t.roster]))
  const gradeOf = new Map(teams.map((t) => [t.id, t.grade]))
  const completedGameIds: string[] = []
  const liveGameIds: string[] = []

  const { input: schedInput, errors: schedErrors } = await loadSchedulerInput(winterSeason.id)
  if (!schedInput) throw new Error(`Scheduler input failed: ${schedErrors.join("; ")}`)

  // Staged passes so the cadence lands exactly (generateSchedule packs
  // greedily-chronologically — a single pass would pour every game into the
  // past sessions): 8 games/team across the four played weekends, then
  // Week 5 as two single-day passes (1 game/team today, 1 next Saturday).
  const week5Id = summerSessions.find((s) => s.label === "Week 5")!.id
  const week5Session = schedInput.sessions.find((s: any) => s.id === week5Id)!
  const playedPass = generateSchedule({
    ...schedInput,
    gamesGuaranteed: SUMMER_GAMES_PER_TEAM - 2,
    sessions: schedInput.sessions.filter((s: any) => s.id !== week5Id),
  })
  const week5DayPasses = week5Session.days.map((day: any) =>
    generateSchedule({
      ...schedInput,
      gamesGuaranteed: 1,
      sessions: [{ ...week5Session, days: [day] }],
    })
  )
  const allPasses = [playedPass, ...week5DayPasses]
  const proposal = {
    games: allPasses.flatMap((r) => r.games),
    unscheduled: allPasses.flatMap((r) => r.unscheduled),
    warnings: allPasses.flatMap((r) => r.warnings),
  }
  if (proposal.warnings.length) {
    for (const w of proposal.warnings) console.log(`  ! scheduler: ${w}`)
  }

  const createdGames: Array<{ id: string; homeTeamId: string; awayTeamId: string; scheduledAt: Date }> = []
  for (const g of proposal.games) {
    const game = await p.game.create({
      data: {
        seasonId: winterSeason.id,
        phase: "REGULAR",
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        sessionId: g.sessionId,
        dayId: g.dayId,
        dayVenueId: g.dayVenueId,
        courtId: g.courtId,
        venueId: g.venueId,
        scheduledAt: g.scheduledAt,
        duration: schedInput.gameSlotMinutes,
        status: "SCHEDULED",
        isLocked: true,
      },
      select: { id: true, homeTeamId: true, awayTeamId: true, scheduledAt: true },
    })
    createdGames.push(game)
  }

  // Games from past sessions (and earlier today) get played + scored;
  // 3 of the still-pending ones go LIVE right now (distinct grades first).
  const playedCutoff = new Date(now.getTime() - 100 * 60_000)
  const pending = createdGames.filter((g) => g.scheduledAt >= playedCutoff)
  const livePicks: typeof pending = []
  for (const grade of [9, 10, 11, 8]) {
    if (livePicks.length >= 3) break
    const pick = pending.find(
      (g) => gradeOf.get(g.homeTeamId) === grade && !livePicks.includes(g)
    )
    if (pick) livePicks.push(pick)
  }
  while (livePicks.length < 3 && pending.length > livePicks.length) {
    const next = pending.find((g) => !livePicks.includes(g))
    if (!next) break
    livePicks.push(next)
  }

  for (const game of createdGames) {
    const grade = gradeOf.get(game.homeTeamId) ?? 9
    const pace = GRADES[grade].pace
    const isLive = livePicks.includes(game)
    const isPlayed = !isLive && game.scheduledAt < playedCutoff
    if (!isLive && !isPlayed) continue

    const startAt = isLive ? new Date(now.getTime() - 55 * 60_000) : game.scheduledAt
    const events = buildGameEvents({
      gameId: game.id,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      homeRoster: rosterOf.get(game.homeTeamId)!,
      awayRoster: rosterOf.get(game.awayTeamId)!,
      pace,
      startAt,
      homeEdge: isLive ? 0.5 : 0.44 + rnd() * 0.12,
      throughPeriod: isLive ? 3 : undefined,
    })
    await p.gameEvent.createMany({ data: events })
    const folded = foldEvents(
      events.map((e: any) => ({ ...e, timestampMs: e.timestamp.getTime() })),
      { homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId }
    )
    if (isLive) {
      await p.game.update({
        where: { id: game.id },
        data: { status: "LIVE", scheduledAt: startAt, homeScore: folded.homeScore, awayScore: folded.awayScore },
      })
      liveGameIds.push(game.id)
    } else {
      const refName = REFS[(grade + completedGameIds.length) % REFS.length]
      await p.$transaction(async (tx: any) => {
        await tx.game.update({
          where: { id: game.id },
          data: {
            homeScore: folded.homeScore,
            awayScore: folded.awayScore,
            status: "COMPLETED",
            finalizedAt: new Date(startAt.getTime() + 90 * 60_000),
            refereeName: `${refName[0]} ${refName[1]}`,
            refereeSignedAt: new Date(startAt.getTime() + 90 * 60_000),
            refereeVerified: true,
          },
        })
        await tx.playerStat.createMany({
          data: Object.values(folded.players).map((l: any) => ({
            gameId: game.id, playerId: l.playerId,
            points: l.points, rebounds: totalRebounds(l), assists: l.assists,
            steals: l.steals, blocks: l.blocks, turnovers: l.turnovers, fouls: l.fouls,
            minutesPlayed: l.secondsPlayed > 0 ? Math.round(l.secondsPlayed / 60) : null,
          })),
        })
      })
      completedGameIds.push(game.id)
    }
  }
  const scheduledLeft = createdGames.length - completedGameIds.length - liveGameIds.length
  console.log(
    `✓ scheduler committed ${createdGames.length} games (target ${SUMMER_GAMES_PER_TEAM}/team, ${proposal.unscheduled.length} unscheduled): ${completedGameIds.length} completed · ${liveGameIds.length} LIVE now · ${scheduledLeft} upcoming`
  )

  // ── Referees: memorable logins, PIN 1234, assigned to EVERY game ──────
  const refIds: string[] = []
  const pinHash = await bcrypt.hash("1234", 10)
  for (const [first, last, key] of REFS) {
    const ref = await mkUser(`${key}@${EMAIL_DOMAIN}`, first, last)
    await p.userRole.create({ data: { userId: ref.id, role: "Referee" } })
    await p.refereeProfile.create({
      data: { userId: ref.id, certificationLevel: `Level ${2 + (refIds.length % 2)}`, availableRegions: ["Ontario"], standardFee: 45, gamesRefereed: 20 + refIds.length * 9, signoffPinHash: pinHash },
    })
    refIds.push(ref.id)
  }
  const allGames = await p.game.findMany({ where: { seasonId: winterSeason.id }, select: { id: true }, orderBy: { scheduledAt: "asc" } })
  for (let i = 0; i < allGames.length; i++) {
    await p.userRole.create({ data: { userId: refIds[i % refIds.length], role: "Referee", gameId: allGames[i].id } })
  }
  console.log(`✓ 4 referees (PIN 1234) assigned across all ${allGames.length} summer games`)

  // ── Recaps + highlight videos + announcements ─────────────────────────
  let recapCount = 0
  for (const gameId of completedGameIds) {
    const result = await upsertGameRecap(gameId)
    if (!result) continue
    recapCount++
    const game = await p.game.findUnique({ where: { id: gameId }, select: { finalizedAt: true } })
    await p.post.update({ where: { id: result.postId }, data: { publishedAt: game?.finalizedAt ?? new Date() } })
  }
  for (let i = 0; i < HIGHLIGHT_VIDEOS.length; i++) {
    const v = HIGHLIGHT_VIDEOS[i]
    const team = teams[(i * 7) % teams.length]
    await p.post.create({
      data: {
        kind: "VIDEO", title: v.title, slug: `nph-demo-highlights-${i + 1}`,
        body: "Courtside highlights from around the NPH Showcase League — follow your team to catch every clip.",
        status: "PUBLISHED", publishedAt: new Date(now.getTime() - days(i * 2 + 1)),
        authorId: nph.id,
        tags: { create: [{ leagueId: winterLeague.id }, { teamId: team.id }, { tenantId: team.tenantId }] },
        media: { create: [{ type: "VIDEO_EMBED", url: `https://www.youtube.com/embed/${v.id}`, posterUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, title: v.title }] },
      },
    })
  }
  const annos = [
    { key: "lords", title: "Summer 2026 championship picture taking shape", content: "Top four in each grade division qualify for championship weekend at Pan Am Sports Centre, July 25–26. All games live-scored with stats and recaps." },
    { key: "force", title: "Fall League tryouts open across the West End", content: "Burlington Force, West United and the Monarchs have posted Fall League tryouts — register on the marketplace, roll call happens on your phone at the door." },
    { key: "crown", title: "March Break Elite Camp — registration open", content: "Five days of skill development with our coaching staff. Ages 12–17, all levels welcome. Early-bird pricing ends February 1." },
  ]
  for (let i = 0; i < annos.length; i++) {
    const a = annos[i]
    await p.announcement.create({
      data: { tenantId: clubRows.get(a.key)!.id, authorId: clubRows.get(a.key)!.ownerId, title: a.title, content: a.content, isPublic: true, createdAt: new Date(now.getTime() - days(i * 3 + 1)) },
    })
  }
  console.log(`✓ ${recapCount} recaps · ${HIGHLIGHT_VIDEOS.length} highlight videos · ${annos.length} public announcements`)

  // ── Reviews (ratings live on browse + club pages) ─────────────────────
  const reviewLines = [
    ["Great coaches, great communication", "Our son improved so much this season. Offers, sizes and payments were all on our phone — zero paperwork."],
    ["Well organized club", "Tryout to roster in a week, and we always knew what we owed and when. The team chat keeps everyone in the loop."],
    ["Development first", "Coaches actually develop every kid on the roster, not just the stars. Live stats after every game are a huge bonus."],
    ["Smooth season", "Schedules, standings and recaps all in one place. Best-run club we've been part of."],
    ["Good program, gym is far", "Coaching is excellent. Only wish the practice gym were closer to us."],
  ]
  let reviewCount = 0
  for (let i = 0; i < CLUBS.length; i++) {
    const club = CLUBS[i]
    const row = clubRows.get(club.key)!
    const n = club.featured ? 3 : i % 3 === 0 ? 2 : 1
    for (let k = 0; k < n; k++) {
      const donor = teams.find((t) => t.clubKey !== club.key && t.rosterParents.length > k + 2)!
      const [title, content] = reviewLines[(i + k) % reviewLines.length]
      await p.review.create({
        data: {
          reviewerId: donor.rosterParents[k + 2], tenantId: row.id,
          rating: rnd() < 0.15 ? 3 : rnd() < 0.5 ? 4 : 5,
          title, content, status: "PUBLISHED",
          createdAt: new Date(now.getTime() - days(3 + ((i * 5 + k * 11) % 40))),
        },
      })
      reviewCount++
    }
  }
  console.log(`✓ ${reviewCount} club reviews published`)

  // ── Fall League: OPEN league — live tryouts, check-in, open offer ──
  const springLeague = await p.league.create({
    data: {
      name: SPRING_LEAGUE,
      description: "NPH's fall season — October through March, registration open now. Clubs are holding tryouts and submitting rosters.",
      ownerId: nph.id, statDepth: "STANDARD", periodType: "QUARTERS",
    },
  })
  await p.userRole.create({ data: { userId: nph.id, role: "LeagueOwner", leagueId: springLeague.id } })
  // Fall runs October → March: monthly weekend sessions, 12 games/team
  const fallStart = new Date(now.getFullYear(), 9, 3) // early October
  const springSeason = await p.season.create({
    data: {
      leagueId: springLeague.id, label: SPRING_SEASON, status: "REGISTRATION",
      type: "FALL_WINTER",
      registrationDeadline: new Date(now.getTime() + days(45)),
      startDate: fallStart, endDate: new Date(now.getFullYear() + 1, 2, 28), // end of March
      teamFee: LEAGUE_TEAM_FEE, gamePeriods: "QUARTERS",
      gamesGuaranteed: FALL_GAMES_PER_TEAM,
      gameSlotMinutes: 90,
      gameLengthMinutes: 40,
      idealGamesPerDayPerTeam: 1,
      defaultVenueOpenTime: "09:00",
      defaultVenueCloseTime: "18:00",
      // Clubs may edit rosters until the first fall session wraps
      rosterChangePolicy: "OPEN_UNTIL_DEADLINE",
      rosterChangeDeadline: new Date(fallStart.getTime() + days(9)),
    },
  })
  const springDivisions = new Map<number, any>()
  for (const g of [9, 10]) {
    springDivisions.set(g, await p.division.create({
      data: { seasonId: springSeason.id, name: `Grade ${g}`, ageGroup: `Grade ${g}`, gender: "MALE" },
    }))
  }
  // Monthly sessions Oct–Mar (one weekend a month), venue allocations included
  const fallBase = Math.round((fallStart.getTime() - now.getTime()) / 86400_000)
  await buildSessions(
    springSeason.id,
    Array.from({ length: 6 }, (_, m) => ({
      label: ["October", "November", "December", "January", "February", "March"][m],
      dayOffsets: [fallBase + m * 30 + 7, fallBase + m * 30 + 8],
    })),
    2
  )

  // 3 clubs already submitted fall squads (summer roster carries over)
  for (const club of CLUBS.filter((c) => c.spring === "submitted")) {
    const row = clubRows.get(club.key)!
    const sourceGrade = club.grades.includes(9) ? 9 : 10
    const source = teams.find((t) => t.clubKey === club.key && t.grade === sourceGrade)!
    const team = await p.team.create({
      data: { tenantId: row.id, name: `${club.name} Fall Grade ${sourceGrade}`, ageGroup: `Grade ${sourceGrade}`, gender: "MALE", season: SPRING_SEASON, description: MARKER },
      select: { id: true },
    })
    for (let i = 0; i < source.roster.length; i++) {
      await p.teamPlayer.create({ data: { teamId: team.id, playerId: source.roster[i], jerseyNumber: 4 + i, status: "ACTIVE" } })
    }
    const submission = await p.teamSubmission.create({
      data: { seasonId: springSeason.id, divisionId: springDivisions.get(sourceGrade).id, teamId: team.id, status: "PENDING" },
      select: { id: true },
    })
    await p.seasonRoster.create({
      data: {
        seasonId: springSeason.id, teamSubmissionId: submission.id, isLocked: false,
        submittedAt: new Date(now.getTime() - days(2)),
        players: { create: source.roster.map((playerId, i) => ({ playerId, jerseyNumber: 4 + i })) },
      },
    })
  }

  // Recruiting clubs: fall tryouts live on the marketplace NOW.
  // Lords' tryout is in ~3 hours with 5 kids already checked in — the
  // on-stage check-in + send-offer demo (plan §3). Their fall team is
  // forming: 3 accepted offers, and parent@'s kid has the OPEN offer.
  let springOfferForDemo: string | null = null
  const lordsRow = clubRows.get("lords")!
  const lordsSpringTeam = await p.team.create({
    data: { tenantId: lordsRow.id, name: "Toronto Lords Fall Elite", ageGroup: "Grade 9", gender: "MALE", season: SPRING_SEASON, description: MARKER },
    select: { id: true },
  })
  const lordsSpringTemplate = lordsRow.templates[1] // Premium

  for (const club of CLUBS.filter((c) => c.spring === "recruiting")) {
    const row = clubRows.get(club.key)!
    const isLords = club.key === "lords"
    const grade = club.grades.includes(9) ? 9 : club.grades[0]
    const g = GRADES[grade]
    const tryoutAt = isLords
      ? new Date(now.getTime() + 3 * 3600_000)
      : new Date(now.getTime() + days(2 + Math.floor(rnd() * 8)))
    if (!isLords) tryoutAt.setHours(18, 0, 0, 0)
    const tryout = await p.tryout.create({
      data: {
        tenantId: row.id, teamId: isLords ? lordsSpringTeam.id : null,
        title: `${club.name} Fall League Tryouts — Grade ${grade}`,
        description: `Evaluation for our ${SPRING_SEASON} NPH Fall League entry. All players welcome.`,
        ageGroup: `Grade ${grade}`, gender: "MALE",
        location: gymFor(club.city), scheduledAt: tryoutAt, duration: 120,
        fee: 0, maxParticipants: 24, isPublished: true, isPublic: true,
      },
      select: { id: true },
    })
    const signupCount = isLords ? 12 : 6 + Math.floor(rnd() * 5)
    for (let i = 0; i < signupCount; i++) {
      const isDemoKid = isLords && i === 0
      const seq = (parentSeqByClub.get(club.key) ?? 0) + 1
      parentSeqByClub.set(club.key, seq)
      const parent = isDemoKid ? demoParent : await mkUser(`parent-${club.key}-${String(seq).padStart(2, "0")}@${EMAIL_DOMAIN}`, pick(ADULT_NAMES), pick(LAST_NAMES), { city: club.city })
      if (!isDemoKid) await p.userRole.create({ data: { userId: parent.id, role: "Parent" } })
      // The demo kid = parent@'s Lords Grade 9 son trying out for fall
      const lordsG9 = teams.find((t) => t.clubKey === "lords" && t.grade === 9)!
      const playerId = isDemoKid
        ? lordsG9.roster[0]
        : (
            await p.player.create({
              data: {
                firstName: pick(BOY_NAMES), lastName: pick(LAST_NAMES),
                dateOfBirth: new Date(Date.UTC(g.birthYear, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28))),
                gender: "MALE", isMinor: true, parentId: parent.id,
                position: pick(["Guard", "Guard", "Forward", "Forward", "Center"]),
              },
              select: { id: true },
            })
          ).id
      const kid = await p.player.findUnique({ where: { id: playerId }, select: { firstName: true, lastName: true } })
      const signup = await p.tryoutSignup.create({
        data: {
          tryoutId: tryout.id, userId: parent.id, playerId,
          playerName: `${kid.firstName} ${kid.lastName}`, playerAge: g.age, playerGender: "MALE",
          status: "PENDING",
          // Lords: first five families already checked in at the door
          checkedInAt: isLords && i > 0 && i <= 5 ? new Date(now.getTime() - (20 - i * 3) * 60_000) : null,
          createdAt: new Date(now.getTime() - days(1 + Math.floor(rnd() * 6))),
        },
        select: { id: true },
      })
      // Lords fall squad is forming: 3 accepted + the demo parent's OPEN offer
      if (isLords && (i === 0 || (i >= 1 && i <= 3))) {
        const accepted = i !== 0
        const offer = await p.offer.create({
          data: {
            teamId: lordsSpringTeam.id, playerId, tryoutSignupId: signup.id, templateId: lordsSpringTemplate.id,
            status: accepted ? "ACCEPTED" : "PENDING",
            seasonFee: Number(lordsSpringTemplate.seasonFee), installments: lordsSpringTemplate.installments,
            practiceSessions: lordsSpringTemplate.practiceSessions,
            includesBall: lordsSpringTemplate.includesBall, includesBag: lordsSpringTemplate.includesBag,
            includesShoes: lordsSpringTemplate.includesShoes, includesUniform: lordsSpringTemplate.includesUniform,
            includesTracksuit: lordsSpringTemplate.includesTracksuit,
            message: accepted
              ? "Welcome to the Fall Elite squad!"
              : `${kid.firstName} impressed at evaluations — we'd love to have him on the Fall Elite roster. Premium package includes full kit.`,
            expiresAt: new Date(now.getTime() + days(7)),
            respondedAt: accepted ? new Date(now.getTime() - days(1)) : null,
            ...(accepted
              ? { uniformSize: pick(APPAREL_BY_GRADE[9]), tracksuitSize: pick(APPAREL_BY_GRADE[9]), shoeSize: pick(SHOE_BY_GRADE[9]), jerseyPref1: 4 + i, jerseyPref2: 20 + i, jerseyPref3: 30 + i }
              : {}),
          },
          select: { id: true },
        })
        if (accepted) {
          await p.teamPlayer.create({ data: { teamId: lordsSpringTeam.id, playerId, jerseyNumber: 4 + i, status: "ACTIVE" } })
          await p.tryoutSignup.update({ where: { id: signup.id }, data: { status: "OFFERED" } })
        } else {
          springOfferForDemo = offer.id
          await p.tryoutSignup.update({ where: { id: signup.id }, data: { status: "OFFERED" } })
        }
      }
    }
  }
  console.log(`✓ ${SPRING_LEAGUE} (${SPRING_SEASON}): REGISTRATION open · 3 squads submitted · ${CLUBS.filter((c) => c.spring === "recruiting").length} clubs running tryouts (Lords in 3h w/ live check-in) · open offer waiting for parent@`)

  // ── Roster-change demo state: Burloak asks to amend a locked roster ──
  const burloakG9 = teams.find((t) => t.clubKey === "burloak" && t.grade === 9)!
  const burloakSubmission = await p.teamSubmission.findFirst({
    where: { teamId: burloakG9.id, seasonId: winterSeason.id },
    select: { roster: { select: { id: true } } },
  })
  if (burloakSubmission?.roster) {
    const burloakRequest = await p.rosterChangeRequest.create({
      data: {
        rosterId: burloakSubmission.roster.id,
        requestedById: clubRows.get("burloak")!.ownerId,
        message:
          "Two players are out for the rest of the summer (ankle + family travel). We'd like to call up two Grade 8s so we don't forfeit the last weekend.",
      },
      select: { id: true },
    })
    await p.notification.create({
      data: {
        userId: nph.id,
        type: "roster_change_requested",
        title: "Roster change requested",
        message: "Burloak Elite Grade 9 is asking to change their Summer 2026 roster.",
        link: `/manage/leagues/${winterLeague.id}/seasons/${winterSeason.id}/manage`,
        referenceId: burloakRequest.id,
        referenceType: "RosterChangeRequest",
      },
    })
  }
  console.log("✓ roster policies set (Summer: request-only · Fall: open until first session) + 1 pending change request for owner-nph")

  // ── parent@ history: declined + expired offers from rival clubs ───────
  const lordsG9 = teams.find((t) => t.clubKey === "lords" && t.grade === 9)!
  const demoKidId = lordsG9.roster[0]
  for (const [rivalKey, status] of [["lions", "DECLINED"], ["crown", "EXPIRED"]] as const) {
    const rival = teams.find((t) => t.clubKey === rivalKey && t.grade === 9)!
    const rivalTemplate = clubRows.get(rivalKey)!.templates[0]
    await p.offer.create({
      data: {
        teamId: rival.id, playerId: demoKidId, templateId: rivalTemplate.id, status,
        seasonFee: Number(rivalTemplate.seasonFee), installments: rivalTemplate.installments,
        practiceSessions: rivalTemplate.practiceSessions,
        includesBall: rivalTemplate.includesBall, includesUniform: rivalTemplate.includesUniform,
        includesBag: rivalTemplate.includesBag, includesShoes: rivalTemplate.includesShoes,
        includesTracksuit: rivalTemplate.includesTracksuit,
        message: "We'd love to add him to our Grade 9 roster this summer.",
        expiresAt: new Date(now.getTime() - days(62)),
        respondedAt: status === "DECLINED" ? new Date(now.getTime() - days(65)) : null,
        createdAt: new Date(now.getTime() - days(70)),
      },
    })
  }

  // ── Follows + notifications for the demo parent ───────────────────────
  const forceG10 = teams.find((t) => t.clubKey === "force" && t.grade === 10)!
  await p.follow.create({ data: { userId: demoParent.id, teamId: lordsG9.id } })
  await p.follow.create({ data: { userId: demoParent.id, teamId: forceG10.id } })
  await p.follow.create({ data: { userId: demoParent.id, leagueId: winterLeague.id } })
  if (springOfferForDemo) {
    await p.notification.create({
      data: {
        userId: demoParent.id, type: "offer_received",
        title: "New offer from Toronto Lords",
        message: "Toronto Lords Fall Elite has sent an offer — Premium package, expires in 7 days.",
        link: "/offers", referenceId: springOfferForDemo, referenceType: "Offer",
      },
    })
  }

  // ── Team chats: every winter team has a living thread ─────────────────
  const chatLines: Array<[string, "coach" | "parent"]> = [
    ["Practice moved to 6:30pm this Thursday — same gym.", "coach"],
    ["Thanks coach, we'll be there!", "parent"],
    ["Great win on Saturday everyone. Film session before next practice.", "coach"],
    ["Does anyone have a spare size AM jersey for pictures?", "parent"],
    ["Reminder: bring BOTH jerseys to every game from now on.", "coach"],
    ["Carpool from the west end — we have 2 seats, message me.", "parent"],
    ["Team photos this Saturday, arrive 45 min before tip.", "coach"],
    ["What time do doors open at Pan Am for the early game?", "parent"],
    ["Doors open 8:15 for the 9am tip.", "coach"],
    ["Standings update: we're in the playoff picture — keep it going!", "coach"],
  ]
  let chatMessages = 0
  for (const team of teams) {
    const n = 8 + Math.floor(rnd() * 3)
    let lastMsgAt = new Date(0)
    for (let i = 0; i < n; i++) {
      const [body, who] = chatLines[i % chatLines.length]
      const senderId = who === "coach" ? team.coachId : team.rosterParents[(i * 3) % team.rosterParents.length]
      const createdAt = new Date(now.getTime() - days(5) + i * ((days(5) - 3600_000) / n))
      await p.teamMessage.create({ data: { teamId: team.id, senderId, body, createdAt } })
      lastMsgAt = createdAt
      chatMessages++
    }
    // Everyone has read up to date — except the demo parent on the Lords
    // chat, who has 2 unread (badge + bell demo)
    const readAt = new Date(lastMsgAt.getTime() + 60_000)
    const readerIds = new Set([team.coachId, ...team.rosterParents])
    for (const readerId of readerIds) {
      const isDemoUnread = readerId === demoParent.id && team.id === lordsG9.id
      await p.teamChatRead.create({
        data: {
          userId: readerId, teamId: team.id,
          lastReadAt: isDemoUnread ? new Date(lastMsgAt.getTime() - days(5) / 10 * 2.2) : readAt,
        },
      }).catch(() => {})
    }
  }
  await p.notification.create({
    data: {
      userId: demoParent.id, type: "team_chat",
      title: `New message in ${lordsG9.name} chat`,
      message: "Coach: Standings update — we're in the playoff picture!",
      link: `/teams/${lordsG9.id}/chat`, referenceId: lordsG9.id, referenceType: "Team",
    },
  })
  console.log(`✓ ${chatMessages} chat messages across ${teams.length} team chats (demo parent has unread + bell)`)

  return { teams: teams.length, completed: completedGameIds.length, live: liveGameIds.length }
}

function printCheatSheet() {
  const lines = [
    "",
    "══════════════════════════════════════════════════════════════════",
    ` NPH DEMO WORLD — LOGINS (password for ALL: ${PASSWORD} · ref PIN 1234)`,
    "══════════════════════════════════════════════════════════════════",
    ` admin@${EMAIL_DOMAIN}            platform admin`,
    ` owner-nph@${EMAIL_DOMAIN}        NPH league owner (Summer + Fall)`,
    ` parent@${EMAIL_DOMAIN}       ⭐  demo parent Jordan Reyes — 2 kids,`,
    `                                  OPEN fall offer, unread chat, payments`,
    ` parent2@${EMAIL_DOMAIN}          second parent (declined/expired history)`,
    "──────────────────────────────────────────────────────────────────",
    " Club owners:",
    ...CLUBS.map((c) => `   owner-${c.key}@${EMAIL_DOMAIN}`.padEnd(42) + c.name + (c.featured ? " ⭐featured" : "")),
    "──────────────────────────────────────────────────────────────────",
    " Coaches: coach-<club>-gr<N>@ (e.g. coach-lords-gr9@sportshub.demo)",
    ` Referees: ${REFS.map((r) => `${r[2]}@`).join(" · ")}  (PIN 1234)`,
    "──────────────────────────────────────────────────────────────────",
    " Demo hooks:",
    "   · owner-lords → Tryouts: fall tryout in ~3h, 5/12 checked in",
    "   · parent → open offer to accept live; Lords chat has 2 unread",
    "   · owner-lords → Offers → Order Sheet: sizes + CSV ready",
    "   · owner-nph → Summer mid-season (standings/live) + Fall open",
    "   · owner-nph → Teams tab: pending roster-change request to approve",
    "══════════════════════════════════════════════════════════════════",
  ]
  console.log(lines.join("\n"))
}

async function main() {
  const args = process.argv.slice(2)
  await guardProd(args)

  if (args.includes("--report")) {
    await reportNoise()
    return
  }
  if (args.includes("--scrub-noise")) {
    await scrubNoise()
    return
  }

  console.log("— NPH DEMO SEEDER — (docs/nph-demo-seed-plan.md)")
  await wipeDemoWorld()
  if (args.includes("--wipe")) return

  const t0 = Date.now()
  const result = await seed()
  console.log(`\n✓ world built in ${Math.round((Date.now() - t0) / 1000)}s — ${result.teams} teams, ${result.completed} completed, ${result.live} live`)
  printCheatSheet()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
