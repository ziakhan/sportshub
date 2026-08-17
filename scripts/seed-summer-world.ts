/**
 * NPH SUMMER WORLD — an ADDITIVE, live summer season for the local demo box.
 *
 * This script builds ONE thing: the **NPH Summer League** (April → September,
 * anchored to the day it runs) with full old-demo-world fidelity — rich club
 * pages, programs, personas, a mostly-played schedule with box scores and
 * standings, a game last night, a game tonight, and a social layer.
 *
 * IT IS ADDITIVE BY CONSTRUCTION.
 *   · It only ever creates rows it owns (marker `NPH_SUMMER_SEED`).
 *   · It NEVER touches the Showcase planning world: the NPH Showcase League,
 *     its Fall/Winter 2026-27 season, that season's divisions, sessions,
 *     SeasonVenues, plans, submissions or games.
 *   · It NEVER creates or deletes Venue or Court rows — the three real gyms
 *     (The Playground, Haber, Six Park East) are reused as-is, because the
 *     planner reads Venue.name and COUNTS Court rows.
 *   · It never deletes an existing user. Personas use fresh emails.
 *   · Re-running it is a no-op (idempotent). `--reset` rebuilds ONLY the
 *     summer world's own rows.
 *
 * Usage:
 *   npx tsx scripts/seed-summer-world.ts            # seed (no-op if present)
 *   npx tsx scripts/seed-summer-world.ts --reset    # rebuild the summer world
 *   npx tsx scripts/seed-summer-world.ts --wipe     # remove it, seed nothing
 *
 * Local DB only: refuses to run against a non-localhost DATABASE_URL.
 */

import { randomUUID } from "crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@youthbasketballhub/db"
import { foldEvents, totalRebounds } from "../apps/web/src/lib/scoring/fold"
import { upsertGameRecap } from "../apps/web/src/lib/content/recap-service"
import { WAIVER_TEMPLATES } from "../apps/web/src/lib/waivers/templates"
import { EMAIL_DOMAIN, PASSWORD } from "./demo-shared"

// Recaps must be deterministic and offline — force the template engine.
delete process.env.ANTHROPIC_API_KEY

const p = prisma as any

// ════════════════════════════════════════════════════════════════════════
// WORLD CONSTANTS
// ════════════════════════════════════════════════════════════════════════
export const SUMMER_MARKER = "NPH_SUMMER_SEED"
export const SUMMER_LEAGUE = "NPH Summer League"
const LEAGUE_TEAM_FEE = 2450 // summer entry — cheaper than the fall/winter $3,990
const GAME_SLOT_MINUTES = 90
const SEASON_FEE_NEW = 895
const SEASON_FEE_RETURNING = 795
const INSTALLMENTS = 4

/** The three real gyms, by the names already in the venue registry.
 *  Summer 2026 really ran at The Playground + Haber
 *  (docs/research/nph-operations-intel-2026-08.md). */
const HOME_GYM = "The Playground"
const RENTAL_GYM = "Haber Recreation Centre"

interface ClubCfg {
  key: string
  slug: string
  name: string
  short: string
  city: string
  color: string
  accent: string
  tagline: string
  description: string
  featured?: boolean
  girls?: boolean
}

/** The returning cast — all eight already exist as ACTIVE tenants from the
 *  journey world, with no owner, no branding and no description. We adopt
 *  them: add an owner, brand them, and fill the empty description. */
const CLUBS: ClubCfg[] = [
  {
    key: "lords", slug: "toronto-lords", name: "Toronto Lords", short: "Lords",
    city: "Toronto", color: "#1d4ed8", accent: "#f59e0b", featured: true, girls: true,
    tagline: "Develop. Compete. Represent.",
    description:
      "Toronto Lords Basketball has run grade-based club teams out of the west end since 2014. Two practices a week, a full summer and fall schedule, and coaches who know every kid on the bench by name. Boys and girls, Grade 7 through Grade 12.",
  },
  {
    key: "force", slug: "burlington-basketball", name: "Burlington Force", short: "Force",
    city: "Burlington", color: "#16a34a", accent: "#facc15", featured: true, girls: true,
    tagline: "Halton's home for club basketball.",
    description:
      "Burlington Force is a Halton Region club program built around long-term athlete development. We field summer and fall/winter teams, run a March Break camp, and put every game on the scoresheet so families can follow the season from anywhere.",
  },
  {
    key: "huskies", slug: "north-toronto-huskies", name: "North Toronto Huskies", short: "Huskies",
    city: "Toronto", color: "#7c3aed", accent: "#c4b5fd", girls: true,
    tagline: "One club, one standard.",
    description:
      "The Huskies are a midtown Toronto club with a development-first philosophy: everyone plays, everyone gets coached. Our summer squads feed directly into the fall/winter program.",
  },
  {
    key: "monarchs", slug: "mississauga-minor-basketball-association", name: "Mississauga Monarchs", short: "Monarchs",
    city: "Mississauga", color: "#4f46e5", accent: "#a5b4fc", girls: true,
    tagline: "Built in Mississauga.",
    description:
      "Mississauga Monarchs run boys and girls club teams across the Peel Region, with summer league entries at every grade and a weekly skills night open to non-roster players.",
  },
  {
    key: "panthers", slug: "oakville-panthers", name: "Oakville Panthers", short: "Panthers",
    city: "Oakville", color: "#be123c", accent: "#fda4af", girls: true,
    tagline: "Play hard. Play smart. Play together.",
    description:
      "Oakville Panthers is a family-run club that keeps rosters small on purpose, ten to twelve players so everyone gets minutes. Summer league, fall/winter league, and a four-week summer camp.",
  },
  {
    key: "west", slug: "west-united-prep", name: "West United Prep", short: "West United",
    city: "Mississauga", color: "#0891b2", accent: "#67e8f9", girls: true,
    tagline: "A prep pathway in the west end.",
    description:
      "West United Prep combines a club program with a prep-track training block. Our summer teams train three mornings a week at the Playground and play weekends in the NPH Summer League.",
  },
  {
    key: "ckatt", slug: "ckatt-cooksville", name: "CKATT Basketball", short: "CKATT",
    city: "Mississauga", color: "#374151", accent: "#9ca3af",
    tagline: "Cooksville's club since 2011.",
    description:
      "CKATT Basketball started as a Cooksville house league and now runs full club teams. We keep fees low, we publish everything, and we have never cancelled a season.",
  },
  {
    key: "kings", slug: "kings-court-academy", name: "Kings Court Basketball", short: "Kings Court",
    city: "Hamilton", color: "#ca8a04", accent: "#fde68a",
    tagline: "Hamilton hoops, done right.",
    description:
      "Kings Court is Hamilton's club basketball program. Summer league teams at Grade 9 and Grade 10, a house league for younger players, and an August skills camp at the Playground.",
  },
]

/** Divisions — plausible for a summer circuit: two boys grades and a girls
 *  grade. Every club fields both boys teams; six field the girls team. */
const DIVISIONS = [
  { key: "g9b", name: "Grade 9 Boys · Tier 1", ageGroup: "Grade 9", gender: "MALE", tier: 1, birthYear: 2011, pace: 27, day: 6 },
  { key: "g10b", name: "Grade 10 Boys · Tier 1", ageGroup: "Grade 10", gender: "MALE", tier: 1, birthYear: 2010, pace: 30, day: 6 },
  { key: "g10g", name: "Grade 10 Girls · Tier 1", ageGroup: "Grade 10", gender: "FEMALE", tier: 1, birthYear: 2010, pace: 26, day: 0 },
] as const
type DivKey = (typeof DIVISIONS)[number]["key"]

const REFS: Array<[string, string, string, string]> = [
  ["Mike", "Ferreira", "ref-mike", "Level 3"],
  ["Sarah", "Whitlock", "ref-sarah", "Level 2"],
  ["James", "Okonkwo", "ref-james", "Level 3"],
]

const BOY_NAMES = ["Liam", "Noah", "Jayden", "Ethan", "Marcus", "Malik", "Owen", "Lucas", "Mason", "Elijah", "Kai", "Aiden", "Josiah", "Xavier", "Isaiah", "Andre", "Devon", "Tyler", "Jordan", "Cameron", "Darius", "Amir", "Omar", "Ravi", "Arjun", "Kevin", "Daniel", "Nathan", "Zion", "Trey", "Cole", "Miles", "Theo", "Felix", "Mateo", "Ibrahim", "Yusuf", "Silas", "Rowan", "Nico"]
const GIRL_NAMES = ["Aaliyah", "Brianna", "Chloe", "Danielle", "Emma", "Faith", "Grace", "Hannah", "Imani", "Jade", "Keisha", "Lena", "Maya", "Nia", "Olivia", "Priya", "Renee", "Sasha", "Tia", "Zara", "Amara", "Bea", "Clara", "Divya"]
const ADULT_NAMES = ["Alex", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Jamie", "Robin", "Dana", "Chris", "Pat", "Lee", "Maria", "David", "Sarah", "Kevin", "Lisa", "Mark", "Anita", "Paul", "Nadia", "Victor", "Elena", "Tunde", "Fatima", "Carlos", "Wendy", "Raj", "Grace", "Dmitri"]
const LAST_NAMES = ["Thompson", "Williams", "Chen", "Patel", "Singh", "Osei", "Diallo", "Nguyen", "Garcia", "Martinez", "Brown", "Wilson", "Campbell", "Grant", "Baptiste", "Charles", "Pierre", "Ahmed", "Hassan", "Ali", "Khan", "Kim", "Park", "Lee", "Wong", "Liu", "Sharma", "Gupta", "Okafor", "Mensah", "Boateng", "Silva", "Santos", "Rodriguez", "Taylor", "Anderson", "Jackson", "White", "Harris", "Robinson", "Clarke", "Lewis", "Walker", "Young", "Allen", "Wright", "Scott", "Green", "Baker", "Adams"]

const APPAREL = ["YL", "AS", "AS", "AM", "AM", "AL"]
const SHOES = ["7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11"]
const POSITIONS = ["Guard", "Guard", "Forward", "Forward", "Center"]

// ── Deterministic RNG (mulberry32) ──────────────────────────────────────
let rngState = 20260806
function rnd(): number {
  rngState |= 0
  rngState = (rngState + 0x6d2b79f5) | 0
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]
const days = (n: number) => n * 86400_000

// ── Counters for the summary table ──────────────────────────────────────
const counts: Record<string, number> = {}
const bump = (k: string, n = 1) => {
  counts[k] = (counts[k] ?? 0) + n
}

// ── Safety rails ────────────────────────────────────────────────────────
async function guardLocal() {
  const url = process.env.DATABASE_URL || ""
  const host = url.match(/@([^/:]+)/)?.[1] ?? "unknown"
  const [{ current_database: db }] = (await p.$queryRaw`SELECT current_database()`) as any[]
  const local = host === "localhost" || host === "127.0.0.1"
  console.log(`Database: ${db} @ ${host} ${local ? "(local)" : "(REMOTE)"}`)
  if (!local) {
    console.error("✗ This seeder is LOCAL ONLY. Refusing to run against a remote database.")
    process.exit(1)
  }
}

/** Emails this world owns. Nothing outside this set is ever deleted. */
const isSummerEmail = (email: string) =>
  email.endsWith(`@${EMAIL_DOMAIN}`) &&
  (email.startsWith("summer-") || email.startsWith("parent-summer-"))

// ════════════════════════════════════════════════════════════════════════
// WIPE — surgical, marker-driven, only our own rows
// ════════════════════════════════════════════════════════════════════════
async function wipeSummerWorld() {
  const league = await p.league.findFirst({ where: { name: SUMMER_LEAGUE }, select: { id: true } })
  if (league) {
    const seasons = await p.season.findMany({ where: { leagueId: league.id }, select: { id: true } })
    const seasonIds = seasons.map((s: any) => s.id)
    const games = await p.game.findMany({ where: { seasonId: { in: seasonIds } }, select: { id: true } })
    const gameIds = games.map((g: any) => g.id)
    const posts = await p.post.findMany({
      where: { OR: [{ tags: { some: { gameId: { in: gameIds } } } }, { tags: { some: { leagueId: league.id } } }] },
      select: { id: true },
    })
    await p.post.deleteMany({ where: { id: { in: posts.map((x: any) => x.id) } } })
    await p.refereeSettlement.deleteMany({ where: { leagueId: league.id } })
    await p.userRole.deleteMany({ where: { gameId: { in: gameIds } } })
    await p.game.deleteMany({ where: { id: { in: gameIds } } })
    await p.paymentObligation.deleteMany({ where: { payeeLeagueId: league.id } })
    await p.season.deleteMany({ where: { id: { in: seasonIds } } })
    await p.userRole.deleteMany({ where: { leagueId: league.id } })
    await p.league.delete({ where: { id: league.id } })
  }
  await p.post.deleteMany({ where: { slug: { startsWith: "summer-" } } })

  // Teams we own (marker in description) — clear non-cascading FKs first.
  await p.offer.deleteMany({ where: { team: { description: SUMMER_MARKER } } })
  await p.offerTemplate.deleteMany({ where: { programDescription: { contains: SUMMER_MARKER } } })
  await p.game.deleteMany({
    where: { OR: [{ homeTeam: { description: SUMMER_MARKER } }, { awayTeam: { description: SUMMER_MARKER } }] },
  })
  await p.team.deleteMany({ where: { description: SUMMER_MARKER } })

  // Programs we own
  await p.camp.deleteMany({ where: { details: { contains: SUMMER_MARKER } } })
  await p.houseLeague.deleteMany({ where: { details: { contains: SUMMER_MARKER } } })
  await p.tryout.deleteMany({ where: { description: { contains: SUMMER_MARKER } } })

  // Users we own — deep, FK-safe
  const users = await p.user.findMany({
    where: {
      email: { endsWith: `@${EMAIL_DOMAIN}` },
      OR: [{ email: { startsWith: "summer-" } }, { email: { startsWith: "parent-summer-" } }],
    },
    select: { id: true, email: true },
  })
  const userIds = users.filter((u: any) => isSummerEmail(u.email)).map((u: any) => u.id)
  if (userIds.length) {
    await p.auditLog.deleteMany({ where: { userId: { in: userIds } } })
    await p.review.deleteMany({ where: { OR: [{ reviewerId: { in: userIds } }, { revieweeId: { in: userIds } }] } })
    await p.payment.deleteMany({
      where: { OR: [{ payerId: { in: userIds } }, { payeeId: { in: userIds } }, { recordedById: { in: userIds } }] },
    })
    await p.paymentObligation.deleteMany({ where: { payerUserId: { in: userIds } } })
    await p.offer.deleteMany({ where: { player: { parentId: { in: userIds } } } })
    await p.tryoutSignup.deleteMany({ where: { userId: { in: userIds } } })
    await p.campSignup.deleteMany({ where: { userId: { in: userIds } } })
    await p.houseLeagueSignup.deleteMany({ where: { userId: { in: userIds } } })
    await p.player.deleteMany({ where: { parentId: { in: userIds } } })
    await p.announcement.deleteMany({ where: { authorId: { in: userIds } } })
    const authored = await p.post.findMany({ where: { authorId: { in: userIds } }, select: { id: true } })
    await p.post.deleteMany({ where: { id: { in: authored.map((x: any) => x.id) } } })
    await p.user.deleteMany({ where: { id: { in: userIds } } })
  }
  console.log(`✓ summer world wiped (${userIds.length} accounts, league + season + games + programs)`)
}

// ════════════════════════════════════════════════════════════════════════
// SMALL BUILDERS
// ════════════════════════════════════════════════════════════════════════
const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string))

/** A branded cover image for news cards (owner rule: news is ALWAYS a card —
 *  cover + kind chip + title + date). Inline SVG data URL, no blob infra. */
function coverImage(title: string, eyebrow: string, color: string): string {
  const words = title.split(" ")
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    if ((line + " " + w).trim().length > 24) {
      lines.push(line.trim())
      line = w
    } else line += ` ${w}`
  }
  if (line.trim()) lines.push(line.trim())
  const text = lines
    .slice(0, 3)
    .map((l, i) => `<text x="64" y="${300 + i * 78}" font-family="Inter,Helvetica,Arial" font-size="62" font-weight="700" fill="#ffffff">${escapeXml(l)}</text>`)
    .join("")
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="#0b1220"/></linearGradient></defs>` +
    `<rect width="1200" height="630" fill="url(#g)"/>` +
    `<circle cx="1010" cy="150" r="190" fill="#ffffff" fill-opacity="0.07"/>` +
    `<text x="64" y="180" font-family="Inter,Helvetica,Arial" font-size="30" font-weight="600" letter-spacing="4" fill="#ffffffcc">${escapeXml(eyebrow.toUpperCase())}</text>` +
    text +
    `<rect x="64" y="540" width="120" height="8" rx="4" fill="#ffffff" fill-opacity="0.85"/>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** Circle-method round robin: N teams → N-1 rounds. */
function roundRobin(teamIds: string[]): Array<Array<[string, string]>> {
  const arr = [...teamIds]
  const n = arr.length
  const rounds: Array<Array<[string, string]>> = []
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

/** Play-by-play generator (the proven showcase/NPH stream shape). */
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
      clientEventId: `summer-${gameId.slice(0, 8)}-${seq}`,
      metadata: e.metadata ?? undefined,
      timestamp: new Date(startAt.getTime() + seq * 15_000),
    })
  const PERIOD_SECONDS = 600

  const takeAttendance = (roster: string[]) => {
    const absent = new Set<string>()
    for (let i = 5; i < roster.length; i++) {
      if (rnd() < (i === roster.length - 1 ? 0.5 : 0.12)) absent.add(roster[i])
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
        push({ eventType: "SCORE_FT", teamId: team, playerId: shooter, made: rnd() < 0.68, period: q, clockSeconds: clock })
        push({ eventType: "SCORE_FT", teamId: team, playerId: shooter, made: rnd() < 0.68, period: q, clockSeconds: clock })
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

// ════════════════════════════════════════════════════════════════════════
// THE SEED
// ════════════════════════════════════════════════════════════════════════
interface SeedTeam {
  id: string
  name: string
  clubKey: string
  tenantId: string
  divKey: DivKey
  roster: string[] // playerIds
  rosterParents: string[] // userIds aligned with roster
  jerseys: number[]
  coachId: string
  asstId: string
  fee: number
}

async function seed() {
  const now = new Date()
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  // ── Batch user builder ────────────────────────────────────────────────
  type NewUser = { id: string; email: string; firstName: string; lastName: string; city?: string; handle?: string }
  const pendingUsers: any[] = []
  const mkUser = (email: string, firstName: string, lastName: string, extra: any = {}): NewUser => {
    const id = randomUUID()
    pendingUsers.push({
      id, email, passwordHash, firstName, lastName,
      phoneNumber: "416-555-0142", onboardedAt: now, city: extra.city ?? "Toronto",
      state: "ON", country: "CA", handle: extra.handle ?? null,
    })
    return { id, email, firstName, lastName, ...extra }
  }
  const flushUsers = async () => {
    if (!pendingUsers.length) return
    await p.user.createMany({ data: pendingUsers, skipDuplicates: true })
    bump("users", pendingUsers.length)
    pendingUsers.length = 0
  }
  const pendingRoles: any[] = []
  const addRole = (data: any) => pendingRoles.push({ id: randomUUID(), ...data })
  const flushRoles = async () => {
    if (!pendingRoles.length) return
    await p.userRole.createMany({ data: pendingRoles, skipDuplicates: true })
    bump("userRoles", pendingRoles.length)
    pendingRoles.length = 0
  }

  // ── The operator: reuse the EXISTING owner-nph@ account ────────────────
  const nph = await p.user.findUnique({ where: { email: `owner-nph@${EMAIL_DOMAIN}` }, select: { id: true } })
  if (!nph) throw new Error(`owner-nph@${EMAIL_DOMAIN} not found — seed the journey world first.`)
  const org = await p.organization.findUnique({ where: { slug: "north-pole-hoops" }, select: { id: true } })

  // ── Venues: REUSE ONLY. Never create Venue/Court rows. ────────────────
  // Exact name first, prefix as fallback: the box registry says "The
  // Playground Burlington" where local says "The Playground" — same building.
  const venueRows = await p.venue.findMany({
    where: { OR: [{ name: { startsWith: HOME_GYM } }, { name: { startsWith: RENTAL_GYM } }] },
    select: { id: true, name: true, city: true, courtList: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
  })
  const matchVenue = (wanted: string) =>
    venueRows.find((v: any) => v.name === wanted) ??
    venueRows.find((v: any) => v.name.startsWith(wanted))
  const home = matchVenue(HOME_GYM)
  const rental = matchVenue(RENTAL_GYM)
  if (!home || !rental) throw new Error(`Venues missing: need "${HOME_GYM}" and "${RENTAL_GYM}" in the venue registry.`)
  const GYMS = [
    { ...home, role: "home" as const, courts: home.courtList },
    { ...rental, role: "pool" as const, courts: rental.courtList.slice(0, 4) },
  ]

  // ── League + season ───────────────────────────────────────────────────
  const year = now.getFullYear()
  // April → September, anchored to the run year.
  const seasonStart = new Date(year, 3, 1)
  seasonStart.setDate(seasonStart.getDate() + ((6 - seasonStart.getDay() + 7) % 7)) // first Saturday of April
  const seasonEnd = new Date(year, 8, 30)
  const seasonLabel = `Summer ${year}`

  const league = await p.league.create({
    data: {
      name: SUMMER_LEAGUE,
      description:
        "NPH's summer circuit: weekend basketball from April through September at the Playground and Haber. Every game is scored live with stats, standings, recaps and Player of the Game cards.",
      ownerId: nph.id,
      organizationId: org?.id ?? null,
      statDepth: "STANDARD",
      periodType: "QUARTERS",
      perks: ["Weekend games all summer", "Live stats & standings", "Championship weekend", "Player of the Game cards"],
    },
    select: { id: true },
  })
  addRole({ userId: nph.id, role: "LeagueOwner", leagueId: league.id })
  bump("leagues")

  const season = await p.season.create({
    data: {
      leagueId: league.id,
      label: seasonLabel,
      status: "IN_PROGRESS",
      type: "SUMMER",
      startDate: seasonStart,
      endDate: seasonEnd,
      teamFee: LEAGUE_TEAM_FEE,
      currency: "CAD",
      gamesGuaranteed: 13,
      gameSlotMinutes: GAME_SLOT_MINUTES,
      gameLengthMinutes: 40,
      gamePeriods: "QUARTERS",
      periodLengthMinutes: 10,
      defaultWeekendStyle: "SAME_DAY",
      defaultVenueOpenTime: "09:00",
      defaultVenueCloseTime: "20:00",
      rosterChangePolicy: "REQUEST_ONLY",
      tiebreakerOrder: ["HEAD_TO_HEAD", "POINT_DIFFERENTIAL", "POINTS_SCORED"],
      tiebreakersLockedAt: now,
      playoffFormat: "Top 4 per division · single elimination",
      playoffTeams: 4,
      playoffMinGames: 5,
      allowGuestPlayers: true,
    },
    select: { id: true },
  })
  bump("seasons")

  const divisionIds: Record<string, string> = {}
  for (const d of DIVISIONS) {
    const row = await p.division.create({
      data: { seasonId: season.id, name: d.name, ageGroup: d.ageGroup, gender: d.gender, tier: d.tier },
      select: { id: true },
    })
    divisionIds[d.key] = row.id
    bump("divisions")
  }

  // Season venue roster: home gym + one rental pool gym.
  for (const g of GYMS) {
    const sv = await p.seasonVenue.create({
      data: { seasonId: season.id, venueId: g.id, role: g.role, courtsAvailable: g.courts.length, isPrimary: g.role === "home" },
      select: { id: true },
    })
    for (const dow of [0, 6]) {
      await p.seasonVenueHours.create({
        data: { seasonVenueId: sv.id, dayOfWeek: dow, openTime: "09:00", closeTime: "20:00" },
      })
    }
    bump("seasonVenues")
  }

  // ── Weekend sessions: every other weekend April → late September ──────
  const saturdays: Date[] = []
  for (let d = new Date(seasonStart); d <= seasonEnd; d.setDate(d.getDate() + 14)) {
    saturdays.push(new Date(d))
  }
  // Guarantee the UPCOMING weekend is a playing weekend (demo needs it).
  const thisSat = new Date(now)
  thisSat.setHours(0, 0, 0, 0)
  thisSat.setDate(thisSat.getDate() + ((6 - thisSat.getDay() + 7) % 7))
  if (!saturdays.some((s) => Math.abs(s.getTime() - thisSat.getTime()) < days(1))) {
    saturdays.push(new Date(thisSat))
    saturdays.sort((a, b) => a.getTime() - b.getTime())
  }

  interface SessionDay { id: string; date: Date; dayVenues: Array<{ id: string; venueId: string; courtIds: string[] }> }
  interface SessionRow { id: string; label: string; sat: Date; days: SessionDay[] }
  const sessions: SessionRow[] = []
  for (let i = 0; i < saturdays.length; i++) {
    const sat = saturdays[i]
    const label = `Weekend ${i + 1} · ${sat.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`
    const s = await p.seasonSession.create({
      data: { seasonId: season.id, label, phase: "REGULAR", targetGamesPerTeam: 1 },
      select: { id: true },
    })
    const sessionDays: SessionDay[] = []
    for (const offset of [0, 1]) {
      const date = new Date(sat)
      date.setDate(date.getDate() + offset)
      date.setHours(0, 0, 0, 0)
      const day = await p.seasonSessionDay.create({ data: { sessionId: s.id, date }, select: { id: true } })
      const dayVenues: SessionDay["dayVenues"] = []
      for (const g of GYMS) {
        const dv = await p.seasonSessionDayVenue.create({
          data: { dayId: day.id, venueId: g.id, startTime: "09:00", endTime: "20:00" },
          select: { id: true },
        })
        await p.seasonSessionDayVenueCourt.createMany({
          data: g.courts.map((c: any) => ({ id: randomUUID(), dayVenueId: dv.id, courtId: c.id })),
        })
        dayVenues.push({ id: dv.id, venueId: g.id, courtIds: g.courts.map((c: any) => c.id) })
      }
      sessionDays.push({ id: day.id, date, dayVenues })
    }
    sessions.push({ id: s.id, label, sat, days: sessionDays })
    bump("sessions")
  }
  // Championship weekend (playoff phase, no games yet — the season is live).
  const champSat = new Date(seasonEnd)
  champSat.setDate(champSat.getDate() - ((champSat.getDay() + 1) % 7))
  const champ = await p.seasonSession.create({
    data: { seasonId: season.id, label: "Championship Weekend", phase: "PLAYOFF", targetGamesPerTeam: 2 },
    select: { id: true },
  })
  for (const offset of [0, 1]) {
    const date = new Date(champSat)
    date.setDate(date.getDate() + offset)
    date.setHours(0, 0, 0, 0)
    const day = await p.seasonSessionDay.create({ data: { sessionId: champ.id, date }, select: { id: true } })
    for (const g of GYMS) {
      const dv = await p.seasonSessionDayVenue.create({
        data: { dayId: day.id, venueId: g.id, startTime: "09:00", endTime: "20:00" },
        select: { id: true },
      })
      await p.seasonSessionDayVenueCourt.createMany({
        data: g.courts.map((c: any) => ({ id: randomUUID(), dayVenueId: dv.id, courtId: c.id })),
      })
    }
  }
  bump("sessions")

  // A midweek session that carries the anchored beats: last night + tonight.
  const midweek = await p.seasonSession.create({
    data: { seasonId: season.id, label: "Midweek Showcase", phase: "REGULAR", targetGamesPerTeam: 1 },
    select: { id: true },
  })
  const midweekDays: SessionDay[] = []
  for (const offset of [-1, 0]) {
    const date = new Date(now)
    date.setDate(date.getDate() + offset)
    date.setHours(0, 0, 0, 0)
    const day = await p.seasonSessionDay.create({ data: { sessionId: midweek.id, date }, select: { id: true } })
    const dayVenues: SessionDay["dayVenues"] = []
    for (const g of GYMS) {
      const dv = await p.seasonSessionDayVenue.create({
        data: { dayId: day.id, venueId: g.id, startTime: "17:00", endTime: "22:00" },
        select: { id: true },
      })
      await p.seasonSessionDayVenueCourt.createMany({
        data: g.courts.map((c: any) => ({ id: randomUUID(), dayVenueId: dv.id, courtId: c.id })),
      })
      dayVenues.push({ id: dv.id, venueId: g.id, courtIds: g.courts.map((c: any) => c.id) })
    }
    midweekDays.push({ id: day.id, date, dayVenues })
  }
  bump("sessions")
  console.log(`✓ ${SUMMER_LEAGUE} · ${seasonLabel} · ${DIVISIONS.length} divisions · ${sessions.length} weekends + midweek + championship`)

  // ── Clubs: adopt the returning cast (branding + owner + templates) ────
  interface ClubRow { id: string; ownerId: string; cfg: ClubCfg; templates: any[] }
  const clubRows = new Map<string, ClubRow>()
  for (const cfg of CLUBS) {
    const tenant = await p.tenant.findUnique({ where: { slug: cfg.slug }, select: { id: true, description: true } })
    if (!tenant) throw new Error(`Club tenant missing: ${cfg.slug}`)
    // Fill the empty club profile — additive enrichment, never a rewrite of
    // anything an operator typed.
    await p.tenant.update({
      where: { id: tenant.id },
      data: {
        description: tenant.description ?? cfg.description,
        shortName: cfg.short,
        city: cfg.city,
        state: "ON",
        country: "CA",
        currency: "CAD",
        timezone: "America/Toronto",
        contactEmail: `info@${cfg.key}.example.ca`,
        phoneNumber: "905-555-0173",
        website: `https://${cfg.key}basketball.ca`,
        ...(cfg.featured ? { isFeatured: true } : {}),
      },
    })
    await p.tenantBranding.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        primaryColor: cfg.color,
        secondaryColor: cfg.accent,
        accentColor: cfg.accent,
        tagline: cfg.tagline,
        socials: { instagram: `${cfg.key}hoops`, youtube: `@${cfg.key}basketball` },
      },
      update: { primaryColor: cfg.color, secondaryColor: cfg.accent, accentColor: cfg.accent, tagline: cfg.tagline },
    })
    bump("clubBranding")

    const owner = mkUser(`summer-owner-${cfg.key}@${EMAIL_DOMAIN}`, pick(ADULT_NAMES), pick(LAST_NAMES), {
      city: cfg.city, handle: `${cfg.key}-club`,
    })
    addRole({ userId: owner.id, role: "ClubOwner", tenantId: tenant.id })
    clubRows.set(cfg.key, { id: tenant.id, ownerId: owner.id, cfg, templates: [] })
  }
  await flushUsers()

  // Offer templates (2-3 per club — the packages families choose between)
  for (const cfg of CLUBS) {
    const row = clubRows.get(cfg.key)!
    const mk = (name: string, fee: number, extras: any) =>
      p.offerTemplate.create({
        data: {
          tenantId: row.id, name, seasonFee: fee, installments: INSTALLMENTS,
          practiceSessions: 24, gamesMin: 13, gamesMax: 15,
          programDescription: `${cfg.name} summer program: two practices a week plus weekend games in the NPH Summer League. ${SUMMER_MARKER}`,
          isActive: true, ...extras,
        },
        select: {
          id: true, name: true, seasonFee: true, installments: true, practiceSessions: true,
          gamesMin: true, gamesMax: true, programDescription: true,
          includesBall: true, includesBag: true, includesShoes: true, includesUniform: true, includesTracksuit: true,
        },
      })
    row.templates = [
      await mk("New Player", SEASON_FEE_NEW, { includesUniform: true, includesBall: true, customItems: ["Reversible practice jersey"] }),
      await mk("Returning Player", SEASON_FEE_RETURNING, { includesBall: true, customItems: ["Keeps last season's kit"] }),
    ]
    if (cfg.featured) {
      row.templates.push(
        await mk("Elite All-In", 1495, {
          includesUniform: true, includesBall: true, includesBag: true, includesShoes: true, includesTracksuit: true,
          customItems: ["Full kit", "Summer skills block", "End-of-season banquet"],
        })
      )
    }
    bump("offerTemplates", row.templates.length)
  }
  console.log(`✓ ${CLUBS.length} clubs adopted: branding, descriptions, owners, ${counts.offerTemplates} offer templates`)

  // ── Personas ──────────────────────────────────────────────────────────
  const parentLords = mkUser(`summer-parent-lords@${EMAIL_DOMAIN}`, "Jordan", "Reyes", { handle: "jordanreyes" })
  addRole({ userId: parentLords.id, role: "Parent" })
  const parentForce = mkUser(`summer-parent-force@${EMAIL_DOMAIN}`, "Sana", "Malik", { city: "Burlington", handle: "sanamalik" })
  addRole({ userId: parentForce.id, role: "Parent" })

  const refs: Array<{ id: string; name: string; key: string }> = []
  for (const [first, last, key, level] of REFS) {
    const u = mkUser(`summer-${key}@${EMAIL_DOMAIN}`, first, last, { handle: `${key}-official` })
    addRole({ userId: u.id, role: "Referee" })
    refs.push({ id: u.id, name: `${first} ${last}`, key })
    void level
  }
  await flushUsers()
  const pinHash = await bcrypt.hash("1234", 10)
  for (let i = 0; i < refs.length; i++) {
    await p.refereeProfile.create({
      data: {
        userId: refs[i].id, certificationLevel: REFS[i][3], availableRegions: ["Ontario"],
        standardFee: 50, gamesRefereed: 40 + i * 17, signoffPinHash: pinHash,
      },
    })
    await p.leagueReferee.create({ data: { leagueId: league.id, userId: refs[i].id } })
    bump("referees")
  }

  // ── Teams + rosters + coaches + money ─────────────────────────────────
  const teams: SeedTeam[] = []
  const pendingPlayers: any[] = []
  const pendingTeamPlayers: any[] = []
  let bgSeq = 0

  for (const d of DIVISIONS) {
    const clubs = d.key === "g10g" ? CLUBS.filter((c) => c.girls) : CLUBS
    for (const cfg of clubs) {
      const row = clubRows.get(cfg.key)!
      const suffix = d.gender === "FEMALE" ? " Girls" : ""
      const teamName = `${cfg.name} ${d.ageGroup}${suffix}`
      const teamId = randomUUID()
      // A leftover team with this identity is a dead world's remains
      // (post-consolidation shared tenants): clear it, then create fresh so
      // the generated id threads through the rest of the build.
      await p.team.deleteMany({
        where: { tenantId: row.id, name: teamName, ageGroup: d.ageGroup, season: seasonLabel },
      })
      await p.team.create({
        data: {
          id: teamId, tenantId: row.id, name: teamName, ageGroup: d.ageGroup,
          gender: d.gender, season: seasonLabel, description: SUMMER_MARKER, maxPlayers: 12,
        },
      })
      bump("teams")

      const gradeNum = d.ageGroup.replace(/\D/g, "")
      const coach = mkUser(`summer-coach-${cfg.key}-gr${gradeNum}${d.gender === "FEMALE" ? "g" : ""}@${EMAIL_DOMAIN}`,
        pick(ADULT_NAMES), pick(LAST_NAMES), { city: cfg.city })
      const asst = mkUser(`summer-asst-${cfg.key}-gr${gradeNum}${d.gender === "FEMALE" ? "g" : ""}@${EMAIL_DOMAIN}`,
        pick(ADULT_NAMES), pick(LAST_NAMES), { city: cfg.city })
      addRole({ userId: coach.id, role: "Staff", tenantId: row.id })
      addRole({ userId: coach.id, role: "Staff", tenantId: row.id, teamId, designation: "HeadCoach" })
      addRole({ userId: asst.id, role: "Staff", tenantId: row.id, teamId, designation: "AssistantCoach" })

      const roster: string[] = []
      const rosterParents: string[] = []
      const jerseys: number[] = []
      const used = new Set<number>()
      for (let i = 0; i < 10; i++) {
        // Named demo kids land on specific rosters.
        const special =
          cfg.key === "lords" && d.key === "g9b" && i === 0 ? parentLords
            : cfg.key === "lords" && d.key === "g10g" && i === 1 ? parentLords
              : cfg.key === "force" && d.key === "g10b" && i === 2 ? parentForce
                : null
        let parentId: string
        if (special) parentId = special.id
        else {
          bgSeq++
          const bg = mkUser(`parent-summer-${cfg.key}-${String(bgSeq).padStart(3, "0")}@${EMAIL_DOMAIN}`,
            pick(ADULT_NAMES), pick(LAST_NAMES), { city: cfg.city })
          addRole({ userId: bg.id, role: "Parent" })
          parentId = bg.id
        }
        const female = d.gender === "FEMALE"
        const first = female ? pick(GIRL_NAMES) : pick(BOY_NAMES)
        const last = special ? (special === parentLords ? "Reyes" : "Malik") : pick(LAST_NAMES)
        const playerId = randomUUID()
        pendingPlayers.push({
          id: playerId, firstName: first, lastName: last,
          dateOfBirth: new Date(Date.UTC(d.birthYear, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28))),
          gender: female ? "FEMALE" : "MALE", isMinor: true, parentId,
          position: pick(POSITIONS),
          mediaConsent: rnd() < 0.4 ? "GRANTED" : "UNSET",
          socialVisibility: "PRIVATE",
        })
        let jersey = 3 + Math.floor(rnd() * 40)
        while (used.has(jersey)) jersey = (jersey % 44) + 1
        used.add(jersey)
        pendingTeamPlayers.push({
          id: randomUUID(), teamId, playerId, jerseyNumber: jersey, status: "ACTIVE",
          uniformSize: pick(APPAREL), shoeSize: pick(SHOES),
        })
        roster.push(playerId)
        rosterParents.push(parentId)
        jerseys.push(jersey)
      }
      teams.push({
        id: teamId, name: teamName, clubKey: cfg.key, tenantId: row.id, divKey: d.key,
        roster, rosterParents, jerseys, coachId: coach.id, asstId: asst.id,
        fee: rnd() < 0.3 ? SEASON_FEE_RETURNING : SEASON_FEE_NEW,
      })
    }
  }
  await flushUsers()
  await p.player.createMany({ data: pendingPlayers })
  bump("players", pendingPlayers.length)
  await p.teamPlayer.createMany({ data: pendingTeamPlayers })
  bump("teamPlayers", pendingTeamPlayers.length)
  await flushRoles()
  console.log(`✓ ${teams.length} teams · ${pendingPlayers.length} players · ${counts.users} accounts`)

  // ── Submissions, locked rosters, league entry fees ────────────────────
  const submissionByTeam = new Map<string, string>()
  for (const t of teams) {
    const div = DIVISIONS.find((d) => d.key === t.divKey)!
    const sub = await p.teamSubmission.create({
      data: {
        seasonId: season.id, divisionId: divisionIds[t.divKey], teamId: t.id,
        status: "APPROVED", registrationFee: LEAGUE_TEAM_FEE, paymentStatus: "PAID_MANUAL",
      },
      select: { id: true },
    })
    submissionByTeam.set(t.id, sub.id)
    await p.seasonRoster.create({
      data: {
        seasonId: season.id, teamSubmissionId: sub.id, isLocked: true,
        submittedAt: new Date(seasonStart.getTime() - days(21)),
        lockedAt: new Date(seasonStart.getTime() - days(14)),
        players: { create: t.roster.map((playerId, i) => ({ playerId, jerseyNumber: t.jerseys[i] })) },
      },
    })
    bump("seasonRosters")
    // Club → league entry fee. Most paid, a couple still owing (aging demo).
    const roll = rnd()
    const status = roll < 0.8 ? "PAID" : roll < 0.92 ? "PARTIALLY_PAID" : "PENDING"
    const ob = await p.paymentObligation.create({
      data: {
        payerTenantId: t.tenantId, payeeLeagueId: league.id,
        referenceType: "TeamSubmission", referenceId: sub.id,
        description: `${SUMMER_LEAGUE} team entry — ${t.name} (${seasonLabel})`,
        amount: LEAGUE_TEAM_FEE, status,
        dueDate: new Date(seasonStart.getTime() - days(7)),
      },
      select: { id: true },
    })
    bump("obligations")
    if (status !== "PENDING") {
      await p.payment.create({
        data: {
          obligationId: ob.id,
          amount: status === "PAID" ? LEAGUE_TEAM_FEE : LEAGUE_TEAM_FEE / 2,
          currency: "CAD", status: "SUCCEEDED", paymentType: "LEAGUE_FEE", method: "ETRANSFER",
          payeeId: nph.id, recordedById: nph.id,
          description: `${status === "PAID" ? "Team entry" : "50% deposit"} — ${t.name} (${seasonLabel})`,
          createdAt: new Date(seasonStart.getTime() - days(10)),
        },
      })
      bump("payments")
    }
    void div
  }

  // ── Family money: accepted offer → obligation → recorded payments ────
  // Every rostered kid got there through an ACCEPTED offer (sizes + jersey
  // prefs on it), so the club's Offers tab and Order Sheet are populated and
  // the obligation has the unique (referenceType, referenceId) the schema wants.
  const offerRows: any[] = []
  const offerIdFor = new Map<string, string>() // `${teamId}:${playerId}` → offerId
  for (const t of teams) {
    const row = clubRows.get(t.clubKey)!
    const tpl = t.fee === SEASON_FEE_RETURNING ? row.templates[1] : row.templates[0]
    for (let i = 0; i < t.roster.length; i++) {
      const id = randomUUID()
      offerIdFor.set(`${t.id}:${t.roster[i]}`, id)
      offerRows.push({
        id, teamId: t.id, playerId: t.roster[i], templateId: tpl.id, status: "ACCEPTED",
        seasonFee: t.fee, installments: INSTALLMENTS, practiceSessions: 24,
        gamesMin: 13, gamesMax: 15, programDescription: tpl.programDescription,
        includesUniform: tpl.includesUniform, includesBall: tpl.includesBall,
        includesBag: tpl.includesBag, includesShoes: tpl.includesShoes,
        includesTracksuit: tpl.includesTracksuit,
        message: `We'd love to have your player on the ${t.name} roster this summer.`,
        expiresAt: new Date(seasonStart.getTime() - days(14)),
        respondedAt: new Date(seasonStart.getTime() - days(24)),
        uniformSize: pick(APPAREL), shoeSize: pick(SHOES), tracksuitSize: pick(APPAREL),
        jerseyPref1: t.jerseys[i], jerseyPref2: ((t.jerseys[i] + 7) % 44) + 1, jerseyPref3: ((t.jerseys[i] + 13) % 44) + 1,
        createdAt: new Date(seasonStart.getTime() - days(30)),
      })
    }
  }
  for (let i = 0; i < offerRows.length; i += 200) {
    await p.offer.createMany({ data: offerRows.slice(i, i + 200) })
  }
  bump("offers", offerRows.length)

  for (const t of teams) {
    const row = clubRows.get(t.clubKey)!
    for (let i = 0; i < t.roster.length; i++) {
      const parentId = t.rosterParents[i]
      const isDemoFamily = parentId === parentLords.id || parentId === parentForce.id
      const roll = isDemoFamily ? (i % 2 === 0 ? 0.1 : 0.82) : rnd()
      const status = roll < 0.72 ? "PAID" : roll < 0.9 ? "PARTIALLY_PAID" : "PENDING"
      const ob = await p.paymentObligation.create({
        data: {
          payerUserId: parentId, payeeTenantId: t.tenantId,
          referenceType: "Offer", referenceId: offerIdFor.get(`${t.id}:${t.roster[i]}`)!,
          description: `${seasonLabel} season fee — ${t.name}`,
          amount: t.fee, status,
          dueDate: new Date(seasonStart.getTime() - days(3)),
        },
        select: { id: true },
      })
      bump("obligations")
      if (status !== "PENDING") {
        const per = Math.round((t.fee / INSTALLMENTS) * 100) / 100
        const paid = status === "PAID" ? INSTALLMENTS : 2
        const rows = []
        for (let k = 0; k < paid; k++) {
          rows.push({
            id: randomUUID(), payerId: parentId, tenantId: t.tenantId,
            amount: per, currency: "CAD", status: "SUCCEEDED", paymentType: "SEASON_FEE",
            method: pick(["ETRANSFER", "ETRANSFER", "CASH", "CHEQUE"]),
            obligationId: ob.id, recordedById: row.ownerId,
            description: k === 0 ? `${seasonLabel} deposit — ${t.name}` : `${seasonLabel} installment ${k}/3 — ${t.name}`,
            installmentNumber: k + 1,
            createdAt: new Date(seasonStart.getTime() - days(21) + days(k * 30)),
          })
        }
        await p.payment.createMany({ data: rows })
        bump("payments", rows.length)
      }
    }
  }
  console.log(`✓ money: ${counts.obligations} obligations · ${counts.payments} recorded payments`)

  // ── The schedule ──────────────────────────────────────────────────────
  const rosterOf = new Map(teams.map((t) => [t.id, t.roster]))
  const paceOf = new Map(teams.map((t) => [t.id, DIVISIONS.find((d) => d.key === t.divKey)!.pace]))
  const teamById = new Map(teams.map((t) => [t.id, t]))

  const roundsByDiv: Record<string, Array<Array<[string, string]>>> = {}
  for (const d of DIVISIONS) {
    roundsByDiv[d.key] = roundRobin(teams.filter((t) => t.divKey === d.key).map((t) => t.id))
  }

  type PlannedGame = { homeTeamId: string; awayTeamId: string; sessionId: string; dayId: string; dayVenueId: string; courtId: string; venueId: string; scheduledAt: Date }
  const planned: PlannedGame[] = []

  for (let w = 0; w < sessions.length; w++) {
    const s = sessions[w]
    // Per weekend day: a running slot allocator across the day's gyms.
    const alloc = new Map<string, { slot: number; court: number }>()
    const placeGame = (day: SessionDay, homeTeamId: string, awayTeamId: string) => {
      const state = alloc.get(day.id) ?? { slot: 0, court: 0 }
      // Home gym fills first; spill into the rental gym (venue model v2).
      const gymOrder = day.dayVenues
      let placed = false
      for (const dv of gymOrder) {
        if (state.court < dv.courtIds.length) {
          const at = new Date(day.date)
          at.setHours(9 + Math.floor((state.slot * GAME_SLOT_MINUTES) / 60), (state.slot * GAME_SLOT_MINUTES) % 60, 0, 0)
          planned.push({
            homeTeamId, awayTeamId, sessionId: s.id, dayId: day.id,
            dayVenueId: dv.id, courtId: dv.courtIds[state.court], venueId: dv.venueId, scheduledAt: at,
          })
          state.court++
          placed = true
          break
        }
      }
      if (!placed) {
        state.slot++
        state.court = 0
        alloc.set(day.id, state)
        placeGame(day, homeTeamId, awayTeamId)
        return
      }
      // Move to the next slot once every court in every gym is used.
      const totalCourts = gymOrder.reduce((n, dv) => n + dv.courtIds.length, 0)
      if (state.court >= totalCourts) {
        state.slot++
        state.court = 0
      }
      alloc.set(day.id, state)
    }
    // Court index is global across the day's gyms — walk them in order.
    const placeAcrossGyms = (day: SessionDay, homeTeamId: string, awayTeamId: string) => {
      const state = alloc.get(day.id) ?? { slot: 0, court: 0 }
      let idx = state.court
      let target: { dv: SessionDay["dayVenues"][number]; courtId: string } | null = null
      for (const dv of day.dayVenues) {
        if (idx < dv.courtIds.length) {
          target = { dv, courtId: dv.courtIds[idx] }
          break
        }
        idx -= dv.courtIds.length
      }
      if (!target) {
        state.slot++
        state.court = 0
        alloc.set(day.id, state)
        placeAcrossGyms(day, homeTeamId, awayTeamId)
        return
      }
      const at = new Date(day.date)
      const minutes = state.slot * GAME_SLOT_MINUTES
      at.setHours(9 + Math.floor(minutes / 60), minutes % 60, 0, 0)
      planned.push({
        homeTeamId, awayTeamId, sessionId: s.id, dayId: day.id,
        dayVenueId: target.dv.id, courtId: target.courtId, venueId: target.dv.venueId, scheduledAt: at,
      })
      state.court++
      alloc.set(day.id, state)
    }
    void placeGame

    for (const d of DIVISIONS) {
      const rounds = roundsByDiv[d.key]
      const round = rounds[w % rounds.length]
      const day = s.days.find((x) => x.date.getDay() === d.day) ?? s.days[0]
      for (const [homeId, awayId] of round) placeAcrossGyms(day, homeId, awayId)
    }
  }

  // Anchored beats: last night's marquee + tonight's game + two LIVE now.
  const lordsG9 = teams.find((t) => t.clubKey === "lords" && t.divKey === "g9b")!
  const forceG9 = teams.find((t) => t.clubKey === "force" && t.divKey === "g9b")!
  const lordsG10 = teams.find((t) => t.clubKey === "lords" && t.divKey === "g10b")!
  const huskiesG10 = teams.find((t) => t.clubKey === "huskies" && t.divKey === "g10b")!
  const monarchsG9 = teams.find((t) => t.clubKey === "monarchs" && t.divKey === "g9b")!
  const panthersG9 = teams.find((t) => t.clubKey === "panthers" && t.divKey === "g9b")!
  const lordsG10G = teams.find((t) => t.clubKey === "lords" && t.divKey === "g10g")!
  const forceG10G = teams.find((t) => t.clubKey === "force" && t.divKey === "g10g")!

  const yesterdayDay = midweekDays[0]
  const todayDay = midweekDays[1]
  const at = (day: SessionDay, hh: number, mm: number) => {
    const d = new Date(day.date)
    d.setHours(hh, mm, 0, 0)
    return d
  }
  const marqueeAt = at(yesterdayDay, 19, 0)
  planned.push({
    homeTeamId: lordsG9.id, awayTeamId: forceG9.id, sessionId: midweek.id, dayId: yesterdayDay.id,
    dayVenueId: yesterdayDay.dayVenues[0].id, courtId: yesterdayDay.dayVenues[0].courtIds[0],
    venueId: yesterdayDay.dayVenues[0].venueId, scheduledAt: marqueeAt,
  })
  planned.push({
    homeTeamId: lordsG10G.id, awayTeamId: forceG10G.id, sessionId: midweek.id, dayId: yesterdayDay.id,
    dayVenueId: yesterdayDay.dayVenues[0].id, courtId: yesterdayDay.dayVenues[0].courtIds[1],
    venueId: yesterdayDay.dayVenues[0].venueId, scheduledAt: at(yesterdayDay, 20, 30),
  })
  const tonightAt = at(todayDay, 19, 30)
  planned.push({
    homeTeamId: lordsG10.id, awayTeamId: huskiesG10.id, sessionId: midweek.id, dayId: todayDay.id,
    dayVenueId: todayDay.dayVenues[0].id, courtId: todayDay.dayVenues[0].courtIds[0],
    venueId: todayDay.dayVenues[0].venueId, scheduledAt: tonightAt,
  })
  const liveAt = new Date(now.getTime() - 55 * 60_000)
  planned.push({
    homeTeamId: monarchsG9.id, awayTeamId: panthersG9.id, sessionId: midweek.id, dayId: todayDay.id,
    dayVenueId: todayDay.dayVenues[0].id, courtId: todayDay.dayVenues[0].courtIds[1],
    venueId: todayDay.dayVenues[0].venueId, scheduledAt: liveAt,
  })
  const liveMarkers = new Set<number>([planned.length - 1])
  const marqueeIndex = planned.length - 4
  const tonightIndex = planned.length - 2

  // Create the games.
  const gameIds: string[] = []
  const gameRows = planned.map((g) => ({
    id: randomUUID(), seasonId: season.id, phase: "REGULAR" as const,
    homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
    sessionId: g.sessionId, dayId: g.dayId, dayVenueId: g.dayVenueId, courtId: g.courtId,
    venueId: g.venueId, scheduledAt: g.scheduledAt, duration: GAME_SLOT_MINUTES,
    status: "SCHEDULED" as const, isLocked: true, publishedAt: now,
  }))
  for (let i = 0; i < gameRows.length; i += 200) {
    await p.game.createMany({ data: gameRows.slice(i, i + 200) })
  }
  gameRows.forEach((g) => gameIds.push(g.id))
  bump("games", gameRows.length)

  // ── Play them ─────────────────────────────────────────────────────────
  const playedCutoff = new Date(now.getTime() - 100 * 60_000)
  const completedIds: string[] = []
  const liveIds: string[] = []
  const marqueeGameId = gameRows[marqueeIndex].id
  const tonightGameId = gameRows[tonightIndex].id

  for (let i = 0; i < gameRows.length; i++) {
    const g = gameRows[i]
    const isLive = liveMarkers.has(i)
    const isPlayed = !isLive && g.scheduledAt < playedCutoff
    if (!isLive && !isPlayed) continue
    const startAt = isLive ? liveAt : g.scheduledAt
    const events = buildGameEvents({
      gameId: g.id, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
      homeRoster: rosterOf.get(g.homeTeamId)!, awayRoster: rosterOf.get(g.awayTeamId)!,
      pace: paceOf.get(g.homeTeamId) ?? 28, startAt,
      homeEdge: isLive ? 0.5 : 0.44 + rnd() * 0.13,
      throughPeriod: isLive ? 3 : undefined,
    })
    await p.gameEvent.createMany({ data: events })
    bump("gameEvents", events.length)
    const folded = foldEvents(
      events.map((e: any) => ({ ...e, timestampMs: e.timestamp.getTime() })),
      { homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId }
    )
    if (isLive) {
      await p.game.update({
        where: { id: g.id },
        data: { status: "LIVE", scheduledAt: startAt, homeScore: folded.homeScore, awayScore: folded.awayScore },
      })
      liveIds.push(g.id)
    } else {
      const ref = refs[completedIds.length % refs.length]
      await p.game.update({
        where: { id: g.id },
        data: {
          homeScore: folded.homeScore, awayScore: folded.awayScore, status: "COMPLETED",
          finalizedAt: new Date(startAt.getTime() + 95 * 60_000),
          refereeName: ref.name, refereeSignedAt: new Date(startAt.getTime() + 95 * 60_000),
          refereeVerified: true,
        },
      })
      await p.playerStat.createMany({
        data: Object.values(folded.players).map((l: any) => ({
          id: randomUUID(), gameId: g.id, playerId: l.playerId,
          points: l.points, rebounds: totalRebounds(l), assists: l.assists,
          steals: l.steals, blocks: l.blocks, turnovers: l.turnovers, fouls: l.fouls,
          minutesPlayed: l.secondsPlayed > 0 ? Math.round(l.secondsPlayed / 60) : null,
        })),
      })
      completedIds.push(g.id)
    }
  }
  bump("gamesCompleted", completedIds.length)
  bump("gamesLive", liveIds.length)
  bump("gamesUpcoming", gameRows.length - completedIds.length - liveIds.length)
  console.log(
    `✓ ${gameRows.length} games: ${completedIds.length} completed · ${liveIds.length} LIVE now · ${gameRows.length - completedIds.length - liveIds.length} upcoming (incl. tonight ${tonightAt.toLocaleString("en-CA")})`
  )

  // Referee assignments across every game + settlements for played days.
  const refAssignments = gameRows.map((g, i) => ({
    id: randomUUID(), userId: refs[i % refs.length].id, role: "Referee", gameId: g.id,
  }))
  for (let i = 0; i < refAssignments.length; i += 300) {
    await p.userRole.createMany({ data: refAssignments.slice(i, i + 300), skipDuplicates: true })
  }
  bump("refereeAssignments", refAssignments.length)

  // Availability for the upcoming weekend + a broadcast shift offer.
  const nextSession = sessions.find((s) => s.sat.getTime() >= now.getTime())
  if (nextSession) {
    for (const r of refs.slice(0, 2)) {
      await p.refereeAvailability.create({
        data: { userId: r.id, date: nextSession.days[0].date, startTime: "09:00", endTime: "18:00" },
      })
    }
    const req = await p.refereeSessionRequest.create({
      data: {
        leagueId: league.id, sessionDayId: nextSession.days[0].id,
        startTime: "09:00", endTime: "15:00", offeredRatePerGame: 50,
        message: "Saturday morning block — three courts running at the Playground.",
        createdById: nph.id,
      },
      select: { id: true },
    })
    for (const r of refs) {
      await p.notification.create({
        data: {
          userId: r.id, type: "referee_request",
          title: `${SUMMER_LEAGUE} needs a referee`,
          message: "Saturday 09:00–15:00 · $50/game — first to accept gets the day.",
          link: "/referee/requests", referenceId: req.id, referenceType: "RefereeSessionRequest",
        },
      })
      bump("notifications")
    }
  }
  // Settlements on two played weekends: one confirmed, one awaiting confirm.
  const pastSessions = sessions.filter((s) => s.sat.getTime() < now.getTime()).slice(-2)
  for (let i = 0; i < pastSessions.length; i++) {
    for (const r of refs) {
      await p.refereeSettlement.create({
        data: {
          leagueId: league.id, refereeUserId: r.id, sessionDate: pastSessions[i].days[0].date,
          gamesCount: 4, ratePerGame: 50, total: 200,
          status: i === 0 ? "CONFIRMED" : "PENDING_CONFIRM",
          confirmedById: i === 0 ? nph.id : null,
          confirmedAt: i === 0 ? new Date(pastSessions[i].days[0].date.getTime() + days(2)) : null,
        },
      })
      bump("refereeSettlements")
    }
  }

  // ── Recaps (template engine, no API) on the most recent finals ────────
  const recent = [...completedIds].slice(-24)
  if (!recent.includes(marqueeGameId)) recent.push(marqueeGameId)
  let recapCount = 0
  for (const id of recent) {
    const result = await upsertGameRecap(id).catch(() => null)
    if (!result) continue
    recapCount++
    const g = await p.game.findUnique({ where: { id }, select: { finalizedAt: true } })
    await p.post.update({ where: { id: result.postId }, data: { publishedAt: g?.finalizedAt ?? now } })
  }
  bump("recaps", recapCount)
  console.log(`✓ ${recapCount} game recaps published (template engine, no API key needed)`)

  // ── Social: POTG + final posts on recent games ────────────────────────
  let finals = 0
  for (const gameId of completedIds.slice(-30)) {
    const top = await p.playerStat.findFirst({
      where: { gameId }, orderBy: { points: "desc" },
      select: { playerId: true, player: { select: { firstName: true, lastName: true } } },
    })
    if (!top) continue
    const g = await p.game.findUnique({
      where: { id: gameId },
      select: {
        homeScore: true, awayScore: true, finalizedAt: true, homeTeamId: true, awayTeamId: true,
        homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } },
      },
    })
    if (!g) continue
    await p.game.update({ where: { id: gameId }, data: { potgPlayerId: top.playerId } })
    await p.post.create({
      data: {
        kind: "PLAYER_OF_GAME",
        title: `Final: ${g.homeTeam.name} ${g.homeScore}–${g.awayScore} ${g.awayTeam.name}`,
        slug: `summer-final-${gameId}`,
        body: `Player of the Game: ${top.player.firstName} ${top.player.lastName}.`,
        status: "PUBLISHED", publishedAt: g.finalizedAt ?? now, visibility: "PUBLIC",
        tags: { create: [{ gameId }, { teamId: g.homeTeamId }, { teamId: g.awayTeamId }] },
      },
    })
    finals++
  }
  bump("finalPosts", finals)

  // ── News cards: league + club, always a card (cover + kind + title) ───
  const leagueNews: Array<[string, string, string]> = [
    ["Summer standings tighten with six weekends to play", "Three teams are within a game of each other at the top of Grade 9 Boys, and the Grade 10 Girls race is a coin flip. Every result, box score and standings table updates the moment a game is finalized.", "Standings"],
    ["Championship Weekend set for the end of September", "The top four in each division qualify. Both days run at the Playground, doors open 45 minutes before the first tip, and every game is live-scored with recaps and Player of the Game cards.", "League"],
    ["How the summer calendar works", "The league plays every other weekend from April through September. Boys divisions play Saturdays, the Grade 10 Girls division plays Sundays, and midweek showcase games are added when a gym frees up.", "Schedule"],
    ["Referees: three officials, one pool, paid per game", "Officials pick up shifts from the league pool, sign the scoresheet on the tablet at the table, and settle by session day at a published per-game rate.", "Operations"],
    ["Live scoring is on for every summer game", "Points, rebounds, assists, steals, blocks and fouls, entered play by play at the table. Families get the box score before they leave the parking lot.", "Product"],
  ]
  const newsPosts: string[] = []
  for (let i = 0; i < leagueNews.length; i++) {
    const [title, body, eyebrow] = leagueNews[i]
    const post = await p.post.create({
      data: {
        kind: "ARTICLE", title, slug: `summer-news-league-${i + 1}`, body,
        status: "PUBLISHED", publishedAt: new Date(now.getTime() - days(i * 3 + 1)),
        authorId: nph.id, visibility: "PUBLIC",
        tags: { create: [{ leagueId: league.id }] },
        media: { create: [{ type: "IMAGE", url: coverImage(title, eyebrow, "#d7282f"), title, sortOrder: 0 }] },
      },
      select: { id: true },
    })
    newsPosts.push(post.id)
    bump("newsPosts")
  }
  for (const cfg of CLUBS) {
    const row = clubRows.get(cfg.key)!
    const t = teams.find((x) => x.clubKey === cfg.key)!
    const title = `${cfg.name}: what the summer has looked like so far`
    const post = await p.post.create({
      data: {
        kind: "ARTICLE", title, slug: `summer-news-${cfg.key}`,
        body: `${cfg.description}\n\nOur ${seasonLabel} squads are through most of the schedule. Practices run twice a week, games are every other weekend, and every result lands on the team page with a full box score. Registration for the fall program opens at the end of the summer season.`,
        status: "PUBLISHED", publishedAt: new Date(now.getTime() - days(2 + Math.floor(rnd() * 10))),
        authorId: row.ownerId, visibility: "PUBLIC",
        tags: { create: [{ tenantId: row.id }, { teamId: t.id }, { leagueId: league.id }] },
        media: { create: [{ type: "IMAGE", url: coverImage(title, cfg.short, cfg.color), title, sortOrder: 0 }] },
      },
      select: { id: true },
    })
    newsPosts.push(post.id)
    bump("newsPosts")
  }

  // ── Announcements (club + league level), all public ───────────────────
  const clubAnnos: Array<[string, string]> = [
    ["Practice times move to the Playground for August", "Both squads practise Tuesday and Thursday evenings at the Playground for the rest of the summer. Same times, new gym. Parking is off Century Drive."],
    ["Fall registration opens after Championship Weekend", "Returning families get first call on roster spots. Offers go out through the app — you'll get a notification and can accept on your phone."],
  ]
  for (const cfg of CLUBS) {
    const row = clubRows.get(cfg.key)!
    for (let i = 0; i < clubAnnos.length; i++) {
      await p.announcement.create({
        data: {
          tenantId: row.id, authorId: row.ownerId,
          title: clubAnnos[i][0], content: clubAnnos[i][1],
          isPublic: true, isPinned: i === 0 && !!cfg.featured,
          createdAt: new Date(now.getTime() - days(i * 4 + 1 + (rnd() * 6))),
        },
      })
      bump("announcements")
    }
  }

  // ── Reviews across every club ─────────────────────────────────────────
  const reviewLines: Array<[string, string]> = [
    ["Great coaches, great communication", "Our son improved so much this summer. Offers, sizes and payments were all on the phone — zero paperwork."],
    ["Well organized club", "Tryout to roster in a week, and we always knew what we owed and when. The team chat keeps everyone in the loop."],
    ["Development first", "Coaches develop every kid on the roster, not just the starters. Live stats after every game are a huge bonus."],
    ["Smooth season", "Schedule, standings and recaps all in one place. Best-run club we've been part of."],
    ["Good program, gym is a drive", "Coaching is excellent. Only wish the practice gym were closer to us."],
    ["Worth it", "Second summer with this club and we're back for fall. Well run, fair minutes, honest coaches."],
  ]
  for (let i = 0; i < CLUBS.length; i++) {
    const cfg = CLUBS[i]
    const row = clubRows.get(cfg.key)!
    const n = cfg.featured ? 4 : 2 + (i % 2)
    for (let k = 0; k < n; k++) {
      const donor = teams.find((t) => t.clubKey !== cfg.key && t.rosterParents.length > k + 3)!
      const [title, content] = reviewLines[(i + k) % reviewLines.length]
      await p.review.create({
        data: {
          reviewerId: donor.rosterParents[k + 3], tenantId: row.id,
          rating: rnd() < 0.12 ? 3 : rnd() < 0.45 ? 4 : 5,
          title, content, status: "PUBLISHED",
          createdAt: new Date(now.getTime() - days(3 + ((i * 7 + k * 11) % 60))),
        },
      })
      bump("reviews")
    }
  }
  console.log(`✓ content: ${counts.newsPosts} news cards · ${counts.announcements} announcements · ${counts.reviews} reviews · ${counts.finalPosts} final/POTG posts`)

  // ── Programs: camps, house leagues, tryouts (posted + open) ───────────
  const monthOut = (n: number) => new Date(now.getTime() + days(n))
  for (let i = 0; i < CLUBS.length; i++) {
    const cfg = CLUBS[i]
    const row = clubRows.get(cfg.key)!
    const gym = i % 2 === 0 ? home : rental
    // Multi-week summer camp with weekly + full-camp pricing
    const campStart = monthOut(9 + i)
    const camp = await p.camp.create({
      data: {
        tenantId: row.id, name: `${cfg.short} Summer Skills Camp`,
        description: `Four weeks of skill development with the ${cfg.name} coaching staff. Shooting, ball handling, decision making, and live play every afternoon.`,
        details: `Includes a reversible jersey and a ball. Bring your own lunch; snacks provided. ${SUMMER_MARKER}`,
        campType: "SUMMER", ageGroup: "Grade 7-11", agePolicy: "PREFERRED", gender: null,
        startDate: campStart, endDate: new Date(campStart.getTime() + days(25)),
        dailyStartTime: "09:00", dailyEndTime: "15:00",
        location: gym.name, venueId: gym.id,
        numberOfWeeks: 4, weeklyFee: 275, fullCampFee: 950,
        scheduleKind: "CONSECUTIVE",
        maxParticipants: 40, includesSnacks: true, includesJersey: true, includesBall: true,
        isPublished: true,
      },
      select: { id: true },
    })
    bump("camps")
    // A handful of registrations so capacity chips are not empty
    const donor = teams.find((t) => t.clubKey === cfg.key)!
    for (let k = 0; k < 6; k++) {
      await p.campSignup.create({
        data: {
          campId: camp.id, userId: donor.rosterParents[k], playerId: donor.roster[k],
          weeksSelected: k % 3 === 0 ? 4 : 2, weekNumbers: k % 3 === 0 ? [1, 2, 3, 4] : [2, 3],
          totalFee: k % 3 === 0 ? 950 : 550, status: k === 5 ? "WAITLISTED" : "CONFIRMED",
        },
      }).catch(() => {})
      bump("campSignups")
    }
    await p.programStaff.create({
      data: { programType: "CAMP", programId: camp.id, userId: donor.coachId, designation: "LEAD", assignedById: row.ownerId },
    })
    bump("programStaff")

    // Fall tryout, published to the marketplace
    const tryoutAt = monthOut(14 + i * 2)
    tryoutAt.setHours(18, 30, 0, 0)
    const tryout = await p.tryout.create({
      data: {
        tenantId: row.id, teamId: null,
        title: `${cfg.name} Fall Tryouts — Grade 9 & 10`,
        description: `Open evaluation for our fall/winter club teams. Two hours, full-court play, coaches from every squad on the floor. ${SUMMER_MARKER}`,
        ageGroup: "Grade 9-10", agePolicy: "PREFERRED", gender: null,
        location: gym.name, venueId: gym.id,
        scheduledAt: tryoutAt, duration: 120, fee: 25, maxParticipants: 30,
        isPublished: true, isPublic: true,
      },
      select: { id: true },
    })
    bump("tryouts")
    for (let k = 0; k < 5; k++) {
      const pl = await p.player.findUnique({ where: { id: donor.roster[k] }, select: { firstName: true, lastName: true } })
      await p.tryoutSignup.create({
        data: {
          tryoutId: tryout.id, userId: donor.rosterParents[k], playerId: donor.roster[k],
          playerName: `${pl.firstName} ${pl.lastName}`, playerAge: 15, playerGender: "MALE",
          status: "PENDING", createdAt: new Date(now.getTime() - days(1 + k)),
        },
      }).catch(() => {})
      bump("tryoutSignups")
    }

    // A house league for half the clubs (younger siblings)
    if (i % 2 === 0) {
      const hlStart = monthOut(20)
      await p.houseLeague.create({
        data: {
          tenantId: row.id, name: `${cfg.short} Saturday House League`,
          description: "Eight Saturdays of house-league basketball for younger players — balanced teams, real refs, everyone plays.",
          details: `Includes a reversible jersey and an end-of-season medal. ${SUMMER_MARKER}`,
          ageGroups: "U8,U10,U12", agePolicy: "PREFERRED", gender: null, season: `Fall ${year}`,
          startDate: hlStart, endDate: new Date(hlStart.getTime() + days(56)),
          daysOfWeek: "Saturday", startTime: "10:00", endTime: "12:00",
          location: gym.name, venueId: gym.id,
          fee: 220, maxParticipants: 60,
          includesJersey: true, includesMedal: true, isPublished: true,
        },
      })
      bump("houseLeagues")
    }
  }
  console.log(`✓ programs: ${counts.camps} camps (${counts.campSignups} signups) · ${counts.tryouts} tryouts · ${counts.houseLeagues} house leagues`)

  // ── Practices for every team; dated occurrences for the demo teams ────
  const slotPatterns = [
    [{ dayOfWeek: 2, startTime: "18:30" }, { dayOfWeek: 4, startTime: "19:00" }],
    [{ dayOfWeek: 1, startTime: "18:00" }, { dayOfWeek: 3, startTime: "18:30" }],
    [{ dayOfWeek: 3, startTime: "19:30" }, { dayOfWeek: 5, startTime: "18:00" }],
  ]
  const demoTeams = [lordsG9, lordsG10G, forceG9]
  for (let ti = 0; ti < teams.length; ti++) {
    const t = teams[ti]
    const slots: any[] = []
    for (const patt of slotPatterns[ti % slotPatterns.length]) {
      const slot = await p.practiceSlot.create({
        data: { teamId: t.id, dayOfWeek: patt.dayOfWeek, startTime: patt.startTime, durationMinutes: 90, venueId: home.id, location: HOME_GYM },
        select: { id: true, dayOfWeek: true, startTime: true, durationMinutes: true },
      })
      slots.push(slot)
      bump("practiceSlots")
    }
    if (!demoTeams.includes(t)) continue
    let cancelled = false
    for (let d = -14; d < 21; d++) {
      const day = new Date(now.getTime() + d * 86_400_000)
      for (const slot of slots) {
        if (day.getDay() !== slot.dayOfWeek) continue
        const [hh, mm] = slot.startTime.split(":").map(Number)
        const atDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm)
        const past = atDate.getTime() < now.getTime()
        const cancelThis = !cancelled && d >= 7
        await p.practice.create({
          data: {
            teamId: t.id, tenantId: t.tenantId, scheduledAt: atDate, duration: 90,
            venueId: home.id, location: HOME_GYM, slotId: slot.id,
            status: cancelThis ? "CANCELLED" : past ? "COMPLETED" : "SCHEDULED",
          },
        })
        if (cancelThis) cancelled = true
        bump("practices")
      }
    }
    await p.team.update({ where: { id: t.id }, data: { practiceScheduleAnnouncedAt: new Date(now.getTime() - days(2)) } })
  }

  // ── Team chats ────────────────────────────────────────────────────────
  const chatLines: Array<[string, "coach" | "parent"]> = [
    ["Practice moved to 6:30 this Thursday — same gym.", "coach"],
    ["Thanks coach, we'll be there.", "parent"],
    ["Great win on the weekend everyone. Film before next practice.", "coach"],
    ["Does anyone have a spare AM jersey for team photos?", "parent"],
    ["Bring BOTH jerseys to every game from here on.", "coach"],
    ["Carpool from the west end, two seats, message me.", "parent"],
    ["Doors open 45 minutes before the first tip on Saturday.", "coach"],
    ["What court are we on for the 9am?", "parent"],
    ["Court 2 at the Playground. See you there.", "coach"],
    ["Standings update: we're in the playoff picture. Keep it going.", "coach"],
  ]
  let chatMessages = 0
  for (const t of teams) {
    const n = 7 + Math.floor(rnd() * 4)
    const rows: any[] = []
    let lastAt = new Date(0)
    for (let i = 0; i < n; i++) {
      const [body, who] = chatLines[i % chatLines.length]
      const senderId = who === "coach" ? t.coachId : t.rosterParents[(i * 3) % t.rosterParents.length]
      const createdAt = new Date(now.getTime() - days(6) + i * ((days(6) - 3600_000) / n))
      rows.push({ id: randomUUID(), teamId: t.id, senderId, body, createdAt })
      lastAt = createdAt
      chatMessages++
    }
    await p.teamMessage.createMany({ data: rows })
    const readAt = new Date(lastAt.getTime() + 60_000)
    for (const readerId of new Set([t.coachId, t.asstId, ...t.rosterParents])) {
      const unread = readerId === parentLords.id && t.id === lordsG9.id
      await p.teamChatRead.create({
        data: { userId: readerId, teamId: t.id, lastReadAt: unread ? new Date(lastAt.getTime() - days(3)) : readAt },
      }).catch(() => {})
    }
  }
  bump("chatMessages", chatMessages)

  // ── Polls: team, chat-relayed, and league-wide ────────────────────────
  const teamPoll = await p.poll.create({
    data: {
      teamId: lordsG9.id, createdById: lordsG9.coachId,
      title: "August tournament plans",
      description: "Two questions — helps us commit before entry deadlines.",
      createdAt: new Date(now.getTime() - days(2)),
      questions: {
        create: [
          {
            prompt: "Should we enter the Waterloo Summer Classic? ($95/player)", order: 0,
            options: { create: [{ label: "Yes, count us in", order: 0 }, { label: "No, sitting this one out", order: 1 }, { label: "Yes, if we can carpool", order: 2 }] },
          },
          {
            prompt: "Which August weekends can your family travel?", allowMultiple: true, order: 1,
            options: { create: [{ label: "Aug 8-9", order: 0 }, { label: "Aug 15-16", order: 1 }, { label: "Aug 22-23", order: 2 }] },
          },
        ],
      },
    },
    include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
  })
  bump("polls")
  const [tq1, tq2] = teamPoll.questions
  let pollVotes = 0
  for (let i = 0; i < lordsG9.rosterParents.length; i++) {
    const userId = lordsG9.rosterParents[i]
    if (userId === parentLords.id) continue
    await p.pollVote.create({ data: { questionId: tq1.id, optionId: tq1.options[i % 5 === 3 ? 2 : i % 7 === 5 ? 1 : 0].id, userId } }).catch(() => {})
    await p.pollVote.create({ data: { questionId: tq2.id, optionId: tq2.options[i % 3].id, userId } }).catch(() => {})
    pollVotes += 2
  }
  const leaguePoll = await p.poll.create({
    data: {
      leagueId: league.id, createdById: nph.id, status: "OPEN",
      title: "Championship Weekend planning",
      description: "Help us shape the finals weekend — two quick questions.",
      questions: {
        create: [
          { prompt: "Which finals format do you prefer?", order: 0, options: { create: [{ label: "Single elimination", order: 0 }, { label: "Best-of-3 series", order: 1 }, { label: "Round robin + final", order: 2 }] } },
          { prompt: "Preferred first tip-off time on Saturdays?", order: 1, options: { create: [{ label: "8:00 AM", order: 0 }, { label: "9:00 AM", order: 1 }, { label: "10:00 AM", order: 2 }] } },
        ],
      },
    },
    include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
  })
  bump("polls")
  const [lq1, lq2] = leaguePoll.questions
  const leagueVoters = teams.flatMap((t) => t.rosterParents.slice(0, 3)).slice(0, 40)
  for (let i = 0; i < leagueVoters.length; i++) {
    await p.pollVote.create({ data: { questionId: lq1.id, optionId: lq1.options[i % 3].id, userId: leagueVoters[i] } }).catch(() => {})
    if (i % 4 !== 3) await p.pollVote.create({ data: { questionId: lq2.id, optionId: lq2.options[i % 2].id, userId: leagueVoters[i] } }).catch(() => {})
    pollVotes += 2
  }
  // A quick poll relayed into the Lords chat
  const chatPoll = await p.poll.create({
    data: {
      teamId: lordsG9.id, createdById: lordsG9.coachId, title: "Pizza after Saturday's game?",
      createdAt: new Date(now.getTime() - 3600_000 * 5),
      questions: { create: [{ prompt: "Pizza after Saturday's game?", order: 0, options: { create: [{ label: "We're in", order: 0 }, { label: "Can't make it", order: 1 }] } }] },
    },
    include: { questions: { include: { options: true } } },
  })
  bump("polls")
  await p.teamMessage.create({
    data: { teamId: lordsG9.id, senderId: lordsG9.coachId, body: "Pizza after Saturday's game?", pollId: chatPoll.id, createdAt: new Date(now.getTime() - 3600_000 * 5) },
  })
  for (let i = 0; i < lordsG9.rosterParents.length; i++) {
    const userId = lordsG9.rosterParents[i]
    if (userId === parentLords.id || i % 4 === 3) continue
    await p.pollVote.create({ data: { questionId: chatPoll.questions[0].id, optionId: chatPoll.questions[0].options[i % 5 === 2 ? 1 : 0].id, userId } }).catch(() => {})
    pollVotes++
  }
  bump("pollVotes", pollVotes)

  // ── Team events ───────────────────────────────────────────────────────
  const photoDay = await p.teamEvent.create({
    data: {
      createdById: lordsG9.coachId, title: "Team Photo Day",
      description: "Wear the home jersey — families welcome.",
      location: HOME_GYM, startAt: new Date(now.getTime() + days(6)), durationMinutes: 90,
      teams: { create: [{ teamId: lordsG9.id }] },
    },
    select: { id: true },
  })
  bump("teamEvents")
  await p.teamEvent.create({
    data: {
      createdById: nph.id, title: "NPH Summer Media Day",
      description: "League photo and interview day for the Grade 9 division.",
      location: HOME_GYM, startAt: new Date(now.getTime() + days(12)), durationMinutes: 240,
      teams: { create: teams.filter((t) => t.divKey === "g9b").map((t) => ({ teamId: t.id })) },
    },
  })
  bump("teamEvents")

  // ── Waivers: league Rowan's Law + a club-level agreement ──────────────
  const rowans = WAIVER_TEMPLATES.find((t) => t.key === "concussion-code-on")!
  const rowansBody = rowans.body(SUMMER_LEAGUE)
  const rowansDoc = await p.waiverDocument.create({
    data: {
      leagueId: league.id, title: rowans.title, body: rowansBody,
      type: rowans.type, province: rowans.province, annualRenewal: rowans.annualRenewal,
      required: true, audience: "PARENT",
    },
    select: { id: true },
  })
  bump("waiverDocs")
  const media = WAIVER_TEMPLATES.find((t) => t.key === "media-consent")!
  await p.waiverDocument.create({
    data: {
      tenantId: clubRows.get("lords")!.id, title: media.title, body: media.body("Toronto Lords"),
      type: media.type, province: media.province, annualRenewal: media.annualRenewal,
      required: false, audience: "PARENT",
    },
  })
  bump("waiverDocs")
  const SIGNATURE_PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  const waiverTeams = [lordsG9, lordsG10G, forceG9, forceG10G]
  for (const t of waiverTeams) {
    const parents = await p.user.findMany({
      where: { id: { in: t.rosterParents } },
      select: { id: true, email: true, firstName: true, lastName: true },
    })
    const byId = new Map(parents.map((u: any) => [u.id, u]))
    for (let i = 0; i < t.roster.length; i++) {
      const u = byId.get(t.rosterParents[i]) as any
      const sentAt = new Date(now.getTime() - days(20))
      // parent-lords' first kid signs, second kid stays pending (mixed state)
      const signs = t.rosterParents[i] === parentLords.id ? t.divKey === "g9b" : i < 7
      await p.waiverSignRequest.create({
        data: {
          waiverId: rowansDoc.id, playerId: t.roster[i], seasonId: season.id,
          emailedTo: u?.email ?? `unknown@${EMAIL_DOMAIN}`,
          tokenHash: `summer-${rowansDoc.id.slice(0, 8)}-${t.roster[i]}`,
          expiresAt: new Date(now.getTime() + days(60)),
          consumedAt: signs ? new Date(sentAt.getTime() + days(1)) : null,
          createdAt: sentAt,
        },
      })
      bump("waiverRequests")
      if (signs) {
        await p.waiverSignature.create({
          data: {
            waiverId: rowansDoc.id, playerId: t.roster[i], seasonId: season.id,
            waiverVersion: 1, bodySnapshot: rowansBody,
            signerUserId: u?.id ?? null,
            signerName: u ? `${u.firstName} ${u.lastName}` : "Parent",
            relationship: "Parent/Guardian", signatureData: SIGNATURE_PNG,
            signedAt: new Date(sentAt.getTime() + days(1)),
            validUntil: new Date(sentAt.getTime() + days(366)),
          },
        })
        bump("waiverSignatures")
      }
    }
  }

  // ── The demo family: parent-lords ─────────────────────────────────────
  const kidRows = await p.player.findMany({
    where: { parentId: { in: [parentLords.id, parentForce.id] } },
    select: { id: true, firstName: true, lastName: true, parentId: true, teams: { select: { teamId: true } } },
  })
  const kidLords = kidRows.find((k: any) => k.parentId === parentLords.id && k.teams.some((x: any) => x.teamId === lordsG9.id))!
  const kidLordsG = kidRows.find((k: any) => k.parentId === parentLords.id && k.teams.some((x: any) => x.teamId === lordsG10G.id))!
  const kidForce = kidRows.find((k: any) => k.parentId === parentForce.id)!
  await p.player.update({ where: { id: kidLords.id }, data: { mediaConsent: "GRANTED", socialVisibility: "PUBLIC", handle: `reyes-${kidLords.id.slice(0, 4)}` } })
  await p.player.update({ where: { id: kidLordsG.id }, data: { mediaConsent: "UNSET", socialVisibility: "PRIVATE" } })
  await p.player.update({ where: { id: kidForce.id }, data: { mediaConsent: "GRANTED", socialVisibility: "PRIVATE" } })

  // Follows drive the feed
  await p.follow.create({ data: { userId: parentLords.id, teamId: lordsG9.id } }).catch(() => {})
  await p.follow.create({ data: { userId: parentLords.id, teamId: lordsG10G.id } }).catch(() => {})
  await p.follow.create({ data: { userId: parentLords.id, leagueId: league.id } }).catch(() => {})
  await p.follow.create({ data: { userId: parentLords.id, tenantId: clubRows.get("lords")!.id } }).catch(() => {})
  await p.follow.create({ data: { userId: parentForce.id, teamId: forceG9.id } }).catch(() => {})
  await p.follow.create({ data: { userId: parentForce.id, leagueId: league.id } }).catch(() => {})
  bump("follows", 6)
  // Crowd follows the public kid; one PENDING request to approve
  const fans = [...lordsG9.rosterParents.slice(1, 5), parentForce.id].filter((id) => id !== parentLords.id)
  for (const userId of new Set(fans)) {
    await p.follow.create({ data: { userId, playerId: kidLords.id, status: "ACTIVE" } }).catch(() => {})
    bump("follows")
  }
  await p.follow.create({ data: { userId: lordsG10G.rosterParents[5], playerId: kidLordsG.id, status: "PENDING" } }).catch(() => {})
  bump("follows")

  // Communication consent (CASL) for the demo family
  for (const [scope, key] of [["TENANT", "lords"], ["LEAGUE", null]] as const) {
    await p.communicationConsent.create({
      data: {
        userId: parentLords.id, scope,
        tenantId: scope === "TENANT" ? clubRows.get(key as string)!.id : null,
        leagueId: scope === "LEAGUE" ? league.id : null,
        status: "GRANTED", source: "registration:summer-league",
      },
    }).catch(() => {})
    bump("consents")
  }

  // Story + card posts for the public kid
  const kidBest = await p.playerStat.findFirst({
    where: { playerId: kidLords.id, gameId: { in: completedIds } },
    orderBy: { points: "desc" },
    select: { gameId: true, points: true, rebounds: true, assists: true },
  })
  if (kidBest) {
    await p.story.create({
      data: {
        playerId: kidLords.id, gameId: kidBest.gameId, cardType: "POTG", visibility: "PUBLIC",
        templateId: "bold", createdByUserId: parentLords.id,
        createdAt: new Date(now.getTime() - 3 * 3600_000),
        expiresAt: new Date(now.getTime() + 21 * 3600_000),
      },
    })
    bump("stories")
    const cardPost = await p.post.create({
      data: {
        kind: "STAT_CARD",
        title: `${kidLords.firstName} ${kidLords.lastName}: ${kidBest.points} points`,
        slug: `summer-card-${kidBest.gameId.slice(0, 8)}-${kidLords.id.slice(0, 8)}`,
        body: `${kidBest.points} PTS · ${kidBest.rebounds} REB · ${kidBest.assists} AST.`,
        status: "PUBLISHED", publishedAt: new Date(now.getTime() - 3 * 3600_000),
        authorId: parentLords.id, visibility: "PUBLIC", templateId: "bold",
        tags: { create: [{ playerId: kidLords.id }, { gameId: kidBest.gameId }, { teamId: lordsG9.id }] },
      },
      select: { id: true },
    })
    bump("cardPosts")
    const commentLines = [
      "What a game — that fourth quarter was unreal.",
      "Go Lords!",
      "Defense wins games. Proud of these kids.",
      "That comeback.",
    ]
    for (let i = 0; i < 3; i++) {
      await p.comment.create({
        data: { postId: cardPost.id, authorId: lordsG9.rosterParents[i + 1], body: commentLines[i], createdAt: new Date(now.getTime() - (3 - i) * 3600_000) },
      })
      bump("comments")
    }
    await p.comment.create({
      data: { postId: cardPost.id, authorId: lordsG9.rosterParents[6], body: "ref was garbage, total fix", status: "HIDDEN", reportCount: 3 },
    })
    bump("comments")
    await p.repost.create({ data: { postId: cardPost.id, userId: parentForce.id } }).catch(() => {})
    bump("reposts")
  }

  // Reactions across the recent finals + news
  const reactable = await p.post.findMany({
    where: { OR: [{ slug: { startsWith: "summer-final-" } }, { slug: { startsWith: "summer-news-" } }] },
    select: { id: true }, orderBy: { publishedAt: "desc" }, take: 14,
  })
  const emojis = ["🔥", "🏀", "👍", "❤️", "🎉"]
  const crowd = [...lordsG9.rosterParents, ...forceG9.rosterParents, parentLords.id, parentForce.id]
  for (let i = 0; i < reactable.length; i++) {
    for (let k = 0; k < 2 + (i % 4); k++) {
      await p.postReaction.create({
        data: { postId: reactable[i].id, userId: crowd[(i * 5 + k * 3) % crowd.length], emoji: emojis[(i + k) % emojis.length] },
      }).catch(() => {})
      bump("reactions")
    }
    if (i % 3 === 0) {
      await p.comment.create({
        data: { postId: reactable[i].id, authorId: crowd[(i * 7 + 2) % crowd.length], body: "Great weekend of basketball." },
      })
      bump("comments")
    }
  }

  // FeedEvent telemetry so the recsys surfaces have signal
  const feedRows: any[] = []
  for (let i = 0; i < reactable.length; i++) {
    for (const [eventType, valueMs] of [["impression", null], ["dwell", 2400 + i * 130], ["tap", null]] as const) {
      feedRows.push({
        id: randomUUID(), userId: parentLords.id, postId: reactable[i].id, itemKey: reactable[i].id,
        eventType, valueMs, surface: "web-feed",
        createdAt: new Date(now.getTime() - (i + 1) * 3600_000),
      })
    }
  }
  await p.feedEvent.createMany({ data: feedRows })
  bump("feedEvents", feedRows.length)

  // RSVPs on the upcoming practices + tonight's game
  const upcomingPractices = await p.practice.findMany({
    where: { teamId: { in: [lordsG9.id, lordsG10G.id] }, scheduledAt: { gt: now } },
    select: { id: true, teamId: true }, orderBy: { scheduledAt: "asc" }, take: 4,
  })
  for (const pr of upcomingPractices) {
    const playerId = pr.teamId === lordsG9.id ? kidLords.id : kidLordsG.id
    await p.eventRsvp.create({
      data: { playerId, itemType: "PRACTICE", itemId: pr.id, status: "GOING", respondedById: parentLords.id },
    }).catch(() => {})
    bump("rsvps")
  }
  await p.eventRsvp.create({
    data: { playerId: kidLords.id, itemType: "TEAM_EVENT", itemId: photoDay.id, status: "GOING", respondedById: parentLords.id },
  }).catch(() => {})
  bump("rsvps")

  // ── The cross-league beat: a PENDING fall Showcase registration ───────
  // Deliberately built from rows that touch NOTHING the Showcase planner
  // reads: a club-side fall team + an open Offer + a tryout signup. No
  // TeamSubmission, no division, no session, no venue is created there.
  const showcaseSeason = await p.season.findUnique({
    where: { id: "160b2f09-a95a-4a64-9b90-03793cae105b" },
    select: { id: true, label: true, league: { select: { id: true, name: true } } },
  })
  if (showcaseSeason) {
    const lordsRow = clubRows.get("lords")!
    const fallTeam = await p.team.create({
      data: {
        tenantId: lordsRow.id, name: `Toronto Lords Grade 10 (${showcaseSeason.label})`,
        ageGroup: "Grade 10", gender: "MALE", season: showcaseSeason.label, description: SUMMER_MARKER,
      },
      select: { id: true },
    })
    bump("teams")
    const fallTryout = await p.tryout.create({
      data: {
        tenantId: lordsRow.id, teamId: fallTeam.id,
        title: `Toronto Lords ${showcaseSeason.league.name} Evaluations — Grade 10`,
        description: `Evaluation for our ${showcaseSeason.label} entry. Invitation only. ${SUMMER_MARKER}`,
        ageGroup: "Grade 10", agePolicy: "PREFERRED", gender: "MALE",
        location: HOME_GYM, venueId: home.id,
        scheduledAt: new Date(now.getTime() + days(11)), duration: 120, fee: 0,
        maxParticipants: 24, isPublished: true, isPublic: true,
      },
      select: { id: true },
    })
    bump("tryouts")
    const signup = await p.tryoutSignup.create({
      data: {
        tryoutId: fallTryout.id, userId: parentLords.id, playerId: kidLords.id,
        playerName: `${kidLords.firstName} ${kidLords.lastName}`, playerAge: 15, playerGender: "MALE",
        status: "PENDING", createdAt: new Date(now.getTime() - days(2)),
      },
      select: { id: true },
    })
    bump("tryoutSignups")
    const tpl = lordsRow.templates[0]
    const fallOffer = await p.offer.create({
      data: {
        teamId: fallTeam.id, playerId: kidLords.id, tryoutSignupId: signup.id, templateId: tpl.id,
        status: "PENDING", seasonFee: 1250, installments: 4, practiceSessions: 40,
        gamesMin: 10, gamesMax: 12,
        programDescription: `Fall/winter club season in the ${showcaseSeason.league.name}, plus two practices a week from September.`,
        includesUniform: true, includesBall: true,
        message: `${kidLords.firstName} had a strong summer — we'd love to have him back for the fall/winter season. Offer expires in 10 days.`,
        expiresAt: new Date(now.getTime() + days(10)),
        createdAt: new Date(now.getTime() - days(1)),
      },
      select: { id: true },
    })
    bump("offers")
    await p.notification.create({
      data: {
        userId: parentLords.id, type: "offer_received",
        title: "New offer from Toronto Lords",
        message: `Fall/winter roster spot — ${showcaseSeason.league.name} ${showcaseSeason.label}. Expires in 10 days.`,
        link: "/offers", referenceId: fallOffer.id, referenceType: "Offer",
      },
    })
    bump("notifications")
  }

  // Notifications that make the bell worth opening
  await p.notification.create({
    data: {
      userId: parentLords.id, type: "team_chat",
      title: `New messages in ${lordsG9.name} chat`,
      message: "Coach: Standings update — we're in the playoff picture.",
      link: `/teams/${lordsG9.id}/chat`, referenceId: lordsG9.id, referenceType: "Team",
    },
  })
  await p.notification.create({
    data: {
      userId: parentLords.id, type: "team_poll",
      title: `New poll for ${lordsG9.name}`, message: "August tournament plans",
      link: `/teams/${lordsG9.id}/polls`, referenceId: teamPoll.id, referenceType: "Poll",
    },
  })
  await p.notification.create({
    data: {
      userId: parentLords.id, type: "game_tonight",
      title: "Game tonight", message: `${lordsG10.name} vs ${huskiesG10.name} — 7:30 PM at ${HOME_GYM}.`,
      link: `/games/${tonightGameId}`, referenceId: tonightGameId, referenceType: "Game",
    },
  })
  bump("notifications", 3)

  // A pending roster-change request for the commissioner to act on
  const burloakSub = submissionByTeam.get(forceG9.id)
  if (burloakSub) {
    const roster = await p.seasonRoster.findFirst({ where: { teamSubmissionId: burloakSub }, select: { id: true } })
    if (roster) {
      const req = await p.rosterChangeRequest.create({
        data: {
          rosterId: roster.id, requestedById: clubRows.get("force")!.ownerId, status: "PENDING",
          message: "Two players are out for the rest of the summer (ankle and family travel). We'd like to call up two Grade 9s so we don't forfeit the last weekend.",
          createdAt: new Date(now.getTime() - days(1)),
        },
        select: { id: true },
      })
      await p.notification.create({
        data: {
          userId: nph.id, type: "roster_change_requested", title: "Roster change requested",
          message: `${forceG9.name} is asking to change their ${seasonLabel} roster.`,
          link: `/manage/leagues/${league.id}/seasons/${season.id}/manage`,
          referenceId: req.id, referenceType: "RosterChangeRequest",
        },
      })
      bump("notifications")
    }
  }

  await flushRoles()
  await flushUsers()

  return { leagueId: league.id, seasonId: season.id, tonightGameId, marqueeGameId, seasonLabel }
}

// ════════════════════════════════════════════════════════════════════════
function printSummary(extra: Record<string, string>) {
  const rows = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  const w = Math.max(...rows.map(([k]) => k.length), 18)
  console.log("\n┌─ CREATED " + "─".repeat(w + 12))
  for (const [k, v] of rows) console.log(`│ ${k.padEnd(w)}  ${String(v).padStart(6)}`)
  console.log("└" + "─".repeat(w + 22))
  for (const [k, v] of Object.entries(extra)) console.log(`  ${k}: ${v}`)
}

function printCheatSheet() {
  console.log(
    [
      "",
      "══════════════════════════════════════════════════════════════════",
      ` NPH SUMMER WORLD — LOGINS (password for ALL: ${PASSWORD} · ref PIN 1234)`,
      "══════════════════════════════════════════════════════════════════",
      ` owner-nph@${EMAIL_DOMAIN}                 league operator (existing account)`,
      ` summer-parent-lords@${EMAIL_DOMAIN}   ⭐  Jordan Reyes — 2 kids on Lords,`,
      "                                          mixed payments/waivers, live feed,",
      "                                          PENDING fall Showcase offer",
      ` summer-parent-force@${EMAIL_DOMAIN}       Sana Malik — Force family`,
      "──────────────────────────────────────────────────────────────────",
      " Club owners:",
      ...CLUBS.map((c) => `   summer-owner-${c.key}@${EMAIL_DOMAIN}`.padEnd(50) + c.name + (c.featured ? " ⭐featured" : "")),
      "──────────────────────────────────────────────────────────────────",
      " Coaches:   summer-coach-<club>-gr<9|10>[g]@sportshub.demo",
      "            e.g. summer-coach-lords-gr9@ · summer-coach-force-gr10@",
      " Assistants: summer-asst-<club>-gr<9|10>[g]@sportshub.demo",
      ` Referees:  ${REFS.map((r) => `summer-${r[2]}@`).join(" · ")}   (PIN 1234)`,
      "──────────────────────────────────────────────────────────────────",
      " Background parents: parent-summer-<club>-NNN@sportshub.demo",
      "══════════════════════════════════════════════════════════════════",
    ].join("\n")
  )
}

async function main() {
  const args = process.argv.slice(2)
  await guardLocal()

  const existing = await p.league.findFirst({ where: { name: SUMMER_LEAGUE }, select: { id: true } })

  if (args.includes("--wipe")) {
    await wipeSummerWorld()
    return
  }
  if (existing && !args.includes("--reset")) {
    const games = await p.game.count({ where: { season: { leagueId: existing.id } } })
    const teamCount = await p.team.count({ where: { description: SUMMER_MARKER } })
    console.log(`\n✓ ${SUMMER_LEAGUE} already present — nothing created (idempotent no-op).`)
    console.log(`  ${teamCount} teams · ${games} games. Re-run with --reset to rebuild it.`)
    return
  }
  if (existing) await wipeSummerWorld()

  const t0 = Date.now()
  const result = await seed()
  printSummary({
    "League": `${SUMMER_LEAGUE} (${result.leagueId})`,
    "Season": `${result.seasonLabel} (${result.seasonId})`,
    "Tonight's game": `/games/${result.tonightGameId}`,
    "Last night's marquee": `/games/${result.marqueeGameId}`,
    "Built in": `${Math.round((Date.now() - t0) / 1000)}s`,
  })
  printCheatSheet()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
