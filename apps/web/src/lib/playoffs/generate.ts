import { prisma } from "@youthbasketballhub/db"
import { getSeasonStandings } from "@/lib/queries/standings"
import {
  buildPlan,
  playoffOptionsFor,
  type Matchup,
  type PlayoffFormatKey,
  type PlayoffPlan,
  type Slot,
} from "./formats"

/**
 * Playoff generation + advancement (owner 2026-07-18). Round-1 games are
 * created immediately; later rounds materialize via advancePlayoffs() as
 * results arrive, because Game.home/awayTeamId are required columns — a
 * "winner of semifinal 1" placeholder row can't exist. The full bracket
 * intent lives in SeasonSession.playoffPlan.
 */

export interface StoredPlan extends PlayoffPlan {
  divisionId: string
  divisionName: string
  /** rank order from final regular-season standings; index 0 = #1 seed */
  seeds: Array<{ seed: number; teamId: string; name: string }>
  startDateISO: string
  /** days between rounds (default 7 — weekly playoff rounds) */
  roundSpacingDays: number
}

const HOUR = 3600_000
const DAY = 24 * HOUR

/** Round r, slot s → a concrete tip-off time. Rounds are spaced weekly;
 * games within a round go in hourly slots from 10:00 local. Leagues fix the
 * real times afterwards on the Schedule tab — this just avoids collisions. */
function slotTime(plan: StoredPlan, round: number, slot: number): Date {
  const base = new Date(plan.startDateISO)
  base.setHours(10, 0, 0, 0)
  return new Date(base.getTime() + (round - 1) * plan.roundSpacingDays * DAY + (slot % 12) * HOUR)
}

function resolveSlot(
  slot: Slot,
  plan: StoredPlan,
  results: Map<string, { winnerId: string; loserId: string }>
): string | null {
  if ("seed" in slot) return plan.seeds.find((s) => s.seed === slot.seed)?.teamId ?? null
  if ("teamId" in (slot as any)) return (slot as any).teamId
  const [r, s] = "winnerOf" in slot ? slot.winnerOf : slot.loserOf
  const res = results.get(`${r}:${s}`)
  if (!res) return null
  return "winnerOf" in slot ? res.winnerId : res.loserId
}

export async function generatePlayoffs(input: {
  seasonId: string
  divisionId: string
  qualifying: number
  format: PlayoffFormatKey
  startDate: string
}): Promise<
  | { ok: true; sessionId: string; gamesCreated: number; label: string }
  | { ok: false; error: string; code: string }
> {
  const standings = await getSeasonStandings(input.seasonId)
  if (!standings) return { ok: false, error: "Season not found", code: "NOT_FOUND" }
  const division = standings.divisions.find((d) => d.divisionId === input.divisionId)
  if (!division) return { ok: false, error: "Division not found", code: "NOT_FOUND" }

  const teamCount = division.rows.length
  const option = playoffOptionsFor(teamCount, input.qualifying).find(
    (o) => o.key === input.format
  )
  if (!option) {
    return {
      ok: false,
      error: `${input.format} is not offered for ${input.qualifying} qualifying teams`,
      code: "INVALID_FORMAT",
    }
  }

  // One playoff bracket per division per season
  const existing = await (prisma as any).seasonSession.findFirst({
    where: {
      seasonId: input.seasonId,
      phase: "PLAYOFF",
      playoffPlan: { path: ["divisionId"], equals: input.divisionId },
    },
    select: { id: true },
  })
  if (existing) {
    return {
      ok: false,
      error: "This division already has a playoff bracket — delete it first to regenerate",
      code: "ALREADY_EXISTS",
    }
  }

  const plan: StoredPlan = {
    ...buildPlan(input.format, input.qualifying),
    divisionId: division.divisionId,
    divisionName: division.divisionName,
    seeds: division.rows
      .slice(0, input.qualifying)
      .map((row, i) => ({ seed: i + 1, teamId: row.teamId, name: row.name })),
    startDateISO: new Date(input.startDate).toISOString(),
    roundSpacingDays: 7,
  }

  const round1 = plan.matchups.filter((m) => m.round === 1)
  const label = `Playoffs — ${division.divisionName}`

  const session = await (prisma as any).$transaction(async (tx: any) => {
    const created = await tx.seasonSession.create({
      data: {
        seasonId: input.seasonId,
        label,
        phase: "PLAYOFF",
        playoffPlan: plan as any,
      },
    })
    for (const m of round1) {
      const homeId = resolveSlot(m.home, plan, new Map())
      const awayId = resolveSlot(m.away, plan, new Map())
      if (!homeId || !awayId) throw new Error(`Round-1 matchup ${m.label} did not resolve`)
      await tx.game.create({
        data: {
          seasonId: input.seasonId,
          sessionId: created.id,
          phase: "PLAYOFF",
          homeTeamId: homeId, // higher seed hosts (bracketPairs puts it first)
          awayTeamId: awayId,
          scheduledAt: slotTime(plan, 1, m.round === 1 ? round1.indexOf(m) : m.slot),
          playoffRound: m.round,
          playoffSlot: m.slot,
        },
      })
    }
    return created
  })

  return { ok: true, sessionId: session.id, gamesCreated: round1.length, label }
}

/** Delete a playoff bracket — only while nothing has been played. */
export async function deletePlayoffs(
  sessionId: string
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const played = await (prisma as any).game.count({
    where: { sessionId, status: { in: ["LIVE", "COMPLETED"] } },
  })
  if (played > 0) {
    return {
      ok: false,
      error: "Games in this bracket have already been played",
      code: "HAS_RESULTS",
    }
  }
  await (prisma as any).$transaction(async (tx: any) => {
    await tx.game.deleteMany({ where: { sessionId } })
    await tx.seasonSession.delete({ where: { id: sessionId } })
  })
  return { ok: true }
}

/**
 * Called after a game reaches COMPLETED. If it was a playoff game, create
 * every next-round game whose participants are now known. Idempotent — safe
 * on re-finalize. Never throws (best-effort hook off the finalize whistle).
 */
export async function advancePlayoffs(gameId: string): Promise<{ created: number }> {
  try {
    const game = await (prisma as any).game.findUnique({
      where: { id: gameId },
      select: {
        sessionId: true,
        phase: true,
        session: { select: { id: true, phase: true, playoffPlan: true } },
      },
    })
    if (!game?.session || game.session.phase !== "PLAYOFF" || !game.session.playoffPlan) {
      return { created: 0 }
    }
    const plan = game.session.playoffPlan as unknown as StoredPlan

    const games = await (prisma as any).game.findMany({
      where: { sessionId: game.session.id },
      select: {
        playoffRound: true,
        playoffSlot: true,
        status: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
      },
    })
    const existingKeys = new Set(
      games.map((g: any) => `${g.playoffRound}:${g.playoffSlot}`)
    )
    const results = new Map<string, { winnerId: string; loserId: string }>()
    for (const g of games) {
      if (g.status !== "COMPLETED" || g.homeScore == null || g.awayScore == null) continue
      if (g.homeScore === g.awayScore) continue // ties can't advance a bracket
      const homeWon = g.homeScore > g.awayScore
      results.set(`${g.playoffRound}:${g.playoffSlot}`, {
        winnerId: homeWon ? g.homeTeamId : g.awayTeamId,
        loserId: homeWon ? g.awayTeamId : g.homeTeamId,
      })
    }

    let matchups: Matchup[] = plan.matchups
    // Pools: once every pool game is done, extend the plan with the
    // crossover bracket built from pool tables (A1 vs B2, B1 vs A2, …).
    if (plan.format === "POOLS_CROSSOVER" && !plan.matchups.some((m) => m.round === 2)) {
      const poolGames = games.filter((g: any) => g.playoffRound === 1)
      const allDone = poolGames.every((g: any) => g.status === "COMPLETED")
      if (allDone && poolGames.length > 0) {
        matchups = [...plan.matchups, ...crossoverMatchups(plan, games)]
        await (prisma as any).seasonSession.update({
          where: { id: game.session.id },
          data: { playoffPlan: { ...plan, matchups } as any },
        })
      }
    }

    let created = 0
    for (const m of matchups) {
      if (m.round === 1) continue
      if (existingKeys.has(`${m.round}:${m.slot}`)) continue
      const homeId = resolveSlot(m.home, plan, results)
      const awayId = resolveSlot(m.away, plan, results)
      if (!homeId || !awayId) continue
      await (prisma as any).game.create({
        data: {
          seasonId: (await seasonIdOf(game.session.id))!,
          sessionId: game.session.id,
          phase: "PLAYOFF",
          homeTeamId: homeId,
          awayTeamId: awayId,
          scheduledAt: slotTime(plan, m.round, m.slot),
          playoffRound: m.round,
          playoffSlot: m.slot,
        },
      })
      existingKeys.add(`${m.round}:${m.slot}`)
      created++
    }
    return { created }
  } catch (err) {
    console.error("advancePlayoffs failed:", err)
    return { created: 0 }
  }
}

async function seasonIdOf(sessionId: string): Promise<string | null> {
  const s = await (prisma as any).seasonSession.findUnique({
    where: { id: sessionId },
    select: { seasonId: true },
  })
  return s?.seasonId ?? null
}

/** Pool tables → crossover bracket. Pools are paired (A,B), (C,D)…; each
 * pair contributes A1vB2 and B1vA2. Winners meet via normal winnerOf refs. */
function crossoverMatchups(plan: StoredPlan, games: any[]): Matchup[] {
  const pools = [...new Set(plan.matchups.filter((m) => m.pool).map((m) => m.pool!))].sort()
  const ranked = new Map<string, string[]>() // pool → teamIds best-first
  for (const pool of pools) {
    const poolTeamIds = new Set<string>()
    for (const m of plan.matchups.filter((x) => x.pool === pool)) {
      const h = resolveSlot(m.home, plan, new Map())
      const a = resolveSlot(m.away, plan, new Map())
      if (h) poolTeamIds.add(h)
      if (a) poolTeamIds.add(a)
    }
    const table = new Map<string, { w: number; diff: number; pf: number }>()
    for (const id of poolTeamIds) table.set(id, { w: 0, diff: 0, pf: 0 })
    for (const g of games) {
      if (g.playoffRound !== 1 || g.status !== "COMPLETED") continue
      if (!poolTeamIds.has(g.homeTeamId) || !poolTeamIds.has(g.awayTeamId)) continue
      const home = table.get(g.homeTeamId)!
      const away = table.get(g.awayTeamId)!
      home.diff += g.homeScore - g.awayScore
      away.diff += g.awayScore - g.homeScore
      home.pf += g.homeScore
      away.pf += g.awayScore
      if (g.homeScore > g.awayScore) home.w++
      else if (g.awayScore > g.homeScore) away.w++
    }
    ranked.set(
      pool,
      [...poolTeamIds].sort((a, b) => {
        const A = table.get(a)!
        const B = table.get(b)!
        return B.w - A.w || B.diff - A.diff || B.pf - A.pf
      })
    )
  }

  // Entrants in bracket order: A1, B2, B1, A2, C1, D2, D1, C2 …
  const entrants: Array<{ teamId: string }> = []
  for (let i = 0; i < pools.length; i += 2) {
    const p1 = ranked.get(pools[i])!
    const p2 = ranked.get(pools[i + 1])!
    entrants.push({ teamId: p1[0] }, { teamId: p2[1] })
    entrants.push({ teamId: p2[0] }, { teamId: p1[1] })
  }

  const out: Matchup[] = []
  let current: Slot[] = entrants as unknown as Slot[]
  let round = 2
  while (current.length > 1) {
    const next: Slot[] = []
    for (let i = 0; i < current.length; i += 2) {
      const slot = i / 2
      out.push({
        round,
        slot,
        home: current[i],
        away: current[i + 1],
        label:
          current.length === 2
            ? "Final"
            : current.length === 4
              ? `Semifinal ${slot + 1}`
              : `Crossover — Game ${slot + 1}`,
      })
      next.push({ winnerOf: [round, slot] })
    }
    current = next
    round++
  }
  return out
}
