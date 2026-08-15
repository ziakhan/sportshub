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
 *   --purge-manual-leagues  also delete leagues owned by NON-demo accounts
 *                   (owner 2026-07-29: curated directory only; manual USER
 *                   accounts and clubs are left alone)
 *   --yes-prod      REQUIRED when DATABASE_URL is not localhost
 *
 *   npx tsx scripts/seed-nph-demo.ts [flags]
 */

import { readFileSync } from "fs"
import bcrypt from "bcryptjs"
import { prisma } from "@youthbasketballhub/db"
import { Prisma } from "@prisma/client"
import { foldEvents, totalRebounds } from "../apps/web/src/lib/scoring/fold"
import { upsertGameRecap } from "../apps/web/src/lib/content/recap-service"
import { loadSchedulerInput } from "../apps/web/src/lib/scheduler/load"
import { generateSchedule } from "../apps/web/src/lib/scheduler/generate"
import { WAIVER_TEMPLATES } from "../apps/web/src/lib/waivers/templates"

// Deterministic recaps: force the template engine even if a key is present.
// Re-run scripts/backfill-recaps.ts with ANTHROPIC_API_KEY for AI prose.
delete process.env.ANTHROPIC_API_KEY

import { EMAIL_DOMAIN, JOURNEY_SLUG_PREFIX, MARKER, PASSWORD } from "./demo-shared"
import { JOURNEY_LEAGUES, runJourneyStage } from "./seed-journey"
// Active league: summer, weekly weekend sessions, wraps up end of July.
// Open league: fall, monthly sessions, runs October through March.
const WINTER_LEAGUE = "NPH Summer League"
const WINTER_SEASON = "Summer 2026"
const SPRING_LEAGUE = "NPH Fall League"
const SPRING_SEASON = "Fall 2026"
// NPH Showcase League 2026-27 — mirrors NPH's real announced fall/winter
// structure (docs/research/nph-fall-winter-2026-alignment.md): $3,990/team,
// 10-game season + 2 guaranteed playoff games Oct–Mar, tiered divisions,
// application pipeline in every state for the league-side demo.
const SHOWCASE_LEAGUE = "NPH Showcase League"
const SHOWCASE_SEASON = "2026-27"
// Name-only leagues (owner 2026-07-29: "just as a name") — one DRAFT
// placeholder season each so the one-source directory query surfaces them
// on web AND native without a nullable-season API change (old fielded
// bundles read season fields; server never leads the client).
const NPH_SHELL_LEAGUES: Array<[string, string]> = [
  ["NPA Canada", "National Preparatory Association, Canada's top prep basketball circuit."],
  ["WNPA Canada", "Women's National Preparatory Association, elite girls prep basketball."],
  ["NPH D1", "NPH D1: Academy, Scholastic and Junior divisions."],
]
const DIRECTORY_LEAGUES: Array<[string, string]> = [
  ["Ontario Basketball League (OBL)", "Ontario Basketball's provincial club league."],
  ["National Junior Circuit", "Junior club basketball circuit in Toronto & GTA."],
  ["National Senior Circuit", "Senior club basketball circuit in Toronto & GTA."],
  ["Hoop City League", "Toronto community basketball league."],
  ["Toronto Big League", "GTA club basketball league."],
  ["Phoenix League", "Toronto youth basketball league."],
  ["OSBA (Ontario Scholastic Basketball Association)", "Ontario's elite high-school prep league."],
  ["JUEL (Junior Elite League)", "Ontario's provincial girls development league."],
  ["CYBL (Canadian Youth Basketball League)", "GTA youth league for spring and winter seasons."],
]
// Fall/winter-only demo clubs (owner 2026-07-29): A = established, applied
// with complete rosters; B = freshly onboarded, roster ready, applies LIVE.
const SHOWCASE_CLUBS = [
  { key: "titans", name: "Scarborough Titans", slug: "scarborough-titans", city: "Scarborough", color: "#0e7490", create: true },
  { key: "edge", name: "Etobicoke Edge", slug: "etobicoke-edge", city: "Etobicoke", color: "#65a30d", create: true },
]
// ════════════════════════════════════════════════════════════════════════
// OWNER KNOBS — hand-edit these (and the CLUBS list below) to shape the
// demo world, then re-run the seeder (~30s). Everything downstream derives.
// ════════════════════════════════════════════════════════════════════════
const LEAGUE_TEAM_FEE = 3990 // real NPH SL per-team fee (docs/research)
const SUMMER_GAMES_PER_TEAM = 20 // 2 per weekend × 10 weekends (season runs to end of August)
// Fall inherits the org rulebook's 10 games across 5 weekend sessions (2/session)
const GAME_SLOT_MINUTES = 90 // scheduler slot width (warmup + game + buffer)
const GAME_LENGTH_MINUTES = 40 // actual playing time (4 × 10-min quarters)
// Club offer packages (CAD) — deliberately simple (owner call 2026-07-07):
// two options, New vs Returning, differing only by price. No item
// itemization in the demo. Payment = deposit-on-accept + 3 equal monthly.
const OFFER_PRICING = {
  newPlayerFee: 3000, // regular season fee, new player
  returningFee: 2700, // ~$300 less — kit carries over from last season
  installments: 4, // deposit + 3 monthly (equal quarters)
  depositFraction: 0.25, // deposit = a quarter, due on accepting the offer
}
// Venue default hours — Sessions tab prefills day windows from these
const VENUE_WEEKEND_HOURS = { open: "08:00", close: "18:00" }
const VENUE_WEEKDAY_HOURS = { open: "17:00", close: "22:00" }
// ════════════════════════════════════════════════════════════════════════

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
  { id: "DLgjY3EF_fo", title: "NPH Showcase: Best Plays of the Weekend" },
  { id: "LGBsYRZ0jmU", title: "Grade 11: Toronto Lords vs West United (Full Highlights)" },
  { id: "QKvLqlGZEic", title: "Grade 8 Division: Top Plays, Week 4" },
  { id: "2OYIiF2YwIs", title: "Saturday Showcase: Around the League" },
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
    SHOWCASE_LEAGUE,
    ...NPH_SHELL_LEAGUES.map(([n]) => n),
    ...DIRECTORY_LEAGUES.map(([n]) => n),
    ...JOURNEY_LEAGUES,
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
  // Teams first (cascades TeamPlayer/messages/chatReads/tryout links).
  // Non-cascading FKs must go first: offers/games made AGAINST demo teams
  // by real/manual users survive the user purge and block team deletion
  // (box reseed crash 2026-07-31: Offer_teamId_fkey).
  for (const marker of [MARKER, "SHOWCASE_SEED"]) {
    await p.offer.deleteMany({ where: { team: { description: marker } } })
    await p.offerTemplate.deleteMany({ where: { team: { description: marker } } })
    await p.game.deleteMany({
      where: {
        OR: [
          { homeTeam: { description: marker } },
          { awayTeam: { description: marker } },
        ],
      },
    })
    await p.tournamentTeam.deleteMany({ where: { team: { description: marker } } })
  }
  await p.team.deleteMany({ where: { description: MARKER } })
  await p.team.deleteMany({ where: { description: "SHOWCASE_SEED" } })
  await deleteUsersDeep(userIds)
  await p.organization.deleteMany({ where: { slug: "north-pole-hoops" } })

  for (const club of [...CLUBS, ...SHOWCASE_CLUBS] as Array<{ slug: string; create?: boolean }>) {
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

  // Journey-created tenants (real-name census clubs) — slugs are prefixed
  // so adopted import tenants are never touched.
  await p.tenantBranding.deleteMany({ where: { tenant: { slug: { startsWith: JOURNEY_SLUG_PREFIX } } } })
  await p.tenant.deleteMany({ where: { slug: { startsWith: JOURNEY_SLUG_PREFIX } } })
  // Loaded-scenario marker resets with the world.
  await p.platformSettings.updateMany({ where: { id: "default" }, data: { demoState: Prisma.JsonNull } }).catch(() => {})
}

// ── Manual-league purge (owner 2026-07-29) ──────────────────────────────
// Deletes leagues whose owner is NOT a demo account, so the curated
// directory is the only league surface. Manual user accounts and clubs are
// deliberately untouched — losses are limited to the leagues themselves
// (seasons, games, league-tagged posts, entry-fee obligations).
async function purgeManualLeagues() {
  const leagues = await p.league.findMany({ select: { id: true, name: true, ownerId: true } })
  const owners = await p.user.findMany({
    where: { id: { in: [...new Set(leagues.map((l: any) => l.ownerId))] } },
    select: { id: true, email: true },
  })
  const emailById = new Map<string, string>(owners.map((o: any) => [o.id, o.email]))
  let purged = 0
  for (const l of leagues) {
    const email = emailById.get(l.ownerId) ?? "(deleted user)"
    if (email.endsWith(`@${EMAIL_DOMAIN}`)) continue
    console.log(`  ✗ purging manual league: ${l.name} (owner ${email})`)
    await deleteLeagueDeep(l.id)
    purged++
  }
  console.log(`✓ purged ${purged} manually-created league(s)`)
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
      clockSeconds: e.clockSeconds ?? null,
      sequence: ++seq,
      clientEventId: `nphdemo-${gameId.slice(0, 8)}-${seq}`,
      metadata: e.metadata ?? undefined,
      timestamp: new Date(startAt.getTime() + seq * 18_000),
    })
  // 10-minute quarters (GAME_LENGTH_MINUTES/4) — clockSeconds counts down
  // within each period so play-by-play reads like a real broadcast feed.
  const PERIOD_SECONDS = 600

  // Attendance variance (owner 2026-07-29, playoff-eligibility demo): most
  // games a bench kid or two is away — GP counts then show a real spread.
  const takeAttendance = (roster: string[]) => {
    const absent = new Set<string>()
    // never the first five (starters keep the lineup math simple)
    for (let i = 5; i < roster.length; i++) {
      // last bench slot = the chronically-away kid (~half the games) so the
      // eligibility badges show a real ineligible case, not just green
      if (rnd() < (i === roster.length - 1 ? 0.55 : 0.14)) absent.add(roster[i])
    }
    return { present: roster.filter((r) => !absent.has(r)), absent: [...absent] }
  }
  const homeAtt = takeAttendance(homeRoster)
  const awayAtt = takeAttendance(awayRoster)
  push({ eventType: "ATTENDANCE", teamId: homeTeamId, metadata: { presentIds: homeAtt.present, absentIds: homeAtt.absent } })
  push({ eventType: "ATTENDANCE", teamId: awayTeamId, metadata: { presentIds: awayAtt.present, absentIds: awayAtt.absent } })
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
    push({ eventType: "PERIOD_START", period: q, clockSeconds: PERIOD_SECONDS })
    const plays = pace + Math.floor(rnd() * 6)
    // Countdown clock for this quarter — decrements a little more than the
    // even split each play so it reliably reaches ~0 before PERIOD_END
    // without going negative (clamped).
    let clock = PERIOD_SECONDS
    const step = Math.max(6, Math.floor(PERIOD_SECONDS / (plays + 2)))
    for (let i = 0; i < plays; i++) {
      clock = Math.max(2, clock - step - Math.floor(rnd() * 8))
      const team = rnd() < homeEdge ? homeTeamId : awayTeamId
      const opp = team === homeTeamId ? awayTeamId : homeTeamId
      const shooter = weighted(team)
      const r = rnd()
      if (r < 0.5) {
        const made = rnd() < 0.5
        push({ eventType: "SCORE_2PT", teamId: team, playerId: shooter, made, period: q, clockSeconds: clock })
        if (made && rnd() < 0.55) {
          push({ eventType: "ASSIST", teamId: team, playerId: pick(onFloor[team].filter((x) => x !== shooter)), period: q, clockSeconds: clock })
        }
        if (!made) {
          const offensive = rnd() < 0.25
          push({ eventType: "REBOUND", teamId: offensive ? team : opp, playerId: pick(onFloor[offensive ? team : opp]), period: q, clockSeconds: clock, metadata: { offensive } })
        }
      } else if (r < 0.64) {
        const made = rnd() < 0.33
        push({ eventType: "SCORE_3PT", teamId: team, playerId: shooter, made, period: q, clockSeconds: clock })
        if (!made) push({ eventType: "REBOUND", teamId: opp, playerId: pick(onFloor[opp]), period: q, clockSeconds: clock, metadata: { offensive: false } })
      } else if (r < 0.74) {
        push({ eventType: "FOUL", teamId: opp, playerId: pick(onFloor[opp]), period: q, clockSeconds: clock })
        push({ eventType: "SCORE_FT", teamId: team, playerId: shooter, made: rnd() < 0.66, period: q, clockSeconds: clock })
        push({ eventType: "SCORE_FT", teamId: team, playerId: shooter, made: rnd() < 0.66, period: q, clockSeconds: clock })
      } else if (r < 0.84) {
        push({ eventType: "TURNOVER", teamId: team, playerId: shooter, period: q, clockSeconds: clock })
        if (rnd() < 0.5) push({ eventType: "STEAL", teamId: opp, playerId: pick(onFloor[opp]), period: q, clockSeconds: clock })
      } else if (r < 0.92) {
        push({ eventType: "FOUL", teamId: team, playerId: shooter, period: q, clockSeconds: clock })
      } else if (r < 0.97) {
        push({ eventType: "BLOCK", teamId: opp, playerId: pick(onFloor[opp]), period: q, clockSeconds: clock })
      } else {
        push({ eventType: "STEAL", teamId: team, playerId: shooter, period: q, clockSeconds: clock })
      }
    }
    for (const [teamId, roster] of [
      [homeTeamId, homeAtt.present],
      [awayTeamId, awayAtt.present],
    ] as const) {
      for (let s = 0; s < 2; s++) {
        const five = onFloor[teamId]
        const bench = roster.filter((x) => !five.includes(x))
        if (bench.length === 0) continue
        const inP = bench[Math.floor(rnd() * bench.length)]
        const outP = five[2 + ((q + s) % 3)]
        onFloor[teamId] = five.map((x) => (x === outP ? inP : x))
        clock = Math.max(1, clock - 15)
        push({ eventType: "SUBSTITUTION", teamId, period: q, clockSeconds: clock, metadata: { inPlayerId: inP, outPlayerId: outP } })
      }
    }
    if (q < lastPeriod || lastPeriod === 4) push({ eventType: "PERIOD_END", period: q, clockSeconds: 0 })
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
      data: { email, passwordHash, firstName, lastName, phoneNumber: "416-555-0142", onboardedAt: new Date(), city: "Toronto", state: "ON", ...extra },
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
    // Default hours (owner ask): weekends all day, weeknights after school —
    // the Sessions tab prefills day windows from these (editable)
    for (let dow = 0; dow <= 6; dow++) {
      const weekend = dow === 0 || dow === 6
      await p.venueHours.upsert({
        where: { venueId_dayOfWeek: { venueId: venue.id, dayOfWeek: dow } },
        create: {
          venueId: venue.id,
          dayOfWeek: dow,
          openTime: weekend ? VENUE_WEEKEND_HOURS.open : VENUE_WEEKDAY_HOURS.open,
          closeTime: weekend ? VENUE_WEEKEND_HOURS.close : VENUE_WEEKDAY_HOURS.close,
        },
        // Seed provides DEFAULTS only — venues are a global registry and
        // owner edits must survive reseeds (owner 2026-07-29). Season-level
        // scheduling windows live on SeasonVenueHours, which the reset DOES
        // rebuild with the rest of the demo world.
        update: {},
      })
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

    // Offer templates — TWO simple packages (owner call): New vs Returning,
    // price the only difference; both include the uniform, both on the
    // deposit + 3-monthly plan. templates[0]=New, templates[1]=Returning.
    const mkTemplate = (name: string, fee: number) =>
      p.offerTemplate.create({
        data: {
          tenantId: tenant.id, name, seasonFee: fee,
          installments: OFFER_PRICING.installments, practiceSessions: 0,
          isActive: true, includesUniform: true,
        },
        select: { id: true, name: true, seasonFee: true, installments: true, practiceSessions: true, includesBall: true, includesBag: true, includesShoes: true, includesUniform: true, includesTracksuit: true },
      })
    const templates = [
      await mkTemplate("New Player", OFFER_PRICING.newPlayerFee),
      await mkTemplate("Returning Player", OFFER_PRICING.returningFee),
    ]
    clubRows.set(club.key, { id: tenant.id, ownerId: owner.id, templates })
  }
  console.log(`✓ ${CLUBS.length} clubs adopted/created, branded, templated (${CLUBS.filter((c) => c.featured).length} featured)`)

  // ── Summer league + season + divisions ────────────────────────────────
  const winterLeague = await p.league.create({
    data: {
      name: WINTER_LEAGUE,
      description: "North Pole Hoops' flagship grade-based circuit, every game scored live with stats, standings and recaps.",
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
      endDate: new Date(now.getTime() + days(40)), // wraps up end of August (owner 2026-07-23)
      // Fee/deposit/format inherit from the NPH org rulebook (Phase A).
      // Summer keeps DELIBERATE overrides — 20 games (vs the org's 12),
      // its own venue hours, and locked explicit tiebreakers — so the
      // "Overrides · Reset to organization" UI has a live demo.
      gamesGuaranteed: SUMMER_GAMES_PER_TEAM,
      // Weekend style (owner 2026-08-01): NPH's norm is ONE TRIP — both
      // weekend games the same day with a break; teams may override.
      defaultWeekendStyle: "SAME_DAY",
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
      // Derived naming (league-ia-redesign §4): composed, same shape everywhere
      data: { seasonId: winterSeason.id, name: `Grade ${g} Boys · Tier 1`, ageGroup: `Grade ${g}`, gender: "MALE" },
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

  // 10 weekend sessions: 4 played, week 5 = today + next Saturday, weeks
  // 6-10 run the season to end of August (owner 2026-07-23: the old league
  // was almost done — extend it so demos always have upcoming games)
  const dow = now.getDay()
  const lastSaturday = dow === 6 ? 0 : -((dow + 1) % 7)
  const summerSessions = await buildSessions(
    winterSeason.id,
    [
      { label: "Weekend 1", dayOffsets: [lastSaturday - 28, lastSaturday - 27] },
      { label: "Weekend 2", dayOffsets: [lastSaturday - 21, lastSaturday - 20] },
      { label: "Weekend 3", dayOffsets: [lastSaturday - 14, lastSaturday - 13] },
      { label: "Weekend 4", dayOffsets: [lastSaturday - 7, lastSaturday - 6] },
      { label: "Weekend 5", dayOffsets: [0, lastSaturday + 7] }, // today + next Saturday
      { label: "Weekend 6", dayOffsets: [lastSaturday + 14, lastSaturday + 15] },
      { label: "Weekend 7", dayOffsets: [lastSaturday + 21, lastSaturday + 22] },
      { label: "Weekend 8", dayOffsets: [lastSaturday + 28, lastSaturday + 29] },
      { label: "Weekend 9", dayOffsets: [lastSaturday + 35, lastSaturday + 36] },
      { label: "Weekend 10", dayOffsets: [lastSaturday + 42, lastSaturday + 43] },
    ],
    2
  )
  console.log(`✓ ${WINTER_LEAGUE} · ${WINTER_SEASON} · 4 grade divisions · 4 venues (2 courts each) · 10 weekend sessions (ends late August)`)

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

      // ~30% of a squad are returning players (kit carries over); rest New
      const template = rnd() < 0.3 ? row.templates[1] : row.templates[0]
      const seasonFee = Number(template.seasonFee)

      // Tryout ~10-11 weeks back, published, with roll-call history
      const tryoutAt = new Date(now.getTime() - days(74 - Math.floor(rnd() * 6)))
      tryoutAt.setHours(18, 0, 0, 0)
      const tryout = await p.tryout.create({
        data: {
          tenantId: row.id, teamId: team.id,
          title: `${club.name} Grade ${grade} Tryouts, ${WINTER_SEASON}`,
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
            message: `Congratulations, we'd love to have ${kidName.firstName} on the Grade ${grade} squad this season.`,
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
            description: `${WINTER_SEASON} season fee for ${teamName}`,
            amount: seasonFee, status: obligationStatus,
            dueDate: new Date(tryoutAt.getTime() + days(30)),
          },
          select: { id: true },
        })
        if (obligationStatus !== "PENDING") {
          // Deposit (a quarter, paid on accept) + 3 equal monthly installments
          const n = template.installments // 4
          const perInstallment = Math.round((seasonFee / n) * 100) / 100
          const paidCount = obligationStatus === "PAID" ? n : Math.max(1, n - 1)
          for (let k = 0; k < paidCount; k++) {
            await p.payment.create({
              data: {
                payerId: parent.id, tenantId: row.id,
                amount: perInstallment, currency: "CAD",
                status: "SUCCEEDED", paymentType: "SEASON_FEE",
                method: pick(["ETRANSFER", "ETRANSFER", "CASH", "CHEQUE"]),
                obligationId: obligation.id, recordedById: row.ownerId,
                description:
                  k === 0
                    ? `${WINTER_SEASON} deposit for ${teamName}`
                    : `${WINTER_SEASON} installment ${k}/3 for ${teamName}`,
                installmentNumber: k + 1,
                // deposit on accept, then the 1st of each following month
                createdAt: new Date(respondedAt.getTime() + days(k * 30)),
              },
            })
          }
        }
      }

      // One-click league submit → frozen, locked roster
      const submission = await p.teamSubmission.create({
        data: { seasonId: winterSeason.id, divisionId: winterDivisions.get(grade).id, teamId: team.id, status: "APPROVED", paymentStatus: "PAID_MANUAL" },
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
          description: `${WINTER_LEAGUE} team entry for ${teamName} (${WINTER_SEASON})`,
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
          description: `${WINTER_LEAGUE} team entry for ${teamName} (${WINTER_SEASON})`,
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
  // past sessions): 8 games/team across the four played weekends, Week 5 as
  // two single-day passes (1 game/team today, 1 next Saturday), then weeks
  // 6-10 in one future pass (2/team/weekend through end of August).
  const week5Id = summerSessions.find((s) => s.label === "Weekend 5")!.id
  const futureWeekIds = new Set(
    summerSessions.filter((s) => /Weekend (6|7|8|9|10)$/.test(s.label)).map((s) => s.id)
  )
  const week5Session = schedInput.sessions.find((s: any) => s.id === week5Id)!
  const playedPass = generateSchedule({
    ...schedInput,
    gamesGuaranteed: 8,
    sessions: schedInput.sessions.filter(
      (s: any) => s.id !== week5Id && !futureWeekIds.has(s.id)
    ),
  })
  const week5DayPasses = week5Session.days.map((day: any) =>
    generateSchedule({
      ...schedInput,
      gamesGuaranteed: 1,
      sessions: [{ ...week5Session, days: [day] }],
    })
  )
  const futurePass = generateSchedule({
    ...schedInput,
    gamesGuaranteed: 10,
    sessions: schedInput.sessions.filter((s: any) => futureWeekIds.has(s.id)),
  })
  const allPasses = [playedPass, ...week5DayPasses, futurePass]
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

  // ── Referee booking demo: pool + availability + a live broadcast offer ─
  for (const refId of refIds) {
    await p.leagueReferee.create({ data: { leagueId: winterLeague.id, userId: refId } })
  }
  const week5SatDay = await p.seasonSessionDay.findFirst({
    where: { sessionId: summerSessions.find((s) => s.label === "Weekend 5")!.id, date: { gt: now } },
    orderBy: { date: "asc" },
    select: { id: true, date: true },
  })
  if (week5SatDay) {
    // Mike + Sarah have said they can work Saturday; James/Priya are silent
    for (const refId of refIds.slice(0, 2)) {
      await p.refereeAvailability.create({
        data: { userId: refId, date: new Date(`${new Date(week5SatDay.date).toISOString().slice(0, 10)}T00:00:00.000Z`), startTime: "09:00", endTime: "18:00" },
      })
    }
    const offer = await p.refereeSessionRequest.create({
      data: {
        leagueId: winterLeague.id,
        sessionDayId: week5SatDay.id,
        startTime: "09:00",
        endTime: "15:00",
        message: "Final regular-season Saturday, two courts running all morning.",
        createdById: nph.id,
      },
      select: { id: true },
    })
    for (const refId of refIds) {
      await p.notification.create({
        data: {
          userId: refId,
          type: "referee_request",
          title: `${WINTER_LEAGUE} needs a referee`,
          message: "Saturday 09:00–15:00, first to accept gets the day.",
          link: "/referee/requests",
          referenceId: offer.id,
          referenceType: "RefereeSessionRequest",
        },
      })
    }
    console.log("✓ referee pool (4) + Sat availability (Mike, Sarah) + 1 broadcast shift offer pending")
  }

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
        body: "Courtside highlights from around the NPH Showcase League. Follow your team to catch every clip.",
        status: "PUBLISHED", publishedAt: new Date(now.getTime() - days(i * 2 + 1)),
        authorId: nph.id,
        tags: { create: [{ leagueId: winterLeague.id }, { teamId: team.id }, { tenantId: team.tenantId }] },
        media: { create: [{ type: "VIDEO_EMBED", url: `https://www.youtube.com/embed/${v.id}`, posterUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, title: v.title }] },
      },
    })
  }
  const annos = [
    { key: "lords", title: "Summer 2026 championship picture taking shape", content: "Top four in each grade division qualify for championship weekend at Pan Am Sports Centre, July 25–26. All games live-scored with stats and recaps." },
    { key: "force", title: "Fall League tryouts open across the West End", content: "Burlington Force, West United and the Monarchs have posted Fall League tryouts. Register on the marketplace, roll call happens on your phone at the door." },
    { key: "crown", title: "March Break Elite Camp: registration open", content: "Five days of skill development with our coaching staff. Ages 12–17, all levels welcome. Early-bird pricing ends February 1." },
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
    ["Great coaches, great communication", "Our son improved so much this season. Offers, sizes and payments were all on our phone. Zero paperwork."],
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
      description: "NPH's fall season: October through March, registration open now. Clubs are holding tryouts and submitting rosters.",
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
      // Fee, deposit, format (12 games), tiebreakers: inherited from the
      // NPH org rulebook (fields null on purpose, Phase A).
      // Clubs may edit rosters until the first fall session wraps
      rosterChangePolicy: "OPEN_UNTIL_DEADLINE",
      rosterChangeDeadline: new Date(fallStart.getTime() + days(9)),
    },
  })
  const springDivisions = new Map<number, any>()
  for (const g of [9, 10]) {
    springDivisions.set(g, await p.division.create({
      data: { seasonId: springSeason.id, name: `Grade ${g} Boys · Tier 1`, ageGroup: `Grade ${g}`, gender: "MALE" },
    }))
  }
  // The NPH norm (owner 2026-07-31): 5 weekend sessions, Sat+Sun each —
  // 10 games ÷ 5 sessions derives 2 games per team per weekend.
  const fallBase = Math.round((fallStart.getTime() - now.getTime()) / 86400_000)
  const nextSaturday = (offset: number) => {
    const d = new Date(now.getTime() + days(offset))
    return offset + ((6 - d.getDay() + 7) % 7)
  }
  await buildSessions(
    springSeason.id,
    Array.from({ length: 5 }, (_, m) => {
      const sat = nextSaturday(fallBase + m * 30 + 7)
      return {
        label: ["October", "November", "December", "January", "February"][m],
        dayOffsets: [sat, sat + 1],
      }
    }),
    2
  )

  // Scheduler-ready fall field (owner 2026-07-29): 8 teams — 4 per grade
  // division — APPROVED with LOCKED rosters and PAID entry fees, so NPH can
  // close registration and run schedule generation LIVE in the demo (the
  // summer league already shows the generated end state). Recruiting clubs'
  // fall entries here use their OTHER grade, so the tryout story still holds.
  const FALL_READY: Array<[string, number]> = [
    ["force", 9], ["monarchs", 9], ["kings", 9], ["lions", 9],
    ["west", 10], ["cityabove", 10], ["polaris", 10], ["crown", 10],
  ]
  for (const [clubKey, sourceGrade] of FALL_READY) {
    const club = CLUBS.find((c) => c.key === clubKey)!
    const row = clubRows.get(clubKey)!
    const source = teams.find((t) => t.clubKey === clubKey && t.grade === sourceGrade)!
    const team = await p.team.create({
      data: { tenantId: row.id, name: `${club.name} Fall Grade ${sourceGrade}`, ageGroup: `Grade ${sourceGrade}`, gender: "MALE", season: SPRING_SEASON, description: MARKER },
      select: { id: true },
    })
    for (let i = 0; i < source.roster.length; i++) {
      await p.teamPlayer.create({ data: { teamId: team.id, playerId: source.roster[i], jerseyNumber: 4 + i, status: "ACTIVE" } })
    }
    const submission = await p.teamSubmission.create({
      data: {
        seasonId: springSeason.id, divisionId: springDivisions.get(sourceGrade).id, teamId: team.id,
        status: "APPROVED", registrationFee: LEAGUE_TEAM_FEE, paymentStatus: "PAID_MANUAL",
      },
      select: { id: true },
    })
    await p.seasonRoster.create({
      data: {
        seasonId: springSeason.id, teamSubmissionId: submission.id, isLocked: true,
        submittedAt: new Date(now.getTime() - days(9)),
        lockedAt: new Date(now.getTime() - days(7)),
        players: { create: source.roster.map((playerId, i) => ({ playerId, jerseyNumber: 4 + i })) },
      },
    })
    const fallFeeObligation = await p.paymentObligation.create({
      data: {
        payerTenantId: row.id, payeeLeagueId: springLeague.id,
        referenceType: "TeamSubmission", referenceId: submission.id,
        description: `${SPRING_LEAGUE} team entry for ${club.name} Fall Grade ${sourceGrade} (${SPRING_SEASON})`,
        amount: LEAGUE_TEAM_FEE, status: "PAID",
      },
      select: { id: true },
    })
    await p.payment.create({
      data: {
        obligationId: fallFeeObligation.id,
        amount: LEAGUE_TEAM_FEE, currency: "CAD",
        status: "SUCCEEDED", paymentType: "LEAGUE_FEE", method: "ETRANSFER",
        payeeId: nph.id, recordedById: nph.id,
        description: `${SPRING_LEAGUE} team entry for ${club.name} Fall Grade ${sourceGrade} (${SPRING_SEASON})`,
        createdAt: new Date(now.getTime() - days(6)),
      },
    })
  }

  // Realistic division sizes (owner 2026-07-31; NPH-style grade divisions
  // run 8-12 teams, not 4): every FALL_READY club also fields its OTHER
  // grade, and two clubs per grade run a second "White" squad → 10 teams
  // per division, 100 games at the 10-game guarantee.
  const mkFallTeam = async (clubKey: string, grade: number, suffix?: string) => {
    const club = CLUBS.find((c) => c.key === clubKey)!
    const row = clubRows.get(clubKey)!
    const teamName = `${club.name} Fall Grade ${grade}${suffix ? ` ${suffix}` : ""}`
    const team = await p.team.create({
      data: { tenantId: row.id, name: teamName, ageGroup: `Grade ${grade}`, nameSuffix: suffix ?? null, gender: "MALE", season: SPRING_SEASON, description: MARKER },
      select: { id: true },
    })
    const rosterIds: string[] = []
    for (let i = 0; i < 10; i++) {
      const parent = await mkUser(
        `parent-fall-${clubKey}-g${grade}${suffix ? "w" : ""}-${String(i + 1).padStart(2, "0")}@${EMAIL_DOMAIN}`,
        pick(ADULT_NAMES),
        pick(LAST_NAMES)
      )
      await p.userRole.create({ data: { userId: parent.id, role: "Parent" } })
      const player = await p.player.create({
        data: {
          firstName: pick(BOY_NAMES), lastName: pick(LAST_NAMES),
          dateOfBirth: new Date(Date.UTC(GRADES[grade].birthYear, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28))),
          gender: "MALE", isMinor: true, parentId: parent.id,
          position: pick(["Guard", "Guard", "Forward", "Forward", "Center"]),
        },
        select: { id: true },
      })
      await p.teamPlayer.create({ data: { teamId: team.id, playerId: player.id, jerseyNumber: 4 + i, status: "ACTIVE" } })
      rosterIds.push(player.id)
    }
    const submission = await p.teamSubmission.create({
      data: {
        seasonId: springSeason.id, divisionId: springDivisions.get(grade).id, teamId: team.id,
        status: "APPROVED", registrationFee: LEAGUE_TEAM_FEE, paymentStatus: "PAID_MANUAL",
      },
      select: { id: true },
    })
    await p.seasonRoster.create({
      data: {
        seasonId: springSeason.id, teamSubmissionId: submission.id, isLocked: true,
        submittedAt: new Date(now.getTime() - days(9)),
        lockedAt: new Date(now.getTime() - days(7)),
        players: { create: rosterIds.map((playerId, i) => ({ playerId, jerseyNumber: 4 + i })) },
      },
    })
    const fillerObligation = await p.paymentObligation.create({
      data: {
        payerTenantId: row.id, payeeLeagueId: springLeague.id,
        referenceType: "TeamSubmission", referenceId: submission.id,
        description: `${SPRING_LEAGUE} team entry for ${teamName} (${SPRING_SEASON})`,
        amount: LEAGUE_TEAM_FEE, status: "PAID",
      },
      select: { id: true },
    })
    await p.payment.create({
      data: {
        obligationId: fillerObligation.id,
        amount: LEAGUE_TEAM_FEE, currency: "CAD",
        status: "SUCCEEDED", paymentType: "LEAGUE_FEE", method: "ETRANSFER",
        payeeId: nph.id, recordedById: nph.id,
        description: `${SPRING_LEAGUE} team entry for ${teamName} (${SPRING_SEASON})`,
        createdAt: new Date(now.getTime() - days(6)),
      },
    })
  }
  for (const [clubKey, sourceGrade] of FALL_READY) {
    await mkFallTeam(clubKey, sourceGrade === 9 ? 10 : 9)
  }
  await mkFallTeam("force", 9, "White")
  await mkFallTeam("monarchs", 9, "White")
  await mkFallTeam("west", 10, "White")
  await mkFallTeam("cityabove", 10, "White")

  // Two teams per division prefer SPLIT days (owner 2026-08-01) — the
  // fairness report shows both styles honored side by side.
  const splitTeams = await p.teamSubmission.findMany({
    where: { seasonId: springSeason.id, team: { name: { contains: "White" } } },
    select: { id: true },
  })
  for (const sub of splitTeams) {
    await p.teamSubmission.update({
      where: { id: sub.id },
      data: { weekendStyle: "SPLIT_DAYS" },
    })
  }

  // Schedule requests (owner 2026-08-01): league-enabled per team, approved
  // = best effort. Force's two Fall teams demo the whole loop from one
  // club login (owner-force@): an APPROVED early-Sunday window (the Ottawa
  // travel story) + a PENDING late-Saturday request the league can Simulate
  // and Approve live. Polaris gets a league-added blackout (no request).
  const forceOwnerId = clubRows.get("force")!.ownerId
  const reqSub = async (namePart: string) =>
    p.teamSubmission.findFirst({
      where: { seasonId: springSeason.id, team: { name: { contains: namePart } } },
      select: { id: true },
    })
  const forceFallG9Sub = await reqSub("Burlington Force Fall Grade 9")
  const forceFallG10Sub = await reqSub("Burlington Force Fall Grade 10")
  if (forceFallG9Sub) {
    await p.teamSubmission.update({
      where: { id: forceFallG9Sub.id },
      data: { scheduleRequestsEnabled: true },
    })
    await p.teamScheduleRequest.create({
      data: {
        submissionId: forceFallG9Sub.id,
        kind: "WINDOW",
        status: "APPROVED",
        dayOfWeek: 0,
        latestStart: "12:00",
        reason: "Traveling back to Ottawa. We need to head home early Sunday afternoon.",
        requestedById: forceOwnerId,
        decidedById: nph.id,
        decidedAt: new Date(now.getTime() - days(2)),
        decisionNote: "Approved: best effort, we'll aim your Sunday games at the morning block.",
      },
    })
  }
  if (forceFallG10Sub) {
    await p.teamSubmission.update({
      where: { id: forceFallG10Sub.id },
      data: { scheduleRequestsEnabled: true },
    })
    await p.teamScheduleRequest.create({
      data: {
        submissionId: forceFallG10Sub.id,
        kind: "WINDOW",
        status: "PENDING",
        dayOfWeek: 6,
        earliestStart: "14:00",
        reason: "Our head coach works Saturday mornings, so afternoon tip-offs only, please.",
        requestedById: forceOwnerId,
      },
    })
  }
  const polarisG9 = await reqSub("Polaris Prep Fall Grade 9")
  if (polarisG9) {
    const fallDays = await p.seasonSessionDay.findMany({
      where: { session: { seasonId: springSeason.id } },
      select: { date: true },
      orderBy: { date: "asc" },
    })
    const blackoutDay = fallDays[2]?.date
    if (blackoutDay) {
      await p.seasonTeamBlackout.create({
        data: {
          teamSubmissionId: polarisG9.id,
          date: blackoutDay,
          reason: "Team away at a tournament",
        },
      })
    }
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
  const lordsSpringTemplate = lordsRow.templates[0] // New Player (fresh recruit)

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
        title: `${club.name} Fall League Tryouts, Grade ${grade}`,
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
              : `${kid.firstName} impressed at evaluations. We'd love to have him on the Fall Elite roster. Premium package includes full kit.`,
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
          // The demo parent's open offer carries TWO packages — the family
          // picks Returning vs New Player at accept (engagement demo)
          const fullFee = Number(lordsSpringTemplate.seasonFee)
          await p.offerOption.createMany({
            data: [
              {
                offerId: offer.id, label: "Returning Player", sortOrder: 0,
                sourceTemplateId: lordsSpringTemplate.id,
                seasonFee: Math.round(fullFee * 0.8), installments: lordsSpringTemplate.installments,
                practiceSessions: lordsSpringTemplate.practiceSessions,
                includesBall: false, includesBag: false, includesShoes: false,
                includesUniform: false, includesTracksuit: false,
              },
              {
                offerId: offer.id, label: "New Player", sortOrder: 1,
                sourceTemplateId: lordsSpringTemplate.id,
                seasonFee: fullFee, installments: lordsSpringTemplate.installments,
                practiceSessions: lordsSpringTemplate.practiceSessions,
                includesBall: lordsSpringTemplate.includesBall, includesBag: lordsSpringTemplate.includesBag,
                includesShoes: lordsSpringTemplate.includesShoes, includesUniform: lordsSpringTemplate.includesUniform,
                includesTracksuit: lordsSpringTemplate.includesTracksuit,
              },
            ],
          })
          await p.offer.update({
            where: { id: offer.id },
            data: {
              seasonFee: Math.round(fullFee * 0.8),
              includesBall: false, includesBag: false, includesShoes: false,
              includesUniform: false, includesTracksuit: false,
              message: `${kid.firstName} impressed at evaluations. We'd love to have him on the Fall Elite roster. Pick the package that fits: returning players keep their kit.`,
            },
          })
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
        message: "Toronto Lords Fall Elite has sent an offer: Premium package, expires in 7 days.",
        link: "/offers", referenceId: springOfferForDemo, referenceType: "Offer",
      },
    })
  }

  // ── SOCIAL LAYER (social-feed-plan P1–P5, seeded 2026-07-23) ──────────
  // POTG on every completed game + system final posts, consent/visibility
  // for the demo kids, active stories + card posts, player follows incl. one
  // PENDING request (the approval demo), story views, reactions, comments
  // (one auto-hidden by reports), reposts, and a club article — so the feed,
  // stories rail, and moments surfaces are alive on first login.
  const kidRows = await p.player.findMany({
    where: { parentId: { in: [demoParent.id, demoParent2.id] } },
    select: {
      id: true, firstName: true, lastName: true, parentId: true,
      teams: { where: { status: "ACTIVE" }, select: { teamId: true } },
    },
  })
  const kidLords = kidRows.find(
    (k: any) => k.parentId === demoParent.id && k.teams.some((t: any) => t.teamId === lordsG9.id)
  )!
  const kidForce = kidRows.find(
    (k: any) => k.parentId === demoParent.id && k.teams.some((t: any) => t.teamId === forceG10.id)
  )!
  const kidMalik = kidRows.find((k: any) => k.parentId === demoParent2.id)!

  // Demo kids: consent granted; Lords kid PUBLIC, the others PRIVATE
  await p.player.update({ where: { id: kidLords.id }, data: { mediaConsent: "GRANTED", socialVisibility: "PUBLIC" } })
  await p.player.update({ where: { id: kidForce.id }, data: { mediaConsent: "GRANTED", socialVisibility: "PRIVATE" } })
  await p.player.update({ where: { id: kidMalik.id }, data: { mediaConsent: "GRANTED", socialVisibility: "PRIVATE" } })

  // POTG: top scorer everywhere, except each demo kid takes their own best game
  const potgByGame = new Map<string, { playerId: string; name: string }>()
  for (const gameId of completedGameIds) {
    const top = await p.playerStat.findFirst({
      where: { gameId }, orderBy: { points: "desc" },
      select: { playerId: true, player: { select: { firstName: true, lastName: true } } },
    })
    if (top) potgByGame.set(gameId, { playerId: top.playerId, name: `${top.player.firstName} ${top.player.lastName}` })
  }
  const kidBestGame = new Map<string, string>() // kidId → gameId
  for (const kid of [kidLords, kidForce, kidMalik]) {
    const best = await p.playerStat.findFirst({
      where: { playerId: kid.id, gameId: { in: completedGameIds } },
      orderBy: { points: "desc" }, select: { gameId: true },
    })
    if (best) {
      kidBestGame.set(kid.id, best.gameId)
      potgByGame.set(best.gameId, { playerId: kid.id, name: `${kid.firstName} ${kid.lastName}` })
    }
  }
  let finalPosts = 0
  for (const [gameId, potg] of potgByGame) {
    const g = await p.game.findUnique({
      where: { id: gameId },
      select: {
        homeScore: true, awayScore: true, finalizedAt: true, homeTeamId: true, awayTeamId: true,
        homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } },
      },
    })
    if (!g) continue
    await p.game.update({ where: { id: gameId }, data: { potgPlayerId: potg.playerId } })
    await p.post.create({
      data: {
        kind: "PLAYER_OF_GAME",
        title: `Final: ${g.homeTeam.name} ${g.homeScore}–${g.awayScore} ${g.awayTeam.name}`,
        slug: `final-${gameId}`,
        body: `Player of the Game: ${potg.name}.`,
        status: "PUBLISHED", publishedAt: g.finalizedAt ?? now, visibility: "PUBLIC",
        tags: { create: [{ gameId }, { teamId: g.homeTeamId }, { teamId: g.awayTeamId }] },
      },
    })
    finalPosts++
  }

  // Stories (active now) + permanent card posts for the demo kids
  const storyFor = async (kid: any, visibility: "PUBLIC" | "FOLLOWERS", cardType: "STAT_CARD" | "POTG") => {
    const gameId = kidBestGame.get(kid.id)
    if (!gameId) return null
    return p.story.create({
      data: {
        playerId: kid.id, gameId, cardType, visibility, templateId: "bold",
        createdByUserId: kid.parentId,
        createdAt: new Date(now.getTime() - 3 * 3600_000),
        expiresAt: new Date(now.getTime() + 21 * 3600_000),
      },
      select: { id: true },
    })
  }
  const storyLords = await storyFor(kidLords, "PUBLIC", "POTG")
  const storyForce = await storyFor(kidForce, "FOLLOWERS", "STAT_CARD")
  await storyFor(kidMalik, "FOLLOWERS", "STAT_CARD")
  const cardPostFor = async (kid: any, visibility: "PUBLIC" | "FOLLOWERS", cardType: "STAT_CARD" | "POTG") => {
    const gameId = kidBestGame.get(kid.id)
    if (!gameId) return null
    const stat = await p.playerStat.findUnique({
      where: { gameId_playerId: { gameId, playerId: kid.id } },
      select: { points: true, rebounds: true, assists: true },
    })
    return p.post.create({
      data: {
        kind: cardType === "POTG" ? "PLAYER_OF_GAME" : "STAT_CARD",
        title: cardType === "POTG"
          ? `${kid.firstName} ${kid.lastName}: Player of the Game`
          : `${kid.firstName} ${kid.lastName}: ${stat?.points ?? 0} points`,
        slug: `card-${cardType.toLowerCase().replace("_", "-")}-${gameId.slice(0, 8)}-${kid.id.slice(0, 8)}`,
        body: stat ? `${stat.points} PTS · ${stat.rebounds} REB · ${stat.assists} AST.` : "",
        status: "PUBLISHED", publishedAt: new Date(now.getTime() - 3 * 3600_000),
        authorId: kid.parentId, visibility, templateId: "bold",
        tags: { create: [{ playerId: kid.id }, { gameId }] },
      },
      select: { id: true },
    })
  }
  const cardPostLords = await cardPostFor(kidLords, "PUBLIC", "POTG")
  await cardPostFor(kidForce, "FOLLOWERS", "STAT_CARD")

  // Player follows: fans + family follow the PUBLIC kid; one PENDING request
  // sits on the demo parent's edit page (the approval demo); Sana has a
  // "Requested" state of her own to show the other side.
  const fanIds = [
    ...lordsG9.rosterParents.slice(0, 3),
    ...forceG10.rosterParents.slice(0, 2),
    demoParent2.id,
  ].filter((id: string) => id !== demoParent.id)
  for (const userId of new Set(fanIds)) {
    await p.follow.create({ data: { userId, playerId: kidLords.id, status: "ACTIVE" } }).catch(() => {})
  }
  await p.follow.create({
    data: { userId: lordsG9.rosterParents[4] ?? demoParent2.id, playerId: kidForce.id, status: "PENDING" },
  }).catch(() => {})
  await p.notification.create({
    data: {
      userId: demoParent.id, type: "follow_request", title: "New follow request",
      message: "A Lords family asked to follow your player.",
      link: `/players/${kidForce.id}/edit`, referenceId: kidForce.id, referenceType: "Player",
    },
  })
  await p.follow.create({ data: { userId: demoParent2.id, playerId: kidForce.id, status: "PENDING" } }).catch(() => {})

  // Story views + reactions + comments + reposts from the crowd
  if (storyLords) {
    for (const userId of new Set(fanIds).values()) {
      await p.storyView.create({ data: { storyId: storyLords.id, userId } }).catch(() => {})
    }
  }
  if (storyForce) {
    await p.storyView.create({ data: { storyId: storyForce.id, userId: demoParent2.id } }).catch(() => {})
  }
  const crowd = [...lordsG9.rosterParents, ...forceG10.rosterParents]
  const finalPostRows = await p.post.findMany({
    where: { kind: "PLAYER_OF_GAME", slug: { startsWith: "final-" } },
    select: { id: true }, orderBy: { publishedAt: "desc" }, take: 8,
  })
  const emojis = ["🔥", "🏀", "👍", "❤️", "🎉"]
  let reactions = 0
  for (let i = 0; i < finalPostRows.length; i++) {
    for (let k = 0; k < 2 + (i % 3); k++) {
      const userId = crowd[(i * 5 + k * 3) % crowd.length]
      await p.postReaction.create({
        data: { postId: finalPostRows[i].id, userId, emoji: emojis[(i + k) % emojis.length] },
      }).catch(() => {})
      reactions++
    }
  }
  const commentLines = [
    "What a game! The fourth quarter was unreal.",
    "Go Lords! 🏀",
    "Defense wins games. Proud of these kids.",
    "That comeback!!",
    "Great officiating tonight too, smooth game.",
  ]
  if (cardPostLords) {
    for (let i = 0; i < 3; i++) {
      await p.comment.create({
        data: {
          postId: cardPostLords.id, authorId: crowd[(i * 7 + 1) % crowd.length],
          body: commentLines[i], createdAt: new Date(now.getTime() - (2 - i) * 3600_000),
        },
      })
    }
    // Moderation demo: an auto-hidden comment (3 reports)
    await p.comment.create({
      data: {
        postId: cardPostLords.id, authorId: crowd[9 % crowd.length],
        body: "ref was garbage, total fix", status: "HIDDEN", reportCount: 3,
      },
    })
    await p.postReaction.create({
      data: { postId: cardPostLords.id, userId: demoParent2.id, emoji: "🔥" },
    }).catch(() => {})
    await p.repost.create({ data: { postId: cardPostLords.id, userId: demoParent2.id } }).catch(() => {})
  }
  for (let i = 0; i < Math.min(3, finalPostRows.length); i++) {
    await p.comment.create({
      data: {
        postId: finalPostRows[i].id, authorId: crowd[(i * 11 + 2) % crowd.length],
        body: commentLines[(i + 2) % commentLines.length],
      },
    })
  }
  await p.repost.create({
    data: { postId: finalPostRows[0]?.id, userId: crowd[3 % crowd.length] },
  }).catch(() => {})

  // A club article post (org posting surface)
  await p.post.create({
    data: {
      kind: "ARTICLE", title: "Championship weekend: what families need to know",
      slug: `lords-championship-weekend-${Date.now().toString(36)}`,
      body: "Top four in each grade division qualify for championship weekend at Pan Am Sports Centre, August 29–30. Doors open 45 minutes before tip. Every game is live-scored with stats, recaps, and Player of the Game cards families can share straight from the game page.",
      status: "PUBLISHED", publishedAt: new Date(now.getTime() - days(1)),
      authorId: clubRows.get("lords")!.ownerId, visibility: "PUBLIC",
      tags: { create: [{ tenantId: clubRows.get("lords")!.id }, { leagueId: winterLeague.id }] },
    },
  })
  console.log(
    `✓ social layer: POTG + ${finalPosts} final posts · 3 stories (1 public, 2 followers) · card posts · ${reactions} reactions · comments (1 auto-hidden) · player follows (+1 pending request) · reposts · club article`
  )

  // ── Team chats: every winter team has a living thread ─────────────────
  const chatLines: Array<[string, "coach" | "parent"]> = [
    ["Practice moved to 6:30pm this Thursday, same gym.", "coach"],
    ["Thanks coach, we'll be there!", "parent"],
    ["Great win on Saturday everyone. Film session before next practice.", "coach"],
    ["Does anyone have a spare size AM jersey for pictures?", "parent"],
    ["Reminder: bring BOTH jerseys to every game from now on.", "coach"],
    ["Carpool from the west end: we have 2 seats, message me.", "parent"],
    ["Team photos this Saturday, arrive 45 min before tip.", "coach"],
    ["What time do doors open at Pan Am for the early game?", "parent"],
    ["Doors open 8:15 for the 9am tip.", "coach"],
    ["Standings update: we're in the playoff picture, keep it going!", "coach"],
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
      message: "Coach: Standings update, we're in the playoff picture!",
      link: `/teams/${lordsG9.id}/chat`, referenceId: lordsG9.id, referenceType: "Team",
    },
  })
  console.log(`✓ ${chatMessages} chat messages across ${teams.length} team chats (demo parent has unread + bell)`)

  // ── Team poll on the Lords G9 (engagement v1 demo) ─────────────────────
  // Most families have voted; the demo parent hasn't — the demo shows the
  // live voting flow and staff-side voter names.
  const lordsPoll = await p.poll.create({
    data: {
      teamId: lordsG9.id,
      createdById: lordsG9.coachId,
      title: "Summer tournament plans",
      description: "Two questions to help us commit to August tournaments before entry deadlines.",
      createdAt: new Date(now.getTime() - days(2)),
      questions: {
        create: [
          {
            prompt: "Should we enter the Waterloo Summer Classic? ($95/player, Aug 15-16)",
            order: 0,
            options: {
              create: [
                { label: "Yes, count us in", order: 0 },
                { label: "No, sitting this one out", order: 1 },
                { label: "Yes, if we can carpool", order: 2 },
              ],
            },
          },
          {
            prompt: "Which August weekends can your family travel?",
            allowMultiple: true,
            order: 1,
            options: {
              create: [
                { label: "Aug 8-9", order: 0 },
                { label: "Aug 15-16", order: 1 },
                { label: "Aug 22-23", order: 2 },
              ],
            },
          },
        ],
      },
    },
    include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
  })
  const [pollQ1, pollQ2] = lordsPoll.questions
  const pollVoters = lordsG9.rosterParents.filter((id: string) => id !== demoParent.id)
  let pollVotes = 0
  for (let i = 0; i < pollVoters.length; i++) {
    const userId = pollVoters[i]
    // Q1 single choice: mostly "yes", a few carpool-dependent, one "no"
    const q1Option = pollQ1.options[i % 5 === 3 ? 2 : i % 7 === 5 ? 1 : 0]
    await p.pollVote.create({ data: { questionId: pollQ1.id, optionId: q1Option.id, userId } })
    pollVotes++
    // Q2 multi choice: 1-2 weekends each
    const first = pollQ2.options[i % 3]
    await p.pollVote.create({ data: { questionId: pollQ2.id, optionId: first.id, userId } })
    pollVotes++
    if (i % 2 === 0) {
      const second = pollQ2.options[(i + 1) % 3]
      await p.pollVote.create({ data: { questionId: pollQ2.id, optionId: second.id, userId } })
      pollVotes++
    }
  }
  await p.notification.create({
    data: {
      userId: demoParent.id, type: "team_poll",
      title: `New poll for ${lordsG9.name}`,
      message: "Summer tournament plans",
      link: `/teams/${lordsG9.id}/polls`, referenceId: lordsPoll.id, referenceType: "Poll",
    },
  })
  console.log(`✓ Lords G9 poll "Summer tournament plans" (${pollVotes} votes; demo parent hasn't voted)`)

  // ── Practice schedules ─────────────────────────────────────────────────
  // Every team gets recurring practice days (varied); the Lords G9 schedule
  // is ANNOUNCED with 3 weeks of dated occurrences so the calendar + phone
  // feed demo has real data. One practice is cancelled to show the flow.
  const slotPatterns: Array<Array<{ dayOfWeek: number; startTime: string }>> = [
    [{ dayOfWeek: 2, startTime: "18:30" }, { dayOfWeek: 4, startTime: "19:00" }],
    [{ dayOfWeek: 1, startTime: "18:00" }, { dayOfWeek: 3, startTime: "18:30" }],
    [{ dayOfWeek: 3, startTime: "19:30" }, { dayOfWeek: 5, startTime: "18:00" }],
  ]
  for (let ti = 0; ti < teams.length; ti++) {
    const team = teams[ti]
    for (const pattern of slotPatterns[ti % slotPatterns.length]) {
      await p.practiceSlot.create({
        data: {
          teamId: team.id,
          dayOfWeek: pattern.dayOfWeek,
          startTime: pattern.startTime,
          durationMinutes: 90,
          location: "Main Gym",
        },
      })
    }
  }
  const lordsSlots = await p.practiceSlot.findMany({ where: { teamId: lordsG9.id } })
  let lordsPractices = 0
  let cancelledOne = false
  for (let d = 0; d < 21; d++) {
    const day = new Date(now.getTime() + d * 86_400_000)
    for (const slot of lordsSlots) {
      if (day.getDay() !== slot.dayOfWeek) continue
      const [hh, mm] = slot.startTime.split(":").map(Number)
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm)
      if (at.getTime() <= now.getTime()) continue
      const cancelThis = !cancelledOne && d >= 7
      await p.practice.create({
        data: {
          teamId: lordsG9.id,
          tenantId: lordsG9.tenantId,
          scheduledAt: at,
          duration: slot.durationMinutes,
          location: slot.location,
          slotId: slot.id,
          status: cancelThis ? "CANCELLED" : "SCHEDULED",
        },
      })
      if (cancelThis) cancelledOne = true
      lordsPractices++
    }
  }
  await p.team.update({
    where: { id: lordsG9.id },
    data: { practiceScheduleAnnouncedAt: new Date(now.getTime() - days(1)) },
  })
  // Quick poll IN the Lords chat stream (chat bubble w/ live bars): pizza
  // headcount, most families answered, demo parent hasn't
  const chatPoll = await p.poll.create({
    data: {
      teamId: lordsG9.id,
      createdById: lordsG9.coachId,
      title: "Pizza after Saturday's game? 🍕",
      createdAt: new Date(now.getTime() - 3600_000 * 5),
      questions: {
        create: [{
          prompt: "Pizza after Saturday's game? 🍕",
          order: 0,
          options: { create: [
            { label: "We're in!", order: 0 },
            { label: "Can't make it", order: 1 },
          ] },
        }],
      },
    },
    include: { questions: { include: { options: true } } },
  })
  const chatQ = chatPoll.questions[0]
  await p.teamMessage.create({
    data: {
      teamId: lordsG9.id, senderId: lordsG9.coachId,
      body: "Pizza after Saturday's game? 🍕",
      pollId: chatPoll.id,
      createdAt: new Date(now.getTime() - 3600_000 * 5),
    },
  })
  let chatPollVotes = 0
  for (let i = 0; i < lordsG9.rosterParents.length; i++) {
    const userId = lordsG9.rosterParents[i]
    if (userId === demoParent.id || i % 4 === 3) continue
    await p.pollVote.create({
      data: {
        questionId: chatQ.id,
        optionId: chatQ.options[i % 5 === 2 ? 1 : 0].id,
        userId,
      },
    })
    chatPollVotes++
  }
  console.log(`✓ Chat quick poll in Lords G9 stream (${chatPollVotes} votes; demo parent hasn't voted)`)

  const dayName = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"]
  const slotLabel = (s: { dayOfWeek: number; startTime: string }) => {
    const [h, m] = s.startTime.split(":").map(Number)
    return `${dayName[s.dayOfWeek]} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
  }
  await p.notification.create({
    data: {
      userId: demoParent.id, type: "practice_schedule",
      title: `Practice schedule: ${lordsG9.name}`,
      message: lordsSlots.map(slotLabel).join(" · "),
      link: `/teams/${lordsG9.id}/calendar`, referenceId: lordsG9.id, referenceType: "Team",
    },
  })
  console.log(`✓ Practice slots for ${teams.length} teams; Lords G9 announced w/ ${lordsPractices} dated practices (1 cancelled)`)

  // Team events (one calendar): a Lords photo day by the coach + a
  // league-wide media day across the Summer Grade 9 division by the
  // NPH owner — the multi-team beat in the league demo storyline.
  const photoDay = await p.teamEvent.create({
    data: {
      createdById: lordsG9.coachId,
      title: "Team Photo Day 📸",
      description: "Wear the home jersey, families welcome.",
      location: "Main gym",
      startAt: new Date(now.getTime() + 86_400_000 * 6),
      durationMinutes: 90,
      teams: { create: [{ teamId: lordsG9.id }] },
    },
  })
  await p.notification.create({
    data: {
      userId: demoParent.id, type: "team_event",
      title: `New team event: Team Photo Day 📸`,
      message: "Sat at Main gym, see the team calendar.",
      link: `/teams/${lordsG9.id}/calendar`, referenceId: photoDay.id, referenceType: "TeamEvent",
    },
  })
  const g9SummerTeams = teams.filter((t) => t.grade === 9).slice(0, 6)
  await p.teamEvent.create({
    data: {
      createdById: nph.id,
      title: "NPH Media Day",
      description: "League photo + interview day for Grade 9 teams.",
      location: "Haber Recreation Centre",
      startAt: new Date(now.getTime() + 86_400_000 * 13),
      durationMinutes: 240,
      teams: { create: g9SummerTeams.map((t) => ({ teamId: t.id })) },
    },
  })
  console.log(`✓ Team events: Lords photo day + NPH Media Day across ${g9SummerTeams.length} G9 teams`)

  // Playoff-eligibility demo (owner 2026-07-29): the chronically-absent
  // Force G10 bench kid is ruled ELIGIBLE by the commissioner with a note —
  // the badge shows "* league ruling" while Lords' equivalent stays red.
  const forceG10Summer = teams.find((t) => t.clubKey === "force" && t.grade === 10)!
  await p.playoffEligibilityOverride.create({
    data: {
      seasonId: winterSeason.id,
      playerId: forceG10Summer.roster[forceG10Summer.roster.length - 1],
      eligible: true,
      note: "Injury exemption: missed Weeks 2-4 with a broken wrist; approved by the league July 20.",
      setById: nph.id,
    },
  })
  // Game-day guest demo: a pickup on one LIVE game's home bench, flagged
  // "(Guest)" in the console and box score, excluded from official stats.
  const guestGame = await p.game.findFirst({
    where: { seasonId: winterSeason.id, status: "LIVE" },
    select: { id: true, homeTeamId: true },
  })
  if (guestGame) {
    const guestRow = await p.gameGuestPlayer.create({
      data: {
        gameId: guestGame.id,
        teamId: guestGame.homeTeamId,
        displayName: "Marcus Lee",
        jerseyNumber: 21,
        addedById: nph.id,
      },
      select: { id: true },
    })
    // A few plays so the live box score folds a flagged guest line
    const maxSeq = await p.gameEvent.aggregate({ where: { gameId: guestGame.id }, _max: { sequence: true } })
    let gseq = (maxSeq._max.sequence ?? 0) + 1
    const guestPlays: Array<[string, boolean | null]> = [
      ["SCORE_2PT", true],
      ["REBOUND", null],
      ["SCORE_2PT", false],
      ["SCORE_3PT", true],
    ]
    for (const [eventType, made] of guestPlays) {
      await p.gameEvent.create({
        data: {
          gameId: guestGame.id,
          eventType,
          teamId: guestGame.homeTeamId,
          playerId: guestRow.id,
          made,
          period: 2,
          clockSeconds: Math.max(5, 300 - gseq * 10),
          sequence: gseq,
          clientEventId: `nphdemo-guest-${guestGame.id.slice(0, 6)}-${gseq}`,
          metadata: eventType === "REBOUND" ? { offensive: false } : undefined,
          timestamp: new Date(now.getTime() - 10 * 60_000 + gseq * 1000),
        },
      })
      gseq++
    }
  }
  console.log("✓ Eligibility override example (Force G10) + live-game guest (Marcus Lee)")

  // ── NPH Showcase League 2026-27: the fall/winter APPLICATION world ────
  // (docs/research/nph-fall-winter-2026-alignment.md §4 — owner 2026-07-29)
  const showcaseLeague = await p.league.create({
    data: {
      name: SHOWCASE_LEAGUE,
      description:
        "Canada's premier youth club league, Grades 5-12. 10-game season plus 2 guaranteed playoff games, championships and awards. Weekend sessions October through March, Durham to Kitchener-Waterloo and Niagara.",
      ownerId: nph.id, statDepth: "STANDARD", periodType: "QUARTERS",
      perks: ["Guaranteed games", "Championships & awards", "Live stats & standings", "Media coverage"],
    },
  })
  await p.userRole.create({ data: { userId: nph.id, role: "LeagueOwner", leagueId: showcaseLeague.id } })
  // Real published 2026-27 dates (northpolehoops.com/showcase/): girls tip
  // off Oct 3, Tier 1 Finals close Mar 6-14. Fully configured season —
  // everything EXCEPT schedule generation (not enough teams yet, owner
  // 2026-07-29). Dates deliberately hardcoded to NPH's announcement.
  const showcaseStart = new Date(Date.UTC(2026, 9, 3))
  const showcaseSeason = await p.season.create({
    data: {
      leagueId: showcaseLeague.id, label: SHOWCASE_SEASON, status: "REGISTRATION",
      type: "FALL_WINTER",
      // Dates INHERITED from the NPH org cycle (owner 2026-07-31) — the
      // cycle values equal this season's real window, so nothing is typed.
      ageGroupCutoffDate: new Date(Date.UTC(2026, 11, 31)), // U-age as of Dec 31
      // Fee, deposit, format, tiebreakers, application questions: ALL
      // inherited from the NPH org rulebook (fields left null on purpose —
      // this is the flagship "configuration is reading" demo, Phase A).
      rosterChangePolicy: "REQUEST_ONLY",
    },
  })
  // NPH's own venues (owner 2026-07-29). Court counts default to 2 and the
  // non-UTM addresses are placeholders — owner edits or dictates real ones.
  const showcaseVenueDefs = [
    { name: "The Playground Burlington", address: "Burlington, ON", city: "Burlington" },
    { name: "Six Park East", address: "Toronto, ON", city: "Toronto" },
    { name: "UTM (University of Toronto Mississauga)", address: "3359 Mississauga Rd", city: "Mississauga" },
  ]
  const showcaseVenues: Array<{ id: string; courtIds: string[] }> = []
  for (const v of showcaseVenueDefs) {
    let venue = await p.venue.findFirst({ where: { name: v.name }, select: { id: true } })
    if (!venue) venue = await p.venue.create({ data: { ...v, state: "ON", country: "CA" }, select: { id: true } })
    const courtIds: string[] = []
    for (let c = 1; c <= 2; c++) {
      let court = await p.court.findFirst({ where: { venueId: venue.id, name: `Court ${c}` }, select: { id: true } })
      if (!court) court = await p.court.create({ data: { venueId: venue.id, name: `Court ${c}`, displayOrder: c }, select: { id: true } })
      courtIds.push(court.id)
    }
    for (let dow = 0; dow <= 6; dow++) {
      const weekend = dow === 0 || dow === 6
      await p.venueHours.upsert({
        where: { venueId_dayOfWeek: { venueId: venue.id, dayOfWeek: dow } },
        create: { venueId: venue.id, dayOfWeek: dow, openTime: weekend ? "08:00" : VENUE_WEEKDAY_HOURS.open, closeTime: weekend ? "20:00" : VENUE_WEEKDAY_HOURS.close },
        update: {},
      })
    }
    showcaseVenues.push({ id: venue.id, courtIds })
  }

  // Weekend sessions on NPH's REAL published U15 dates + the two finals
  // weekends (phase PLAYOFF). Venue allocations included so the Venues and
  // Sessions tabs are fully set up; game generation itself is deliberately
  // NOT run. (Per-division weekend variance in their tables is a scheduling
  // concern — skipped along with schedule generation.)
  const showcaseAllVenues = [...showcaseVenues, ...venues]
  for (const v of showcaseAllVenues) {
    await p.seasonVenue.upsert({
      where: { seasonId_venueId: { seasonId: showcaseSeason.id, venueId: v.id } },
      create: { seasonId: showcaseSeason.id, venueId: v.id, courtsAvailable: v.courtIds.length },
      update: {},
    })
  }
  const SHOWCASE_SESSIONS: Array<{ label: string; phase: "REGULAR" | "PLAYOFF"; dates: [number, number, number][] }> = [
    { label: "Session 1 · Oct 24-25", phase: "REGULAR", dates: [[2026, 9, 24], [2026, 9, 25]] },
    { label: "Session 2 · Nov 21-22", phase: "REGULAR", dates: [[2026, 10, 21], [2026, 10, 22]] },
    { label: "Session 3 · Dec 19-20", phase: "REGULAR", dates: [[2026, 11, 19], [2026, 11, 20]] },
    { label: "Session 4 · Jan 9-10", phase: "REGULAR", dates: [[2027, 0, 9], [2027, 0, 10]] },
    { label: "Session 5 · Feb 6-7", phase: "REGULAR", dates: [[2027, 1, 6], [2027, 1, 7]] },
    { label: "Tier 2 Finals · Feb 27-28", phase: "PLAYOFF", dates: [[2027, 1, 27], [2027, 1, 28]] },
    { label: "Tier 1 Finals · Mar 6-7", phase: "PLAYOFF", dates: [[2027, 2, 6], [2027, 2, 7]] },
  ]
  for (const s of SHOWCASE_SESSIONS) {
    const session = await p.seasonSession.create({
      data: { seasonId: showcaseSeason.id, label: s.label, phase: s.phase, targetGamesPerTeam: 2 },
      select: { id: true },
    })
    for (const [y, m, d] of s.dates) {
      const day = await p.seasonSessionDay.create({
        // LOCAL midnight (QA T-015, same law as runbook #81): a UTC-midnight
        // day row under TZ=America/Toronto reads a day early on every local
        // surface and lands engine slots on the wrong local day.
        data: { sessionId: session.id, date: new Date(y, m, d) },
        select: { id: true },
      })
      for (const v of showcaseAllVenues) {
        const dayVenue = await p.seasonSessionDayVenue.create({
          data: { dayId: day.id, venueId: v.id, startTime: "08:00", endTime: "20:00" },
          select: { id: true },
        })
        for (const courtId of v.courtIds) {
          await p.seasonSessionDayVenueCourt.create({ data: { dayVenueId: dayVenue.id, courtId } })
        }
      }
    }
  }
  // Real NPH division sheet, demo-sized: boys age groups × Tier 1/2 + girls
  const showcaseDivisions = new Map<string, any>()
  for (const age of ["U13", "U15", "U17", "U19"]) {
    for (const tier of [1, 2]) {
      showcaseDivisions.set(`${age}-T${tier}`, await p.division.create({
        data: { seasonId: showcaseSeason.id, name: `${age} Boys · Tier ${tier}`, ageGroup: age, gender: "MALE", tier },
      }))
    }
  }
  for (const [gName, gAge] of [["High School Girls", "U19"], ["Elementary Girls", "U12"]] as const) {
    showcaseDivisions.set(gName, await p.division.create({
      // Derived name; the map keeps the sheet's colloquial key for lookups
      data: { seasonId: showcaseSeason.id, name: `${gAge} Girls · Tier 1`, ageGroup: gAge, gender: "FEMALE", tier: 1 },
    }))
  }
  // Their registration T&C as a league e-sign document — replaces NPH's
  // Jotform signature box + Google Drive rules PDF (real terms verbatim-ish)
  const tcBody = [
    "A 50% non-refundable deposit is required to secure your team's spot in the league.",
    "Full payment is due no later than two (2) weeks prior to the season tip-off.",
    "No refunds will be issued for deposits or league registration fees.",
    "Forfeiting a scheduled game will result in a $500 service fee.",
    "Schedule changes are not permitted once published, except for emergencies.",
    "Once registered, teams are fully committed to the league season and are expected to be organized and ready to compete professionally.",
  ].join("\n\n")
  // CLUB_OFFICIAL audience (owner 2026-07-29): signed once by the club on
  // its season ENTRY — parent flows are audience-scoped and never see it.
  await p.waiverDocument.create({
    data: {
      leagueId: showcaseLeague.id,
      title: "NPH League Registration Terms & Conditions",
      body: tcBody,
      required: true,
      audience: "CLUB_OFFICIAL",
    },
    select: { id: true },
  })
  // Parent-facing waiver from the product's built-in Ontario template —
  // required, so roster approval auto-emails every rostered parent a signing
  // link and the season Signing-status grid fills in (the waiver demo beat).
  const rowans = WAIVER_TEMPLATES.find((t) => t.key === "concussion-code-on")!
  const rowansBody = rowans.body(SHOWCASE_LEAGUE)
  const rowansDoc = await p.waiverDocument.create({
    data: {
      leagueId: showcaseLeague.id,
      title: rowans.title, body: rowansBody,
      type: rowans.type, province: rowans.province,
      annualRenewal: rowans.annualRenewal, required: true,
    },
    select: { id: true },
  })

  // Showcase demo clubs (fall/winter only — no summer entanglement)
  const mkShowcaseClub = async (cfg: (typeof SHOWCASE_CLUBS)[number]) => {
    const tenant = await p.tenant.create({
      data: { slug: cfg.slug, name: cfg.name, status: "ACTIVE", city: cfg.city, state: "ON", country: "CA", currency: "CAD", timezone: "America/Toronto" },
      select: { id: true },
    })
    await p.tenantBranding.create({ data: { tenantId: tenant.id, primaryColor: cfg.color } })
    const owner = await mkUser(`owner-${cfg.key}@${EMAIL_DOMAIN}`, pick(ADULT_NAMES), pick(LAST_NAMES), { city: cfg.city })
    await p.userRole.create({ data: { userId: owner.id, role: "ClubOwner", tenantId: tenant.id } })
    return { id: tenant.id, ownerId: owner.id }
  }
  // Complete roster from scratch: 10 kids, each with their own parent login.
  // Roster entries carry the parent identity so the waiver-mix seeding below
  // can write sign requests/signatures without re-querying.
  const mkRosteredTeam = async (tenantId: string, clubKey: string, teamName: string, ageGroup: string, birthYear: number) => {
    const team = await p.team.create({
      data: { tenantId, name: teamName, ageGroup, gender: "MALE", season: SHOWCASE_SEASON, description: MARKER },
      select: { id: true },
    })
    const roster: Array<{ playerId: string; jerseyNumber: number; parentEmail: string; parentName: string }> = []
    for (let i = 0; i < 10; i++) {
      const seq = (parentSeqByClub.get(clubKey) ?? 0) + 1
      parentSeqByClub.set(clubKey, seq)
      const parentEmail = `parent-${clubKey}-${String(seq).padStart(2, "0")}@${EMAIL_DOMAIN}`
      const parentFirst = pick(ADULT_NAMES)
      const parentLast = pick(LAST_NAMES)
      const parent = await mkUser(parentEmail, parentFirst, parentLast)
      await p.userRole.create({ data: { userId: parent.id, role: "Parent" } })
      const player = await p.player.create({
        data: {
          firstName: pick(BOY_NAMES), lastName: pick(LAST_NAMES),
          dateOfBirth: new Date(Date.UTC(birthYear, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28))),
          gender: "MALE", isMinor: true, parentId: parent.id,
          position: pick(["Guard", "Guard", "Forward", "Forward", "Center"]),
          mediaConsent: rnd() < 0.5 ? "GRANTED" : "UNSET",
        },
        select: { id: true },
      })
      await p.teamPlayer.create({ data: { teamId: team.id, playerId: player.id, jerseyNumber: 4 + i, status: "ACTIVE" } })
      roster.push({
        playerId: player.id,
        jerseyNumber: 4 + i,
        parentEmail,
        parentName: `${parentFirst} ${parentLast}`,
      })
    }
    return { id: team.id, roster }
  }
  const rosterCreate = (roster: Array<{ playerId: string; jerseyNumber: number }>) =>
    roster.map((r) => ({ playerId: r.playerId, jerseyNumber: r.jerseyNumber }))

  // Club A — Scarborough Titans, established: U15 APPROVED w/ locked roster
  // + 50% deposit recorded (their real payment model); U17 PENDING review
  const titans = await mkShowcaseClub(SHOWCASE_CLUBS[0])
  const titansU15 = await mkRosteredTeam(titans.id, "titans", "Scarborough Titans U15", "U15", 2012)
  const titansU17 = await mkRosteredTeam(titans.id, "titans", "Scarborough Titans U17", "U17", 2010)
  // Level-1 entry: Titans committed as a CLUB (2 teams planned), answered
  // the application once, and their official signed the T&C.
  const titansOwnerUser = await p.user.findUnique({ where: { id: titans.ownerId }, select: { firstName: true, lastName: true } })
  await p.clubSeasonEntry.create({
    data: {
      seasonId: showcaseSeason.id,
      tenantId: titans.id,
      status: "APPROVED",
      plannedTeams: 2,
      planNote: "1x U15 Boys Tier 1, 1x U17 Boys Tier 1",
      answers: {
        "Brief synopsis of your team and top prospects": "Scarborough-based program, 6 years running. U15 group won the city championship; PG Wei Ali and F Darius Robinson are Div-1 prospects.",
        "Why do you want to join this league?": "Our families want a season with guaranteed games, real refs and published stats. Showcase League is the standard in the GTA.",
        "Program vision: goals over the next 1, 3 and 5 years": "Year 1: compete in Tier 1. Year 3: field teams U13 through U19. Year 5: a girls program and a permanent home gym.",
      },
      signedById: titans.ownerId,
      signatureName: `${titansOwnerUser.firstName} ${titansOwnerUser.lastName}`,
      signedAt: new Date(now.getTime() - days(7)),
      createdAt: new Date(now.getTime() - days(7)),
    },
  })
  const titansU15Sub = await p.teamSubmission.create({
    data: { seasonId: showcaseSeason.id, divisionId: showcaseDivisions.get("U15-T1").id, teamId: titansU15.id, status: "APPROVED", registrationFee: LEAGUE_TEAM_FEE },
    select: { id: true },
  })
  const titansU15Roster = await p.seasonRoster.create({
    data: {
      seasonId: showcaseSeason.id, teamSubmissionId: titansU15Sub.id, isLocked: true,
      submittedAt: new Date(now.getTime() - days(6)), lockedAt: new Date(now.getTime() - days(4)),
      players: { create: rosterCreate(titansU15.roster) },
    },
    select: { id: true },
  })
  // Live approval beat for the demo (owner 2026-07-29: nothing in the sim
  // had requested a change, so the approve flow never showed): the club
  // asks to swap in a call-up — PENDING on the team page + Overview.
  await p.rosterChangeRequest.create({
    data: {
      rosterId: titansU15Roster.id,
      requestedById: titans.ownerId,
      message: "Wei is out 4 to 6 weeks (ankle). Requesting to call up guard Marcus Lee from our U14 group for Sessions 2 and 3.",
      status: "PENDING",
      createdAt: new Date(now.getTime() - days(1)),
    },
  })
  const titansDeposit = await p.paymentObligation.create({
    data: {
      payerTenantId: titans.id, payeeLeagueId: showcaseLeague.id,
      referenceType: "TeamSubmission", referenceId: titansU15Sub.id,
      description: `${SHOWCASE_LEAGUE} team entry for Scarborough Titans U15 (${SHOWCASE_SEASON})`,
      amount: LEAGUE_TEAM_FEE, status: "PARTIALLY_PAID",
      dueDate: new Date(showcaseStart.getTime() - days(14)), // balance: 2 wks before tip-off
    },
    select: { id: true },
  })
  await p.payment.create({
    data: {
      obligationId: titansDeposit.id, amount: LEAGUE_TEAM_FEE / 2, currency: "CAD",
      status: "SUCCEEDED", paymentType: "LEAGUE_FEE", method: "ETRANSFER",
      payeeId: nph.id, recordedById: nph.id,
      description: `50% deposit for Scarborough Titans U15 (${SHOWCASE_SEASON})`,
      createdAt: new Date(now.getTime() - days(4)),
    },
  })
  const titansU17Sub = await p.teamSubmission.create({
    data: { seasonId: showcaseSeason.id, divisionId: showcaseDivisions.get("U17-T1").id, teamId: titansU17.id, status: "PENDING" },
    select: { id: true },
  })
  await p.seasonRoster.create({
    data: { seasonId: showcaseSeason.id, teamSubmissionId: titansU17Sub.id, isLocked: false, submittedAt: new Date(now.getTime() - days(1)), players: { create: rosterCreate(titansU17.roster) } },
  })

  // Club B — Etobicoke Edge: onboarded, roster READY, NOT applied.
  // The live walk-through club: owner-edge applies on stage in 3 clicks.
  const edge = await mkShowcaseClub(SHOWCASE_CLUBS[1])
  await mkRosteredTeam(edge.id, "edge", "Etobicoke Edge U15", "U15", 2012)

  // Extra pipeline states from summer clubs (rosters carry over):
  // Monarchs APPROVED but entry fee OVERDUE; West United REJECTED.
  const mkCarryTeam = async (clubKey: string, grade: number, teamName: string, ageGroup: string) => {
    const row = clubRows.get(clubKey)!
    const source = teams.find((t) => t.clubKey === clubKey && t.grade === grade)!
    const team = await p.team.create({
      data: { tenantId: row.id, name: teamName, ageGroup, gender: "MALE", season: SHOWCASE_SEASON, description: MARKER },
      select: { id: true },
    })
    const roster = source.roster.map((playerId, i) => ({
      playerId,
      jerseyNumber: 4 + i,
      parentId: source.rosterParents[i],
    }))
    for (const r of roster) {
      await p.teamPlayer.create({ data: { teamId: team.id, playerId: r.playerId, jerseyNumber: r.jerseyNumber, status: "ACTIVE" } })
    }
    return { id: team.id, tenantId: row.id, roster }
  }
  const monarchsFW = await mkCarryTeam("monarchs", 9, "Mississauga Monarchs U15", "U15")
  const monarchsSub = await p.teamSubmission.create({
    data: { seasonId: showcaseSeason.id, divisionId: showcaseDivisions.get("U15-T2").id, teamId: monarchsFW.id, status: "APPROVED", registrationFee: LEAGUE_TEAM_FEE },
    select: { id: true },
  })
  await p.seasonRoster.create({
    data: { seasonId: showcaseSeason.id, teamSubmissionId: monarchsSub.id, isLocked: false, submittedAt: new Date(now.getTime() - days(9)), players: { create: rosterCreate(monarchsFW.roster) } },
  })
  await p.paymentObligation.create({
    data: {
      payerTenantId: monarchsFW.tenantId, payeeLeagueId: showcaseLeague.id,
      referenceType: "TeamSubmission", referenceId: monarchsSub.id,
      description: `${SHOWCASE_LEAGUE} team entry for Mississauga Monarchs U15 (${SHOWCASE_SEASON})`,
      amount: LEAGUE_TEAM_FEE, status: "PENDING",
      dueDate: new Date(now.getTime() - days(6)), // OVERDUE — deposit never arrived
    },
  })
  const westFW = await mkCarryTeam("west", 11, "West United Prep U17", "U17")
  await p.teamSubmission.create({
    data: { seasonId: showcaseSeason.id, divisionId: showcaseDivisions.get("U17-T2").id, teamId: westFW.id, status: "REJECTED" },
  })

  // Realistic waiver state on the approved rosters (owner 2026-07-29): some
  // parents signed, some emailed-but-pending, some untouched — the signing
  // grid and team-page waiver columns must show a believable mix.
  const SIGNATURE_PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  // Parent waiver mix = Rowan's Law ONLY — the club T&C above is never a
  // per-player parent document (owner 2026-07-29).
  const seedWaiverState = async (
    entries: Array<{ playerId: string; parentEmail: string; parentName: string }>,
    signedThrough: number // entries [0, N) have signed; the rest are emailed-pending
  ) => {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      const sentAt = new Date(now.getTime() - days(4))
      const signs = i < signedThrough
      await p.waiverSignRequest.create({
        data: {
          waiverId: rowansDoc.id, playerId: e.playerId, seasonId: showcaseSeason.id,
          emailedTo: e.parentEmail,
          tokenHash: `nphdemo-${rowansDoc.id.slice(0, 8)}-${e.playerId}`,
          expiresAt: new Date(now.getTime() + days(30)),
          consumedAt: signs ? new Date(sentAt.getTime() + days(1)) : null,
          createdAt: sentAt,
        },
      })
      if (signs) {
        await p.waiverSignature.create({
          data: {
            waiverId: rowansDoc.id, playerId: e.playerId, seasonId: showcaseSeason.id,
            waiverVersion: 1, bodySnapshot: rowansBody,
            signerName: e.parentName, relationship: "Parent/Guardian",
            signatureData: SIGNATURE_PNG,
            signedAt: new Date(sentAt.getTime() + days(1)),
            validUntil: new Date(sentAt.getTime() + days(366)),
          },
        })
      }
    }
  }
  await seedWaiverState(titansU15.roster, 7) // 7 signed · 3 emailed-pending
  const monarchsParentRows = await p.user.findMany({
    where: { id: { in: monarchsFW.roster.map((r: any) => r.parentId) } },
    select: { id: true, email: true, firstName: true, lastName: true },
  })
  const monarchsParentById = new Map(monarchsParentRows.map((u: any) => [u.id, u]))
  await seedWaiverState(
    monarchsFW.roster.map((r: any) => {
      const u = monarchsParentById.get(r.parentId)
      return {
        playerId: r.playerId,
        parentEmail: u?.email ?? `parent-monarchs@${EMAIL_DOMAIN}`,
        parentName: u ? `${u.firstName} ${u.lastName}` : "Parent",
      }
    }),
    4 // 4 signed · 6 emailed, still pending
  )

  // Referee pool on the Showcase league (Referees tab must not be empty)
  for (const refId of refIds) {
    await p.leagueReferee.create({ data: { leagueId: showcaseLeague.id, userId: refId } })
  }

  // League-wide poll (three-tier polls: league scope, never chat-relayed)
  // with votes from Titans parents — shows on their home pages.
  const showcasePoll = await p.poll.create({
    data: {
      leagueId: showcaseLeague.id,
      createdById: nph.id,
      title: "Championship Weekend planning",
      description: "Help us shape the Tier 1 finals weekend: two quick questions.",
      status: "OPEN",
      questions: {
        create: [
          {
            prompt: "Which finals format do you prefer for Championship Weekend?",
            order: 0,
            options: {
              create: [
                { label: "Single elimination", order: 0 },
                { label: "Best-of-3 series", order: 1 },
                { label: "Round robin + final", order: 2 },
              ],
            },
          },
          {
            prompt: "Preferred first tip-off time on session Saturdays?",
            order: 1,
            options: {
              create: [
                { label: "8:00 AM", order: 0 },
                { label: "9:00 AM", order: 1 },
                { label: "10:00 AM", order: 2 },
              ],
            },
          },
        ],
      },
    },
    select: { id: true, questions: { select: { id: true, options: { select: { id: true }, orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
  })
  const titansParentRows = await p.user.findMany({
    where: { email: { in: titansU15.roster.map((r: any) => r.parentEmail) } },
    select: { id: true },
  })
  for (let i = 0; i < titansParentRows.length; i++) {
    const [q1, q2] = showcasePoll.questions
    await p.pollVote.create({
      data: { questionId: q1.id, optionId: q1.options[i % 5 === 0 ? 1 : i % 3 === 0 ? 2 : 0].id, userId: titansParentRows[i].id },
    })
    if (i % 4 !== 3) {
      await p.pollVote.create({
        data: { questionId: q2.id, optionId: q2.options[i % 2 === 0 ? 1 : 2].id, userId: titansParentRows[i].id },
      })
    }
  }

  console.log("✓ Showcase 2026-27: 10 divisions, T&C doc, apps APPROVED+deposit / PENDING / APPROVED+overdue / REJECTED, Edge ready to apply live")
  console.log("✓ Showcase extras: waiver mix (signed/sent/pending), ref pool, league poll w/ votes")

  // ── Name-only leagues: NPH shells + the Toronto directory ─────────────
  const mkShellLeague = async (ownerId: string, name: string, description: string) => {
    const league = await p.league.create({ data: { name, description, ownerId }, select: { id: true } })
    await p.userRole.create({ data: { userId: ownerId, role: "LeagueOwner", leagueId: league.id } })
    await p.season.create({ data: { leagueId: league.id, label: "2026-27", status: "DRAFT", type: "FALL_WINTER" } })
  }
  for (const [name, desc] of NPH_SHELL_LEAGUES) await mkShellLeague(nph.id, name, desc)
  const dirHolder = await mkUser(`league-directory@${EMAIL_DOMAIN}`, "Dana", "Registry")
  for (const [name, desc] of DIRECTORY_LEAGUES) await mkShellLeague(dirHolder.id, name, desc)
  console.log(`✓ Name-only leagues: ${NPH_SHELL_LEAGUES.length} NPH shells + ${DIRECTORY_LEAGUES.length} Toronto directory entries (DRAFT 2026-27)`)

  // NPH's real branding on every NPH-owned league (owner 2026-07-29):
  // square mark from northpolehoops.com (black basketball + red maple leaf,
  // committed as scripts/demo-assets data URL) + their Canadian-red accent.
  const nphLogo = readFileSync(new URL("./demo-assets/nph-logo.dataurl.txt", import.meta.url), "utf8").trim()
  // Organization layer (owner 2026-07-29): branding lives ONCE on the
  // operator; leagues inherit (league fields stay null = inheritance demo).
  const nphOrg = await p.organization.create({
    data: {
      name: "North Pole Hoops",
      slug: "north-pole-hoops",
      logoUrl: nphLogo,
      primaryColor: "#d7282f",
      tagline: "A pathway for Canadian basketball to the next level",
      description:
        "North Pole Hoops provides a pathway for Canadian basketball to the next level, from elementary school to the pros: leagues, showcases, scouting and media.",
      // The NPH rulebook (Phase A): every league inherits these live —
      // Showcase + Fall leave the fields null; Summer keeps deliberate
      // overrides (20 games, its own hours) to demo the override UI.
      seasonDefaults: {
        cycleStartDate: "2026-10-03T00:00:00.000Z",
        cycleEndDate: "2027-03-14T00:00:00.000Z",
        cycleRegistrationDeadline: "2026-10-01T00:00:00.000Z",
        gamesGuaranteed: 10, // NPH norm (owner 2026-07-31): 10 regular-season games — playoffs are separate brackets
        gamePeriods: "QUARTERS",
        periodLengthMinutes: 10,
        gameLengthMinutes: GAME_LENGTH_MINUTES,
        gameSlotMinutes: GAME_SLOT_MINUTES,
        teamFee: LEAGUE_TEAM_FEE,
        depositPct: 50, // NPH terms: 50% deposit, balance 2 wks before tip-off
        balanceDueDaysBeforeStart: 14,
        tiebreakerOrder: ["HEAD_TO_HEAD", "POINT_DIFFERENTIAL", "POINTS_SCORED"],
        allowGuestPlayers: true,
        playoffMinGames: 5,
        applicationQuestions: [
          "Brief synopsis of your team and top prospects",
          "Why do you want to join this league?",
          "Program vision: goals over the next 1, 3 and 5 years",
          // Structured question (owner 2026-07-31): typed input, not a text line
          {
            label: "How many seasons has your program competed at Tier 1?",
            type: "single",
            options: ["First season", "1-2 seasons", "3+ seasons"],
            required: true,
          },
        ],
      },
    },
    select: { id: true },
  })
  await p.league.updateMany({
    where: { ownerId: nph.id },
    data: { organizationId: nphOrg.id },
  })
  console.log("✓ NPH Organization created — 6 leagues linked, branding inherited (league fields null)")

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
    " Showcase 2026-27 clubs:",
    `   owner-titans@${EMAIL_DOMAIN}`.padEnd(42) + "Scarborough Titans (U15 ✓approved+deposit · U17 pending)",
    `   owner-edge@${EMAIL_DOMAIN}`.padEnd(42) + "Etobicoke Edge (roster ready — APPLY LIVE)",
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
    "   · owner-nph → Referees tab: pool + book-a-day; ref-mike → Shifts &",
    "     Availability: broadcast offer to accept live (auto-assigns games)",
    "   · parent → Dashboard → Polls (Lords G9): tournament poll, 9 families",
    "     voted, parent votes live; coach-lords-gr9 sees who picked what",
    "   · owner-nph → Showcase League 2026-27 (REGISTRATION): applications in",
    "     every state — Titans U15 approved w/ 50% deposit paid, Titans U17",
    "     pending, Monarchs approved + entry fee OVERDUE, West Utd rejected;",
    "     Rowan's Law parent waiver w/ realistic signed/pending mix; club T&C",
    "     stored as a club-level agreement (not parent-signed);",
    "     league poll w/ parent votes; NPH logo + red branding",
    "   · owner-nph → Fall League: 8 teams approved+locked+paid (4 per grade)",
    "     — close registration and RUN SCHEDULE GENERATION live",
    "   · owner-edge → TWO-LEVEL demo: /league page → Enter as a club →",
    "     application questions + planned teams + SIGN the T&C → owner-nph",
    "     approves entry (Clubs tab) → Edge registers its U15 team",
    "   · Titans entry APPROVED w/ answers + signed T&C (Clubs tab → Application)",
    "   · league page hero: branding INHERITED from /org/north-pole-hoops",
    "   · /leagues directory: OBL, Circuits, Hoop City, Big League, Phoenix,",
    "     OSBA, JUEL, CYBL as name-only entries (+ NPA/WNPA/D1 under NPH)",
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

  const scenarioArg = args.find((a) => a.startsWith("--scenario="))?.split("=")[1] ?? "pitch"
  const stageArg = Number(args.find((a) => a.startsWith("--stage="))?.split("=")[1] ?? "1")

  if (scenarioArg === "nph-pitch-journey") {
    console.log(`— NPH JOURNEY SEEDER — stage ${stageArg}`)
    const t0j = Date.now()
    if (stageArg <= 1) {
      await wipeDemoWorld()
      if (args.includes("--purge-manual-leagues")) await purgeManualLeagues()
    }
    await runJourneyStage(Math.max(1, stageArg))
    console.log(`\n✓ journey ready in ${Math.round((Date.now() - t0j) / 1000)}s`)
    return
  }

  console.log("— NPH DEMO SEEDER — (docs/nph-demo-seed-plan.md)")
  await wipeDemoWorld()
  if (args.includes("--purge-manual-leagues")) await purgeManualLeagues()
  if (args.includes("--wipe")) return

  const t0 = Date.now()
  const result = await seed()
  // Seeded games are the LIVE demo world, not drafts — stamp them published.
  // Scoped to demo-owned leagues so a box reseed never silently publishes a
  // real operator's in-progress drafts. (The Fall league stays gameless so
  // commit→draft→publish demos on stage.)
  const demoOwners = await p.user.findMany({
    where: { email: { endsWith: `@${EMAIL_DOMAIN}` } },
    select: { id: true },
  })
  await p.game.updateMany({
    where: {
      publishedAt: null,
      season: { league: { ownerId: { in: demoOwners.map((u) => u.id) } } },
    },
    data: { publishedAt: new Date() },
  })
  await p.platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default", enabledCountries: ["CA", "US"], demoState: { scenario: "pitch", stage: 1, loadedAt: new Date().toISOString() } },
    update: { demoState: { scenario: "pitch", stage: 1, loadedAt: new Date().toISOString() } },
  })
  console.log(`\n✓ world built in ${Math.round((Date.now() - t0) / 1000)}s — ${result.teams} teams, ${result.completed} completed, ${result.live} live`)
  printCheatSheet()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
