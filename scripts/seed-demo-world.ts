/**
 * LIMITED-LAUNCH DEMO WORLD — compact v1 (2026-08-12 build instructions).
 * Spec: docs/demo-world-spec-2026-08.md (DRAFT FOR OWNER MARKUP — every
 * name/count/date below is a default the owner may edit; this CONFIG block
 * is where edits land).
 *
 * Builds ONE fictional world, self-contained from every other demo world in
 * this repo (NPH's scripts/seed-nph-demo.ts, scripts/seed-journey.ts, etc.):
 *   - League "Maple Court League" (isDemo=true), one COMPLETE season
 *     (Jan-Jun 2026): 8 fictional clubs (isDemo=true), grades 7-10 boys, one
 *     team per club per grade (32 teams), full single round robin per grade
 *     (28 games x 4 grades = 112), deterministic scores + box scores + per-
 *     player stat lines, standings derivable from Division/TeamSubmission.
 *   - Playoffs for Gr9 + Gr10: top-4 bracket (2 semis + 1 final per grade),
 *     COMPLETED, phase PLAYOFF, a champion per grade.
 *   - One "Showcase Weekend" (next Saturday from run date): 6 SCHEDULED
 *     exhibition games in their OWN Season (label contains "showcase" —
 *     required by scripts/demo/live-carousel.ts's pool selection, and kept
 *     structurally separate from the completed season so that driver can
 *     never touch the frozen regular-season/playoff standings) — the
 *     live-carousel fixture pool (§3 of the spec).
 *   - Feed: 12 recap posts, 6 Player-of-the-Game posts, 3 club
 *     announcements, 2 league news articles.
 *   - Four FIXED personas (docs/demo-world-spec-2026-08.md §5 + the already-
 *     built apps/web/src/lib/demo/persona-session.ts, which reads users at
 *     these exact addresses): persona-parent, persona-coach, persona-club,
 *     persona-league @sportshub.demo, password TestPass123!.
 *   - 5 staged team-chat messages on the coach's Gr8 team (spec §6).
 *
 * Modes:
 *   (none)   wipe this world + rebuild (default, idempotent)
 *   --wipe   wipe only, no reseed
 *   --yes-prod   required when DATABASE_URL is not localhost
 *
 *   npx tsx scripts/seed-demo-world.ts [flags]
 */

import bcrypt from "bcryptjs"
import { prisma } from "@youthbasketballhub/db"
import { foldEvents, totalRebounds } from "../apps/web/src/lib/scoring/fold"
import { upsertGameRecap } from "../apps/web/src/lib/content/recap-service"
import { EMAIL_DOMAIN, PASSWORD } from "./demo-shared"

// Deterministic recaps: force the template engine even if a key is present
// (same rule as scripts/seed-nph-demo.ts) — no network calls, reproducible.
delete process.env.ANTHROPIC_API_KEY

const p = prisma as any

// ════════════════════════════════════════════════════════════════════════
// CONFIG — owner-editable. Source spec: docs/demo-world-spec-2026-08.md.
// Every name/count/date is a default; re-run the seeder after any edit here
// (~30-60s). This is a SEPARATE, self-contained world — it never reads or
// writes rows created by scripts/seed-nph-demo.ts or scripts/seed-journey.ts.
// ════════════════════════════════════════════════════════════════════════

const LEAGUE_NAME = "Maple Court League"
const LEAGUE_TAGLINE = "MCL Basketball"
const SEASON_LABEL = "Winter 2026"
const SEASON_START = new Date(2026, 0, 5) // Jan 5, 2026
const SEASON_END = new Date(2026, 5, 20) // Jun 20, 2026 (spec: "Jan-Jun 2026")
const GRADES = [7, 8, 9, 10] as const
const ROSTER_SIZE = 10 // players per team, spec §"~10/roster"

interface ClubCfg {
  key: string // login/email fragment + wipe marker
  name: string
  slug: string
  city: string
  color: string
}

// 8 fictional clubs (names echo the spec's default 12-club list so the
// owner's markup maps cleanly). Verified not to collide with any of the 188
// real imported Ontario clubs (docs/ontario-basketball-clubs.csv) or any
// other seeder's slugs.
const CLUBS: ClubCfg[] = [
  { key: "wolves", name: "Northgate Wolves", slug: "northgate-wolves", city: "Toronto", color: "#7c3aed" },
  { key: "storm", name: "Lakeside Storm", slug: "lakeside-storm", city: "Mississauga", color: "#1d4ed8" },
  { key: "hoops", name: "Harbour City Hoops", slug: "harbour-city-hoops", city: "Hamilton", color: "#0f766e" },
  { key: "rise", name: "Ridgeview Rise", slug: "ridgeview-rise", city: "Burlington", color: "#b45309" },
  { key: "blues", name: "Bayfront Blues", slug: "bayfront-blues", city: "Oakville", color: "#0891b2" },
  { key: "select", name: "Summit Select", slug: "summit-select", city: "Brampton", color: "#9333ea" },
  { key: "ironwood", name: "Ironwood Elite", slug: "ironwood-elite", city: "Vaughan", color: "#16a34a" },
  { key: "eagles", name: "Eastfield Eagles", slug: "eastfield-eagles", city: "Markham", color: "#dc2626" },
]

// Persona anchors (spec §5): which club/team each fixed persona is tied to.
const STORM_KEY = "storm" // persona-club (Jordan Blake) — ClubOwner, open tryout
const WOLVES_KEY = "wolves" // persona-coach (Dre Wilson) — HeadCoach, Gr8
const WOLVES_COACH_GRADE = 8

const GRADE_INFO: Record<number, { birthYear: number; age: number; pace: number }> = {
  7: { birthYear: 2013, age: 12, pace: 20 },
  8: { birthYear: 2012, age: 13, pace: 24 },
  9: { birthYear: 2011, age: 14, pace: 27 },
  10: { birthYear: 2010, age: 15, pace: 30 },
}

interface VenueCfg {
  name: string
  address: string
  city: string
  courts: number
}

// 3 fictional venues (spec §1) — mirrors the real Six Park + Playground
// shape so the pitch-demo math still works.
const VENUES: VenueCfg[] = [
  { name: "The Yard", address: "480 Kipling Ave", city: "Toronto", courts: 6 },
  { name: "Harbourview Fieldhouse", address: "220 Harbour St", city: "Mississauga", courts: 3 },
  { name: "North Gym", address: "77 Cedar St", city: "Vaughan", courts: 2 },
]

const GAME_SLOT_MINUTES = 90

// Regular season: single round robin, one round per week (7 rounds x 4
// games/grade). All 4 Saturdays verified to land on Saturday.
const ROUND_DATES = [
  new Date(2026, 0, 10),
  new Date(2026, 0, 17),
  new Date(2026, 0, 24),
  new Date(2026, 0, 31),
  new Date(2026, 1, 7),
  new Date(2026, 1, 14),
  new Date(2026, 1, 21),
]
const PLAYOFF_GRADES = [9, 10] as const
const PLAYOFF_SEMI_DATE = new Date(2026, 1, 28)
const PLAYOFF_FINAL_DATE = new Date(2026, 2, 7)

// Fixed persona identities (apps/web/src/lib/demo/persona-session.ts reads
// users at exactly these emails — do not change without updating that file).
const PERSONAS = {
  parent: { email: `persona-parent@${EMAIL_DOMAIN}`, firstName: "Sam", lastName: "Carter" },
  coach: { email: `persona-coach@${EMAIL_DOMAIN}`, firstName: "Dre", lastName: "Wilson" },
  club: { email: `persona-club@${EMAIL_DOMAIN}`, firstName: "Jordan", lastName: "Blake" },
  league: { email: `persona-league@${EMAIL_DOMAIN}`, firstName: "Alex", lastName: "Morgan" },
  // Owner 2026-08-13: the player persona ("the most important one") — a
  // Gr10 self-owned player (13+ pattern: parentId = own user id).
  player: { email: `persona-player@${EMAIL_DOMAIN}`, firstName: "Marcus", lastName: "Reid" },
}
const PLAYER_PERSONA_CLUB_KEY = "select" // Marcus plays Gr10 for Summit Select
// Sam's two kids (spec §5): Gr8 boy on Northgate Wolves, Gr10 boy on Lakeside
// Storm — both already rostered on the (completed) regular season.
const SAM_GR8_KID = { firstName: "Miles", lastName: "Carter" }
const SAM_GR10_KID = { firstName: "Elijah", lastName: "Carter" }

// The one PENDING offer waiting for Sam (spec §5): Lakeside Storm re-signs
// Elijah for next season via its open tryout — deposit + 3-monthly package.
const OFFER_PRICING = { newPlayerFee: 1400, returningFee: 1200, installments: 4 }

// Wipe scoping (hard rule: touch nothing outside this world). Team rows
// carry this marker; generated (non-persona) users carry this email prefix.
const DEMO_MARKER = "MCL_DEMO_SEED"
const MCL_PREFIX = "mcl-"
const PERSONA_EMAILS = Object.values(PERSONAS).map((x) => x.email)

// ── Name pools (fictional, diverse Canadian names) ──────────────────────
const BOY_NAMES = [
  "Liam", "Noah", "Ethan", "Lucas", "Mason", "Owen", "Kai", "Aiden", "Josiah", "Xavier",
  "Marcus", "Malik", "Andre", "Devon", "Tyler", "Jordan", "Cameron", "Darius", "Amir", "Ravi",
  "Arjun", "Wei", "Kevin", "Daniel", "Nathan", "Cole", "Theo", "Felix", "Mateo", "Ibrahim",
  "Yusuf", "Elijah", "Isaiah", "Omar", "Jayden", "Emmett", "Hassan", "Diego", "Anh", "Miles",
]
const ADULT_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Jamie", "Robin", "Dana", "Chris", "Pat",
  "Lee", "Maria", "David", "Sarah", "Kevin", "Lisa", "Mark", "Anita", "Paul", "Nadia",
  "Victor", "Elena", "Tunde", "Fatima", "Carlos", "Wendy", "Raj", "Grace", "Dmitri", "Priya",
]
const LAST_NAMES = [
  "Thompson", "Williams", "Chen", "Patel", "Singh", "Osei", "Diallo", "Nguyen", "Garcia", "Martinez",
  "Brown", "Wilson", "Campbell", "Grant", "Baptiste", "Charles", "Pierre", "Ahmed", "Ali", "Khan",
  "Kim", "Park", "Lee", "Wong", "Liu", "Sharma", "Gupta", "Okafor", "Mensah", "Boateng",
  "Silva", "Santos", "Rodriguez", "Anderson", "Jackson", "White", "Harris", "Robinson", "Clarke", "Lewis",
  "Walker", "Young", "Allen", "Wright", "Scott", "Green", "Baker", "Reid", "Murray", "Sinclair",
]

// ── Deterministic RNG (mulberry32) — reproducible scores/rosters ────────
let rngState = 20260812
function rnd(): number {
  rngState |= 0
  rngState = (rngState + 0x6d2b79f5) | 0
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
const days = (n: number) => n * 86400_000

// ── Prod safety rail (same pattern as scripts/seed-nph-demo.ts) ─────────
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

// ── Game event stream (same proven shape as scripts/seed-nph-demo.ts's
// buildGameEvents) — realistic play-by-play that folds into box scores. ──
function buildGameEvents(opts: {
  gameId: string
  homeTeamId: string
  awayTeamId: string
  homeRoster: string[]
  awayRoster: string[]
  pace: number
  startAt: Date
  homeEdge: number
}) {
  const { gameId, homeTeamId, awayTeamId, homeRoster, awayRoster, pace, startAt, homeEdge } = opts
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
      clientEventId: `mcldemo-${gameId.slice(0, 8)}-${seq}`,
      metadata: e.metadata ?? undefined,
      timestamp: new Date(startAt.getTime() + seq * 18_000),
    })
  const PERIOD_SECONDS = 600 // 10-minute quarters

  const takeAttendance = (roster: string[]) => {
    const absent = new Set<string>()
    for (let i = 5; i < roster.length; i++) {
      if (rnd() < (i === roster.length - 1 ? 0.35 : 0.1)) absent.add(roster[i])
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

  for (let q = 1; q <= 4; q++) {
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
    push({ eventType: "PERIOD_END", period: q, clockSeconds: 0 })
  }
  return events
}

/** Circle-method single round robin: N teams (even) -> N-1 rounds x N/2 pairs. */
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

/** Simple local standings (wins, then point differential) — used only to
 *  seed the playoff bracket. The app's real lib/standings/compute.ts is what
 *  the public/operator pages read; this never needs to match it exactly. */
function computeStandingsLocal(
  games: Array<{ homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number }>
) {
  const rec = new Map<string, { w: number; l: number; diff: number }>()
  const bump = (id: string) => {
    if (!rec.has(id)) rec.set(id, { w: 0, l: 0, diff: 0 })
    return rec.get(id)!
  }
  for (const g of games) {
    const home = bump(g.homeTeamId)
    const away = bump(g.awayTeamId)
    home.diff += g.homeScore - g.awayScore
    away.diff += g.awayScore - g.homeScore
    if (g.homeScore > g.awayScore) {
      home.w++
      away.l++
    } else {
      away.w++
      home.l++
    }
  }
  return [...rec.entries()]
    .map(([teamId, r]) => ({ teamId, ...r }))
    .sort((a, b) => b.w - a.w || b.diff - a.diff || a.teamId.localeCompare(b.teamId))
}

// ════════════════════════════════════════════════════════════════════════
// WIPE — surgical, scoped to this world only.
// ════════════════════════════════════════════════════════════════════════

/** Delete a league + everything hanging off its seasons (proven shape from
 *  scripts/seed-nph-demo.ts's deleteLeagueDeep — Season->Game has no DB
 *  cascade, so games must go before teams/seasons can be dropped). */
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

/** Delete users + everything hanging off them, FK-safe (proven shape from
 *  scripts/seed-nph-demo.ts's deleteUsersDeep). The owned-leagues step is
 *  guarded to isDemo:true leagues only — the hard rule that this seeder
 *  never deletes a non-demo League even if it somehow shared an owner id. */
async function deleteUsersDeep(userIds: string[]) {
  if (userIds.length === 0) return
  const ownedLeagues = await p.league.findMany({
    where: { ownerId: { in: userIds }, isDemo: true },
    select: { id: true },
  })
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

/** Wipe ONLY this demo world. Guard: refuses to touch any Tenant/League
 *  where isDemo != true, and any user whose email doesn't end @sportshub.demo
 *  (hard rule). Global Venues are left alone (shared registry, like every
 *  other seeder in this repo). */
async function wipeWorld() {
  const league = await p.league.findFirst({ where: { name: LEAGUE_NAME, isDemo: true }, select: { id: true } })
  if (league) await deleteLeagueDeep(league.id)

  const users = await p.user.findMany({
    where: {
      OR: [
        { AND: [{ email: { startsWith: MCL_PREFIX } }, { email: { endsWith: `@${EMAIL_DOMAIN}` } }] },
        { email: { in: PERSONA_EMAILS } },
      ],
    },
    select: { id: true, email: true },
  })
  const safeUserIds = users
    .filter((u: any) => typeof u.email === "string" && u.email.endsWith(`@${EMAIL_DOMAIN}`))
    .map((u: any) => u.id)
  await deleteUsersDeep(safeUserIds)

  const clubSlugs = CLUBS.map((c) => c.slug)
  const tenants = await p.tenant.findMany({ where: { slug: { in: clubSlugs }, isDemo: true }, select: { id: true, name: true } })
  for (const t of tenants) {
    await p.paymentObligation.deleteMany({ where: { OR: [{ payeeTenantId: t.id }, { payerTenantId: t.id }] } })
    await p.payment.deleteMany({ where: { tenantId: t.id } })
    await p.tenant.delete({ where: { id: t.id } }).catch((e: any) => {
      console.log(`  ! could not delete tenant ${t.name}: ${e.message?.slice(0, 120)}`)
    })
  }
  // Safety net: any team still carrying this world's marker (should be none
  // left once the tenants above cascade-delete their teams).
  await p.team.deleteMany({ where: { description: DEMO_MARKER } })

  console.log(`✓ demo world wiped (${league ? 1 : 0} league, ${safeUserIds.length} users, ${tenants.length} tenants)`)
}

// ════════════════════════════════════════════════════════════════════════
// SEED
// ════════════════════════════════════════════════════════════════════════

interface SeededTeam {
  id: string
  name: string
  tenantId: string
  clubKey: string
  grade: number
  roster: string[] // playerIds
  rosterParents: string[] // parent userIds, aligned with roster
  coachId: string
}

interface PlayedGame {
  id: string
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
  topPlayerId: string | null
  topPoints: number
}

async function seed() {
  const now = new Date()
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const mkUser = (email: string, firstName: string, lastName: string, extra: any = {}) =>
    p.user.create({
      data: { email, passwordHash, firstName, lastName, phoneNumber: "416-555-0100", onboardedAt: new Date(), city: "Toronto", state: "ON", ...extra },
      select: { id: true },
    })

  /** Play one game end-to-end: create it, generate a realistic event stream,
   *  fold it into the final score + per-player box score, mark COMPLETED. */
  async function playGame(opts: {
    seasonId: string
    homeTeamId: string
    awayTeamId: string
    homeRoster: string[]
    awayRoster: string[]
    pace: number
    scheduledAt: Date
    venueId: string
    courtId: string
    phase: "REGULAR" | "PLAYOFF"
    playoffRound?: number
    playoffSlot?: number
  }): Promise<PlayedGame> {
    const game = await p.game.create({
      data: {
        seasonId: opts.seasonId,
        phase: opts.phase,
        homeTeamId: opts.homeTeamId,
        awayTeamId: opts.awayTeamId,
        venueId: opts.venueId,
        courtId: opts.courtId,
        scheduledAt: opts.scheduledAt,
        duration: GAME_SLOT_MINUTES,
        status: "SCHEDULED",
        playoffRound: opts.playoffRound ?? null,
        playoffSlot: opts.playoffSlot ?? null,
        // Draft/publish layer: every public/family/mobile surface filters on
        // publishedAt != null — seeded games are the live demo world, not
        // operator drafts.
        publishedAt: now,
      },
      select: { id: true },
    })
    const events = buildGameEvents({
      gameId: game.id,
      homeTeamId: opts.homeTeamId,
      awayTeamId: opts.awayTeamId,
      homeRoster: opts.homeRoster,
      awayRoster: opts.awayRoster,
      pace: opts.pace,
      startAt: opts.scheduledAt,
      homeEdge: 0.44 + rnd() * 0.12,
    })
    await p.gameEvent.createMany({ data: events })
    const folded = foldEvents(
      events.map((e: any) => ({ ...e, timestampMs: e.timestamp.getTime() })),
      { homeTeamId: opts.homeTeamId, awayTeamId: opts.awayTeamId }
    )
    await p.$transaction(async (tx: any) => {
      await tx.game.update({
        where: { id: game.id },
        data: {
          homeScore: folded.homeScore,
          awayScore: folded.awayScore,
          status: "COMPLETED",
          finalizedAt: new Date(opts.scheduledAt.getTime() + 90 * 60_000),
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
    const top = (Object.values(folded.players) as any[]).sort((a, b) => b.points - a.points)[0]
    return {
      id: game.id,
      homeTeamId: opts.homeTeamId,
      awayTeamId: opts.awayTeamId,
      homeScore: folded.homeScore,
      awayScore: folded.awayScore,
      topPlayerId: top?.playerId ?? null,
      topPoints: top?.points ?? 0,
    }
  }

  // ── Personas (fixed emails — apps/web/src/lib/demo/persona-session.ts) ──
  const personaParent = await mkUser(PERSONAS.parent.email, PERSONAS.parent.firstName, PERSONAS.parent.lastName)
  await p.userRole.create({ data: { userId: personaParent.id, role: "Parent" } })
  const personaCoach = await mkUser(PERSONAS.coach.email, PERSONAS.coach.firstName, PERSONAS.coach.lastName)
  const personaClub = await mkUser(PERSONAS.club.email, PERSONAS.club.firstName, PERSONAS.club.lastName)
  const personaLeague = await mkUser(PERSONAS.league.email, PERSONAS.league.firstName, PERSONAS.league.lastName)
  const personaPlayer = await mkUser(PERSONAS.player.email, PERSONAS.player.firstName, PERSONAS.player.lastName)
  await p.userRole.create({ data: { userId: personaPlayer.id, role: "Player" } })
  console.log("✓ 5 personas created (Sam Carter, Dre Wilson, Jordan Blake, Alex Morgan, Marcus Reid)")

  // ── Venues + courts (find-or-create, global registry) ──────────────────
  const venueRows = new Map<string, { id: string; courtIds: string[] }>()
  for (const v of VENUES) {
    let venue = await p.venue.findFirst({ where: { name: v.name }, select: { id: true } })
    if (!venue) {
      venue = await p.venue.create({
        data: { name: v.name, address: v.address, city: v.city, state: "ON", country: "CA" },
        select: { id: true },
      })
    }
    const courtIds: string[] = []
    for (let c = 1; c <= v.courts; c++) {
      let court = await p.court.findFirst({ where: { venueId: venue.id, name: `Court ${c}` }, select: { id: true } })
      if (!court) court = await p.court.create({ data: { venueId: venue.id, name: `Court ${c}`, displayOrder: c }, select: { id: true } })
      courtIds.push(court.id)
    }
    venueRows.set(v.name, { id: venue.id, courtIds })
  }
  console.log(`✓ ${VENUES.length} venues (${VENUES.map((v) => `${v.name} x${v.courts}`).join(", ")})`)

  // Flat slot list (venue x court x time-of-day) — enough capacity (2 times
  // x 11 courts = 22) for the 16 games/grade-day the round robin needs.
  const TIME_SLOTS = [
    { hour: 9, minute: 0 },
    { hour: 11, minute: 15 },
  ]
  const daySlotList: Array<{ venueId: string; courtId: string; hour: number; minute: number }> = []
  for (const time of TIME_SLOTS) {
    for (const v of VENUES) {
      const row = venueRows.get(v.name)!
      for (const courtId of row.courtIds) daySlotList.push({ venueId: row.id, courtId, ...time })
    }
  }

  // ── League + season + divisions ──────────────────────────────────────
  const league = await p.league.create({
    data: {
      name: LEAGUE_NAME,
      description: "Maple Court League — grade-based youth basketball, every game live-scored with stats, standings and recaps.",
      isDemo: true,
      ownerId: personaLeague.id,
      tagline: LEAGUE_TAGLINE,
      statDepth: "STANDARD",
      periodType: "QUARTERS",
    },
  })
  await p.userRole.create({ data: { userId: personaLeague.id, role: "LeagueOwner", leagueId: league.id } })
  const season = await p.season.create({
    data: {
      leagueId: league.id,
      label: SEASON_LABEL,
      type: "CUSTOM",
      status: "COMPLETED",
      startDate: SEASON_START,
      endDate: SEASON_END,
      gamesGuaranteed: ROUND_DATES.length, // single round robin, 8 teams/grade
      tiebreakerOrder: ["HEAD_TO_HEAD", "POINT_DIFFERENTIAL", "POINTS_SCORED"],
      tiebreakersLockedAt: now,
      // Gates the public league hub's season-calendar widget — a completed
      // season with nothing left to plan is still a published one.
      planPublishedAt: SEASON_START,
    },
  })
  const divisionsByGrade = new Map<number, { id: string }>()
  for (const g of GRADES) {
    divisionsByGrade.set(
      g,
      await p.division.create({
        data: { seasonId: season.id, name: `Grade ${g} Boys`, ageGroup: `Grade ${g}`, gender: "MALE" },
        select: { id: true },
      })
    )
  }
  for (const v of VENUES) {
    const row = venueRows.get(v.name)!
    await p.seasonVenue.upsert({
      where: { seasonId_venueId: { seasonId: season.id, venueId: row.id } },
      create: { seasonId: season.id, venueId: row.id, courtsAvailable: row.courtIds.length },
      update: {},
    })
  }
  console.log(`✓ ${LEAGUE_NAME} · ${SEASON_LABEL} (COMPLETED) · ${GRADES.length} grade divisions`)

  // ── Clubs (tenants) ──────────────────────────────────────────────────
  const clubRows = new Map<string, { tenantId: string; ownerId: string }>()
  for (const club of CLUBS) {
    const tenant = await p.tenant.create({
      data: {
        slug: club.slug,
        name: club.name,
        isDemo: true,
        status: "ACTIVE",
        plan: "FREE",
        city: club.city,
        state: "ON",
        country: "CA",
        currency: "CAD",
        timezone: "America/Toronto",
      },
      select: { id: true },
    })
    await p.tenantBranding.create({ data: { tenantId: tenant.id, primaryColor: club.color } })
    const isPersonaClub = club.key === STORM_KEY
    const owner = isPersonaClub
      ? personaClub
      : await mkUser(`${MCL_PREFIX}owner-${club.key}@${EMAIL_DOMAIN}`, pick(ADULT_NAMES), pick(LAST_NAMES), { city: club.city })
    await p.userRole.create({ data: { userId: owner.id, role: "ClubOwner", tenantId: tenant.id } })
    clubRows.set(club.key, { tenantId: tenant.id, ownerId: owner.id })
  }
  console.log(`✓ ${CLUBS.length} clubs created + branded (Jordan Blake owns Lakeside Storm)`)

  // ── Teams + rosters (32 = 8 clubs x 4 grades) ───────────────────────────
  const teams: SeededTeam[] = []
  let samGr8KidId = ""
  let samGr10KidId = ""

  for (const club of CLUBS) {
    const row = clubRows.get(club.key)!
    for (const grade of GRADES) {
      const teamName = `${club.name} Grade ${grade}`
      const team = await p.team.create({
        data: {
          tenantId: row.tenantId,
          name: teamName,
          ageGroup: `Grade ${grade}`,
          gender: "MALE",
          season: SEASON_LABEL,
          description: DEMO_MARKER,
        },
        select: { id: true },
      })

      const isWolvesCoachTeam = club.key === WOLVES_KEY && grade === WOLVES_COACH_GRADE
      const coach = isWolvesCoachTeam
        ? personaCoach
        : await mkUser(`${MCL_PREFIX}coach-${club.key}-g${grade}@${EMAIL_DOMAIN}`, pick(ADULT_NAMES), pick(LAST_NAMES), { city: club.city })
      await p.userRole.create({ data: { userId: coach.id, role: "Staff", tenantId: row.tenantId } })
      await p.userRole.create({ data: { userId: coach.id, role: "Staff", tenantId: row.tenantId, teamId: team.id, designation: "HeadCoach" } })

      const info = GRADE_INFO[grade]
      const roster: string[] = []
      const rosterParents: string[] = []
      for (let i = 0; i < ROSTER_SIZE; i++) {
        const isSamGr8 = club.key === WOLVES_KEY && grade === WOLVES_COACH_GRADE && i === 0
        const isSamGr10 = club.key === STORM_KEY && grade === 10 && i === 0
        const isMarcus = club.key === PLAYER_PERSONA_CLUB_KEY && grade === 10 && i === 0

        let parentId: string
        if (isSamGr8 || isSamGr10) {
          parentId = personaParent.id
        } else if (isMarcus) {
          // 13+ self-owned player: parentId = the player's own user id.
          parentId = personaPlayer.id
        } else {
          const parent = await mkUser(
            `${MCL_PREFIX}parent-${club.key}-g${grade}-${i}@${EMAIL_DOMAIN}`,
            pick(ADULT_NAMES),
            pick(LAST_NAMES),
            { city: club.city }
          )
          await p.userRole.create({ data: { userId: parent.id, role: "Parent" } })
          parentId = parent.id
        }

        const firstName = isSamGr8 ? SAM_GR8_KID.firstName : isSamGr10 ? SAM_GR10_KID.firstName : isMarcus ? PERSONAS.player.firstName : pick(BOY_NAMES)
        const lastName = isSamGr8 || isSamGr10 ? "Carter" : isMarcus ? PERSONAS.player.lastName : pick(LAST_NAMES)
        const player = await p.player.create({
          data: {
            firstName,
            lastName,
            dateOfBirth: new Date(Date.UTC(info.birthYear, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28))),
            gender: "MALE",
            isMinor: true,
            parentId,
            ...(isMarcus ? { userId: personaPlayer.id, canLogin: true } : {}),
            position: pick(["Guard", "Guard", "Forward", "Forward", "Center"]),
          },
          select: { id: true },
        })
        await p.teamPlayer.create({ data: { teamId: team.id, playerId: player.id, jerseyNumber: 4 + i, status: "ACTIVE" } })
        roster.push(player.id)
        rosterParents.push(parentId)
        if (isSamGr8) samGr8KidId = player.id
        if (isSamGr10) samGr10KidId = player.id
      }

      // One-click league submit -> frozen, locked roster (so standings are
      // derivable exactly the way the app's real query expects).
      const submission = await p.teamSubmission.create({
        data: { seasonId: season.id, divisionId: divisionsByGrade.get(grade)!.id, teamId: team.id, status: "APPROVED", paymentStatus: "PAID_MANUAL" },
        select: { id: true },
      })
      await p.seasonRoster.create({
        data: {
          seasonId: season.id,
          teamSubmissionId: submission.id,
          isLocked: true,
          submittedAt: new Date(SEASON_START.getTime() - days(14)),
          lockedAt: new Date(SEASON_START.getTime() - days(7)),
          players: { create: roster.map((playerId, i) => ({ playerId, jerseyNumber: 4 + i })) },
        },
      })

      teams.push({ id: team.id, name: teamName, tenantId: row.tenantId, clubKey: club.key, grade, roster, rosterParents, coachId: coach.id })
    }
  }
  console.log(`✓ ${teams.length} teams (${ROSTER_SIZE}/roster) — Sam Carter's kids rostered on Northgate Wolves Gr8 + Lakeside Storm Gr10`)

  // ── Regular season: full single round robin per grade ──────────────────
  const rosterOf = new Map(teams.map((t) => [t.id, t.roster]))
  const roundsByGrade = new Map<number, Array<Array<[string, string]>>>()
  for (const grade of GRADES) {
    const ids = teams.filter((t) => t.grade === grade).map((t) => t.id)
    roundsByGrade.set(grade, roundRobin(ids))
  }
  const gradeGames = new Map<number, PlayedGame[]>()
  for (const grade of GRADES) gradeGames.set(grade, [])

  for (let r = 0; r < ROUND_DATES.length; r++) {
    const date = ROUND_DATES[r]
    let daySlot = 0
    for (const grade of GRADES) {
      const pairs = roundsByGrade.get(grade)![r]
      for (const [homeId, awayId] of pairs) {
        const slot = daySlotList[daySlot % daySlotList.length]
        daySlot++
        const scheduledAt = new Date(date)
        scheduledAt.setHours(slot.hour, slot.minute, 0, 0)
        const result = await playGame({
          seasonId: season.id,
          homeTeamId: homeId,
          awayTeamId: awayId,
          homeRoster: rosterOf.get(homeId)!,
          awayRoster: rosterOf.get(awayId)!,
          pace: GRADE_INFO[grade].pace,
          scheduledAt,
          venueId: slot.venueId,
          courtId: slot.courtId,
          phase: "REGULAR",
        })
        gradeGames.get(grade)!.push(result)
      }
    }
  }
  const regularSeasonCount = [...gradeGames.values()].reduce((n, gg) => n + gg.length, 0)
  console.log(`✓ regular season: ${regularSeasonCount} games (single round robin, ${GRADES.length} grades x 28) — all COMPLETED with box scores + stat lines`)

  // ── Playoffs (Gr9 + Gr10): top-4 bracket, semis + final ─────────────────
  interface PlayoffResult {
    championTeamId: string
    championName: string
    semi1GameId: string
    semi1TopPlayerId: string | null
    finalGameId: string
    finalTopPlayerId: string | null
  }
  const playoffResults = new Map<number, PlayoffResult>()
  const semiTemp = new Map<number, { semi1: PlayedGame; semi2: PlayedGame; top4: ReturnType<typeof computeStandingsLocal> }>()

  let semiSlotIdx = 0
  for (const grade of PLAYOFF_GRADES) {
    const standings = computeStandingsLocal(gradeGames.get(grade)!)
    const top4 = standings.slice(0, 4)
    const slotA = daySlotList[semiSlotIdx++]
    const slotB = daySlotList[semiSlotIdx++]
    const dateA = new Date(PLAYOFF_SEMI_DATE)
    dateA.setHours(slotA.hour, slotA.minute, 0, 0)
    const dateB = new Date(PLAYOFF_SEMI_DATE)
    dateB.setHours(slotB.hour, slotB.minute, 0, 0)
    const semi1 = await playGame({
      seasonId: season.id,
      homeTeamId: top4[0].teamId,
      awayTeamId: top4[3].teamId,
      homeRoster: rosterOf.get(top4[0].teamId)!,
      awayRoster: rosterOf.get(top4[3].teamId)!,
      pace: GRADE_INFO[grade].pace,
      scheduledAt: dateA,
      venueId: slotA.venueId,
      courtId: slotA.courtId,
      phase: "PLAYOFF",
      playoffRound: 1,
      playoffSlot: 0,
    })
    const semi2 = await playGame({
      seasonId: season.id,
      homeTeamId: top4[1].teamId,
      awayTeamId: top4[2].teamId,
      homeRoster: rosterOf.get(top4[1].teamId)!,
      awayRoster: rosterOf.get(top4[2].teamId)!,
      pace: GRADE_INFO[grade].pace,
      scheduledAt: dateB,
      venueId: slotB.venueId,
      courtId: slotB.courtId,
      phase: "PLAYOFF",
      playoffRound: 1,
      playoffSlot: 1,
    })
    semiTemp.set(grade, { semi1, semi2, top4 })
  }

  let finalSlotIdx = 0
  for (const grade of PLAYOFF_GRADES) {
    const { semi1, semi2, top4 } = semiTemp.get(grade)!
    const winner1 = semi1.homeScore > semi1.awayScore ? top4[0].teamId : top4[3].teamId
    const winner2 = semi2.homeScore > semi2.awayScore ? top4[1].teamId : top4[2].teamId
    const slot = daySlotList[finalSlotIdx++]
    const dateF = new Date(PLAYOFF_FINAL_DATE)
    dateF.setHours(slot.hour, slot.minute, 0, 0)
    const final = await playGame({
      seasonId: season.id,
      homeTeamId: winner1,
      awayTeamId: winner2,
      homeRoster: rosterOf.get(winner1)!,
      awayRoster: rosterOf.get(winner2)!,
      pace: GRADE_INFO[grade].pace,
      scheduledAt: dateF,
      venueId: slot.venueId,
      courtId: slot.courtId,
      phase: "PLAYOFF",
      playoffRound: 2,
      playoffSlot: 0,
    })
    const championTeamId = final.homeScore > final.awayScore ? winner1 : winner2
    playoffResults.set(grade, {
      championTeamId,
      championName: teams.find((t) => t.id === championTeamId)!.name,
      semi1GameId: semi1.id,
      semi1TopPlayerId: semi1.topPlayerId,
      finalGameId: final.id,
      finalTopPlayerId: final.topPlayerId,
    })
  }
  console.log(
    `✓ playoffs (Gr9 + Gr10): 6 games (4 semis + 2 finals) — champions: Gr9 ${playoffResults.get(9)!.championName}, Gr10 ${playoffResults.get(10)!.championName}`
  )

  // ── Showcase Weekend: live-carousel fixture pool (§3), next Saturday ────
  // IMPORTANT: this pool lives in its OWN Season (not a session inside the
  // completed one). scripts/demo/live-carousel.ts — a driver for this exact
  // pool, being built concurrently — selects candidate games by
  // `season.label contains "showcase"` (case-insensitive) + `league.isDemo`,
  // and its header comment documents why the pool MUST be a separate Season
  // row: standings are computed live from ALL of a season's COMPLETED games,
  // so once the carousel starts finalizing these with real scores, sharing
  // the frozen regular-season Season would corrupt its "final" standings.
  const dow = now.getDay()
  const daysUntilSat = ((6 - dow + 7) % 7) || 7
  const showcaseDate = new Date(now.getTime() + days(daysUntilSat))
  showcaseDate.setHours(0, 0, 0, 0)
  const showcaseSeason = await p.season.create({
    data: {
      leagueId: league.id,
      label: "Showcase Weekend",
      type: "CUSTOM",
      status: "IN_PROGRESS",
      startDate: showcaseDate,
    },
    select: { id: true },
  })
  const showcaseSession = await p.seasonSession.create({
    data: { seasonId: showcaseSeason.id, label: "Showcase Weekend", phase: "REGULAR" },
    select: { id: true },
  })
  interface ShowcasePair {
    grade: number
    homeKey: string
    awayKey: string
    hour: number
    minute: number
  }
  // First pair is Northgate Wolves Gr8 vs Eastfield Eagles — the exact
  // fixture the staged team-chat script (below) references.
  const SHOWCASE_PAIRS: ShowcasePair[] = [
    { grade: 8, homeKey: "wolves", awayKey: "eagles", hour: 9, minute: 40 },
    { grade: 9, homeKey: "storm", awayKey: "hoops", hour: 11, minute: 0 },
    { grade: 10, homeKey: "rise", awayKey: "blues", hour: 12, minute: 30 },
    { grade: 7, homeKey: "select", awayKey: "ironwood", hour: 14, minute: 0 },
    { grade: 8, homeKey: "hoops", awayKey: "rise", hour: 15, minute: 30 },
    { grade: 10, homeKey: "wolves", awayKey: "storm", hour: 17, minute: 0 },
  ]
  let wolvesShowcaseOpponentName = "Eastfield Eagles Grade 8"
  for (let i = 0; i < SHOWCASE_PAIRS.length; i++) {
    const sp = SHOWCASE_PAIRS[i]
    const home = teams.find((t) => t.clubKey === sp.homeKey && t.grade === sp.grade)!
    const away = teams.find((t) => t.clubKey === sp.awayKey && t.grade === sp.grade)!
    const venueCfg = VENUES[i % VENUES.length]
    const venueRow = venueRows.get(venueCfg.name)!
    const courtId = venueRow.courtIds[i % venueRow.courtIds.length]
    const scheduledAt = new Date(showcaseDate)
    scheduledAt.setHours(sp.hour, sp.minute, 0, 0)
    await p.game.create({
      data: {
        seasonId: showcaseSeason.id,
        sessionId: showcaseSession.id,
        phase: "REGULAR",
        homeTeamId: home.id,
        awayTeamId: away.id,
        venueId: venueRow.id,
        courtId,
        scheduledAt,
        duration: GAME_SLOT_MINUTES,
        status: "SCHEDULED",
        publishedAt: now,
      },
    })
    if (sp.homeKey === "wolves" && sp.grade === 8) wolvesShowcaseOpponentName = away.name
  }
  console.log(`✓ Showcase Weekend: ${SHOWCASE_PAIRS.length} SCHEDULED exhibition games on ${showcaseDate.toDateString()} (own Season — carousel-safe)`)

  // ── Feed: recaps (12), Player of the Game (6) ───────────────────────────
  const wolvesGr8 = teams.find((t) => t.clubKey === WOLVES_KEY && t.grade === WOLVES_COACH_GRADE)!

  const recapGameIds: string[] = []
  const potgPicks: Array<{ gameId: string; topPlayerId: string }> = []
  for (const grade of GRADES) {
    const games = gradeGames.get(grade)!
    let pickA = games[0]
    if (grade === WOLVES_COACH_GRADE) {
      const wolvesGame = games.find((g) => g.homeTeamId === wolvesGr8.id || g.awayTeamId === wolvesGr8.id)
      if (wolvesGame) pickA = wolvesGame
    }
    const pickB = games[14] !== pickA ? games[14] : games[13]
    recapGameIds.push(pickA.id, pickB.id)
    const potgCandidate = games[7] !== pickA && games[7] !== pickB ? games[7] : games[20]
    if (potgCandidate?.topPlayerId) potgPicks.push({ gameId: potgCandidate.id, topPlayerId: potgCandidate.topPlayerId })
  }
  for (const grade of PLAYOFF_GRADES) {
    const res = playoffResults.get(grade)!
    recapGameIds.push(res.semi1GameId, res.finalGameId)
    if (res.finalTopPlayerId) potgPicks.push({ gameId: res.finalGameId, topPlayerId: res.finalTopPlayerId })
  }

  let recapCount = 0
  for (const gameId of recapGameIds) {
    const result = await upsertGameRecap(gameId)
    if (!result) continue
    const g = await p.game.findUnique({ where: { id: gameId }, select: { finalizedAt: true } })
    await p.post.update({ where: { id: result.postId }, data: { publishedAt: g?.finalizedAt ?? now } })
    recapCount++
  }

  let potgCount = 0
  for (const pickResult of potgPicks) {
    const g = await p.game.findUnique({
      where: { id: pickResult.gameId },
      select: {
        homeScore: true, awayScore: true, finalizedAt: true, homeTeamId: true, awayTeamId: true,
        homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } },
      },
    })
    if (!g) continue
    const player = await p.player.findUnique({ where: { id: pickResult.topPlayerId }, select: { firstName: true, lastName: true } })
    if (!player) continue
    await p.game.update({ where: { id: pickResult.gameId }, data: { potgPlayerId: pickResult.topPlayerId } })
    await p.post.create({
      data: {
        kind: "PLAYER_OF_GAME",
        title: `Final: ${g.homeTeam.name} ${g.homeScore}–${g.awayScore} ${g.awayTeam.name}`,
        slug: `mcl-potg-${pickResult.gameId}`,
        body: `Player of the Game: ${player.firstName} ${player.lastName}.`,
        status: "PUBLISHED",
        publishedAt: g.finalizedAt ?? now,
        visibility: "PUBLIC",
        tags: { create: [{ gameId: pickResult.gameId }, { teamId: g.homeTeamId }, { teamId: g.awayTeamId }] },
      },
    })
    potgCount++
  }
  console.log(`✓ feed: ${recapCount} recap posts, ${potgCount} Player of the Game posts`)

  // ── Club announcements (3) ──────────────────────────────────────────────
  const announcements: Array<{ clubKey: string; title: string; content: string; daysAgo: number }> = [
    {
      clubKey: STORM_KEY,
      title: "2026-27 tryouts are open",
      content: "We're evaluating for next season across Grades 7-10 — sign up on our tryout listing. Returning players get priority scheduling.",
      daysAgo: 2,
    },
    {
      clubKey: WOLVES_KEY,
      title: "New training block starts this month",
      content: "Skill-focused practices twice a week through the fall. Full schedule on the team calendar — see your coach with questions.",
      daysAgo: 4,
    },
    {
      clubKey: "hoops",
      title: "Club photo day booked for next month",
      content: "Team and individual photos for every squad. Order forms are coming home with players this week.",
      daysAgo: 6,
    },
  ]
  for (const a of announcements) {
    const row = clubRows.get(a.clubKey)!
    await p.announcement.create({
      data: {
        tenantId: row.tenantId,
        authorId: row.ownerId,
        title: a.title,
        content: a.content,
        isPublic: true,
        createdAt: new Date(now.getTime() - days(a.daysAgo)),
      },
    })
  }
  console.log(`✓ ${announcements.length} club announcements`)

  // ── League news articles (2) ────────────────────────────────────────────
  await p.post.create({
    data: {
      kind: "ARTICLE",
      title: "Season preview: Maple Court League tips off",
      slug: "mcl-season-preview",
      body: `Eight clubs, four grade divisions, one round robin — the ${SEASON_LABEL} Maple Court League season is here. Every game is live-scored with full stats, standings and recaps all season long, and Grade 9 + Grade 10 close with a top-4 playoff bracket.`,
      status: "PUBLISHED",
      publishedAt: new Date(SEASON_START.getTime() - days(2)),
      authorId: personaLeague.id,
      visibility: "PUBLIC",
      tags: { create: [{ leagueId: league.id }] },
    },
  })
  const champ9 = playoffResults.get(9)!.championName
  const champ10 = playoffResults.get(10)!.championName
  await p.post.create({
    data: {
      kind: "ARTICLE",
      title: "Championship wrap: two champions crowned",
      slug: "mcl-championship-wrap",
      body: `${champ9} claimed the Grade 9 title and ${champ10} took Grade 10 as the ${SEASON_LABEL} season wrapped up championship weekend. Congratulations to both squads on a hard-fought finish — full brackets and recaps are up now.`,
      status: "PUBLISHED",
      publishedAt: new Date(PLAYOFF_FINAL_DATE.getTime() + days(1)),
      authorId: personaLeague.id,
      visibility: "PUBLIC",
      tags: { create: [{ leagueId: league.id }] },
    },
  })
  console.log("✓ 2 league news articles (season preview + championship wrap)")

  // ── Lakeside Storm: open tryout + ~8 signups + Sam's pending offer ──────
  const stormRow = clubRows.get(STORM_KEY)!
  const stormGr10 = teams.find((t) => t.clubKey === STORM_KEY && t.grade === 10)!
  const stormTemplates = [
    await p.offerTemplate.create({
      data: { tenantId: stormRow.tenantId, name: "New Player", seasonFee: OFFER_PRICING.newPlayerFee, installments: OFFER_PRICING.installments, includesUniform: true, isActive: true },
      select: { id: true, seasonFee: true, installments: true },
    }),
    await p.offerTemplate.create({
      data: { tenantId: stormRow.tenantId, name: "Returning Player", seasonFee: OFFER_PRICING.returningFee, installments: OFFER_PRICING.installments, includesUniform: true, isActive: true },
      select: { id: true, seasonFee: true, installments: true },
    }),
  ]
  const tryoutAt = new Date(now.getTime() + days(6))
  tryoutAt.setHours(18, 0, 0, 0)
  const stormTryout = await p.tryout.create({
    data: {
      tenantId: stormRow.tenantId,
      teamId: null,
      title: "Lakeside Storm Tryouts — 2026-27 Season",
      description: "Open evaluation for our upcoming season across Grades 7-10. All players welcome.",
      ageGroup: "Grade 7-10",
      gender: "MALE",
      location: "The Yard",
      scheduledAt: tryoutAt,
      duration: 120,
      fee: 0,
      maxParticipants: 30,
      isPublished: true,
      isPublic: true,
    },
    select: { id: true },
  })

  // Signup 0: Sam's Gr10 kid, re-signing up — OFFERED + the PENDING offer.
  const samSignup = await p.tryoutSignup.create({
    data: {
      tryoutId: stormTryout.id,
      userId: personaParent.id,
      playerId: samGr10KidId,
      playerName: `${SAM_GR10_KID.firstName} ${SAM_GR10_KID.lastName}`,
      playerAge: GRADE_INFO[10].age,
      playerGender: "MALE",
      status: "OFFERED",
      createdAt: new Date(now.getTime() - days(3)),
    },
    select: { id: true },
  })
  const returningTemplate = stormTemplates[1]
  await p.offer.create({
    data: {
      teamId: stormGr10.id,
      playerId: samGr10KidId,
      tryoutSignupId: samSignup.id,
      templateId: returningTemplate.id,
      status: "PENDING",
      seasonFee: Number(returningTemplate.seasonFee),
      installments: returningTemplate.installments,
      practiceSessions: 0,
      includesUniform: true,
      message: `Welcome back for next season — we'd love to have ${SAM_GR10_KID.firstName} on the Grade 10 squad again.`,
      expiresAt: new Date(now.getTime() + days(10)),
      createdAt: new Date(now.getTime() - days(2)),
    },
  })

  // 7 more fictional signups (no offers yet — tryout is still open).
  const signupGrades = [7, 8, 9, 10, 7, 8, 9]
  for (let i = 0; i < signupGrades.length; i++) {
    const grade = signupGrades[i]
    const info = GRADE_INFO[grade]
    const parent = await mkUser(`${MCL_PREFIX}tryout-storm-${i}@${EMAIL_DOMAIN}`, pick(ADULT_NAMES), pick(LAST_NAMES))
    await p.userRole.create({ data: { userId: parent.id, role: "Parent" } })
    const firstName = pick(BOY_NAMES)
    const lastName = pick(LAST_NAMES)
    const player = await p.player.create({
      data: {
        firstName,
        lastName,
        dateOfBirth: new Date(Date.UTC(info.birthYear, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28))),
        gender: "MALE",
        isMinor: true,
        parentId: parent.id,
        position: pick(["Guard", "Forward", "Center"]),
      },
      select: { id: true },
    })
    await p.tryoutSignup.create({
      data: {
        tryoutId: stormTryout.id,
        userId: parent.id,
        playerId: player.id,
        playerName: `${firstName} ${lastName}`,
        playerAge: info.age,
        playerGender: "MALE",
        status: i < 3 ? "CONFIRMED" : "PENDING",
        createdAt: new Date(now.getTime() - days(1 + i)),
      },
    })
  }
  console.log(`✓ Lakeside Storm: open tryout, ${signupGrades.length + 1} signups (Sam Carter's Elijah has the PENDING offer)`)

  // ── Team chat (5 staged messages, spec §6) — Northgate Wolves Gr8 ──────
  const chatFictionalParentId = wolvesGr8.rosterParents.find((id) => id !== personaParent.id)!
  const chatScript: Array<{ senderId: string; body: string; offsetDays: number }> = [
    { senderId: personaCoach.id, body: "Practice moved to Tuesday 6:30 at The Yard, court 4. Calendar's updated.", offsetDays: -5 },
    { senderId: chatFictionalParentId, body: "Thanks coach, we'll be there.", offsetDays: -4.8 },
    { senderId: personaCoach.id, body: `Saturday game is 9:40am vs ${wolvesShowcaseOpponentName}. RSVP on the event so I can set the lineup.`, offsetDays: -2 },
    // Approximates the spec's "system card: game reminder with RSVP buttons"
    // — no dedicated system-message type exists in TeamMessage yet, so this
    // is a plain coach reminder instead (see final report for this gap).
    { senderId: personaCoach.id, body: "Reminder: doors open 9:00 for the 9:40 tip — still need RSVPs from a couple of families.", offsetDays: -1 },
    { senderId: personaCoach.id, body: "Recap from last week is up — proud of this group.", offsetDays: -0.15 },
  ]
  for (const m of chatScript) {
    await p.teamMessage.create({
      data: { teamId: wolvesGr8.id, senderId: m.senderId, body: m.body, createdAt: new Date(now.getTime() + days(m.offsetDays)) },
    })
  }
  console.log(`✓ ${chatScript.length} staged chat messages on Northgate Wolves Gr8 (Coach Dre's team)`)

  return {
    clubs: CLUBS.length,
    teams: teams.length,
    regularSeasonGames: regularSeasonCount,
    playoffGames: 6,
    showcaseGames: SHOWCASE_PAIRS.length,
    recapPosts: recapCount,
    potgPosts: potgCount,
    announcements: announcements.length,
    articles: 2,
    personas: 4,
    champion9: champ9,
    champion10: champ10,
  }
}

function printSummary(result: Awaited<ReturnType<typeof seed>>) {
  const lines = [
    "",
    "═".repeat(70),
    " MAPLE COURT LEAGUE DEMO WORLD — LOGINS (password for ALL: " + PASSWORD + ")",
    "═".repeat(70),
    ` persona-parent@${EMAIL_DOMAIN}   ⭐ Sam Carter — 2 kids, offer waiting`,
    ` persona-coach@${EMAIL_DOMAIN}    ⭐ Dre Wilson — Northgate Wolves Gr8 HeadCoach`,
    ` persona-club@${EMAIL_DOMAIN}     ⭐ Jordan Blake — Lakeside Storm ClubOwner`,
    ` persona-player@${EMAIL_DOMAIN}   ⭐ Marcus Reid — Gr10 player, Summit Select\n persona-league@${EMAIL_DOMAIN}   ⭐ Alex Morgan — Maple Court League LeagueOwner`,
    "─".repeat(70),
    ` Clubs: ${result.clubs}  ·  Teams: ${result.teams}  ·  Personas: ${result.personas}`,
    ` Regular season: ${result.regularSeasonGames} games (COMPLETED)  ·  Playoffs: ${result.playoffGames} games`,
    ` Showcase Weekend: ${result.showcaseGames} SCHEDULED exhibition games`,
    ` Feed: ${result.recapPosts} recaps, ${result.potgPosts} Player of the Game, ${result.announcements} club announcements, ${result.articles} league articles`,
    ` Champions: Gr9 ${result.champion9} · Gr10 ${result.champion10}`,
    "═".repeat(70),
  ]
  console.log(lines.join("\n"))
}

async function main() {
  const args = process.argv.slice(2)
  await guardProd(args)

  console.log("— MAPLE COURT LEAGUE DEMO WORLD SEEDER — (docs/demo-world-spec-2026-08.md)")
  await wipeWorld()
  if (args.includes("--wipe")) return

  const t0 = Date.now()
  const result = await seed()
  console.log(`\n✓ world built in ${Math.round((Date.now() - t0) / 1000)}s`)
  printSummary(result)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect().catch(() => {})
  })
