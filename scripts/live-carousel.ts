/**
 * Always-live demo carousel driver (limited-launch demo, Phase 2d).
 *
 *   docs/roadmap/limited-launch-demo-build-2026-08.md §5 "Live game carousel"
 *   docs/demo-world-spec-2026-08.md §3 "The live game carousel (the centerpiece)"
 *
 * Keeps up to 3 exhibition games LIVE at once, staggered at different points
 * in the game (one early, one mid, one in crunch time), scoring each one
 * event-by-event through the REAL scoring pipeline (same GameEvent stream +
 * fold engine the scoring console and public /live page use), finalizing
 * through the real finalize pipeline (score + PlayerStat + recap + POTG),
 * then — after a cooldown — starting the next fixture in an empty slot.
 *
 *   npx tsx scripts/live-carousel.ts --tick     one pass over up to 3 slots
 *   npx tsx scripts/live-carousel.ts --loop     tick every ~30s forever (Ctrl+C to stop)
 *   npx tsx scripts/live-carousel.ts --reset    return every carousel game to SCHEDULED
 *
 * Options (all optional): --seed=N  --interval=<ms> (loop only, default 30000)
 * --slots=1-3 (default 3)  --cooldown=<ms> (default 300000 = 5min)
 * --label=<text> --league=<id>  (see "POOL SELECTION" below)
 *
 * ============================================================================
 * ASSUMPTION — documented per the build task, please read before relying on
 * this (no seed-demo-world.ts / spec-driven seeder exists yet as of writing;
 * docs/demo-world-spec-2026-08.md is still "DRAFT FOR OWNER MARKUP" and item
 * #7 in its build list — "spec-driven seeder" — is unbuilt):
 *
 * POOL SELECTION: a candidate game is one whose Season belongs to a League
 * with isDemo=true (the same derivation `lib/demo/demo-mode.ts#isDemoGame`
 * uses — reused here directly, not re-implemented) AND whose Season.label
 * contains "showcase" (case-insensitive). Override the label text with
 * --label=, or narrow to one league with --league=<leagueId>. If the future
 * seeder names its showcase season something else, either rename it to
 * match or pass --label= at call time — no code change needed.
 *
 * STANDINGS SAFETY: the world spec says these exhibition games must NOT
 * touch the frozen "final" season standings (§3: "these games do not touch
 * the frozen standings — exhibition flag"). There is no isExhibition column
 * on Game yet, and standings are computed LIVE from a season's COMPLETED
 * games (lib/standings/compute.ts) — so the only safe way to honor that
 * promise with today's schema is structural: the showcase pool MUST live in
 * its OWN Season row, separate from the Season(s) that hold the completed
 * regular-season/playoff standings. This driver does not create the pool —
 * it only ever touches games already in it — so this is a REQUIREMENT ON
 * THE FUTURE SEEDER, not something this file enforces. Documenting it here
 * because it's exactly the kind of thing that's easy to get wrong once and
 * silently corrupt a "frozen" demo world.
 *
 * WHAT'S CALLED FOR REAL vs SKIPPED, and why:
 *  - foldEvents/totalRebounds (lib/scoring/fold) — the same pure fold engine
 *    the finalize API uses. Verified callable.
 *  - upsertGameRecap (lib/content/recap-service) — confirmed callable
 *    server-side (its own header comment: "Relative imports … so root-level
 *    scripts (backfill-recaps) can import this service through plain tsx").
 *    Falls back to a template recap when ANTHROPIC_API_KEY is unset
 *    (recap-claude.ts returns null), so it always produces a post either way.
 *  - detectAndPublishMilestones / detectAndPublishStandingsMovement — same
 *    best-effort, gameId-scoped functions the finalize route calls; wrapped
 *    in try/catch exactly like that route. Standings-movement only touches
 *    the showcase season's own (empty/rolling) mini-standings per the
 *    STANDINGS SAFETY note above, never the frozen one.
 *  - advancePlayoffs — SKIPPED. These are exhibition fixtures with no
 *    playoffRound/playoffSlot; there is no bracket to advance.
 *  - Referee sign-off, club-manager scoresheet email, full-audience bell —
 *    SKIPPED. The real finalize route sends these because a real game
 *    finalizes once. This carousel finalizes the same handful of fixtures
 *    every ~25-30 minutes, forever, on a schedule with no human at the
 *    table — repeat-emailing/re-belling real inboxes for a perpetually
 *    recycling fictional game would be spam, not a demo feature.
 *  - PlatformSettings — never written. Only read via isDemoModeEnabled() to
 *    decide whether --tick/--loop should do anything (the kill switch);
 *    --reset ignores it since that's an explicit operator cleanup action.
 *
 * STATE: derived from the DB every tick, no state file. "Slots" are not a
 * stored concept — they fall out of the invariant this driver itself
 * maintains (never more than --slots games LIVE at once in the pool), so
 * "the current LIVE games in the pool" ARE the slots.
 *
 * NOT RUN / NOT VERIFIED: written and read-through only, per the build
 * instructions. No DB access was performed while writing this file.
 */

import { prisma } from "@youthbasketballhub/db"
import { foldEvents, totalRebounds, type FoldEvent, type PlayerLine } from "../apps/web/src/lib/scoring/fold"
import { upsertGameRecap } from "../apps/web/src/lib/content/recap-service"
// demo-mode, realtime, milestones and standings-movement load lazily:
// their combined import chains trip tsx's ESM instantiation from a plain
// script (binding-order cycle), and every one of them is either a guard we
// can re-derive or best-effort garnish that must stay non-fatal.
const demoModePromise = import("../apps/web/src/lib/demo/demo-mode")
const realtimePromise = import("../apps/web/src/lib/realtime/publish").catch(() => null)

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_SEED = 8080
const DEFAULT_INTERVAL_MS = 30_000
const DEFAULT_SLOTS = 3
const DEFAULT_COOLDOWN_MS = 5 * 60_000
const DEFAULT_LABEL_PATTERN = "showcase"

/** Quarter length in the simulated clock (display/plausibility only). */
const PERIOD_SECONDS = 600
const FINAL_PERIOD = 4
/** Midpoint of the "~50-60 events" target from the build spec. */
const TARGET_EVENT_COUNT = 56
/** Early 1st / mid 3rd / crunch-time 4th — matches the world spec's wording. */
const STAGGER_FRACTIONS = [0.12, 0.5, 0.85]

type GameEventType =
  | "SCORE_2PT"
  | "SCORE_3PT"
  | "SCORE_FT"
  | "REBOUND"
  | "ASSIST"
  | "STEAL"
  | "BLOCK"
  | "TURNOVER"
  | "FOUL"
  | "TIMEOUT"
  | "SUBSTITUTION"
  | "LINEUP"
  | "ATTENDANCE"
  | "PERIOD_START"
  | "PERIOD_END"
  | "CLOCK_START"
  | "CLOCK_STOP"

const SHOT_POINTS: Partial<Record<GameEventType, number>> = {
  SCORE_2PT: 2,
  SCORE_3PT: 3,
  SCORE_FT: 1,
}

/** Weighted play mix for a "normal" possession event (sums to 100). */
const PLAY_WEIGHTS: Array<[GameEventType, number]> = [
  ["SCORE_2PT", 32],
  ["SCORE_3PT", 11],
  ["SCORE_FT", 13],
  ["REBOUND", 15],
  ["ASSIST", 8],
  ["TURNOVER", 7],
  ["STEAL", 5],
  ["BLOCK", 3],
  ["FOUL", 6],
]

// ---------------------------------------------------------------------------
// Deterministic RNG — seeded per (seed, gameId, namespace, index) so a rerun
// of the same game at the same position always produces the same output,
// and the only way to reshuffle everything is to pass a different --seed.
// No cross-tick state is needed: the "index" is just how many events already
// exist for the game, read fresh from the DB every tick.
// ---------------------------------------------------------------------------

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rngFor(seed: number, gameId: string, ns: string, index: number): () => number {
  return mulberry32(hashStr(`${seed}:${gameId}:${ns}:${index}`))
}

function weightedPick<T>(rng: () => number, items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let r = rng() * total
  for (const [item, w] of items) {
    if (r < w) return item
    r -= w
  }
  return items[items.length - 1][0]
}

/** First 3 roster slots get 2x weight ("starters") — arbitrary but stable. */
function pickPlayer(rng: () => number, roster: string[]): string | null {
  if (roster.length === 0) return null
  const weighted: Array<[string, number]> = roster.map((id, idx) => [id, idx < 3 ? 2 : 1])
  return weightedPick(rng, weighted)
}

/** Nudges make-probability so blowouts self-correct toward the 3-20 margin
 * the build spec asks for, without hard-coding a result. */
function adjustedMakeProb(
  type: GameEventType,
  teamId: string,
  homeTeamId: string,
  homeScore: number,
  awayScore: number
): number {
  const base = type === "SCORE_3PT" ? 0.34 : type === "SCORE_FT" ? 0.72 : 0.47
  const diff = teamId === homeTeamId ? homeScore - awayScore : awayScore - homeScore
  if (diff <= -12) return Math.min(0.85, base + 0.08)
  if (diff >= 15) return Math.max(0.2, base - 0.05)
  return base
}

function otherTeam(game: { homeTeamId: string; awayTeamId: string }, teamId: string): string {
  return teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId
}

function rosterFor(
  game: { homeTeamId: string; awayTeamId: string },
  teamId: string,
  homeRoster: string[],
  awayRoster: string[]
): string[] {
  return teamId === game.homeTeamId ? homeRoster : awayRoster
}

// ---------------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------------

interface PoolGame {
  id: string
  status: string
  homeTeamId: string
  awayTeamId: string
  finalizedAt: Date | null
  leagueId: string | null
}

/** SCHEDULED/LIVE/COMPLETED games in the showcase pool — see POOL SELECTION
 * in the header comment. Re-checks the isDemo derivation in-process (defense
 * in depth) even though the where-clause already enforces it. */
async function loadPool(labelPattern: string, leagueId?: string): Promise<PoolGame[]> {
  const games = await (prisma as any).game.findMany({
    where: {
      status: { in: ["SCHEDULED", "LIVE", "COMPLETED"] },
      season: {
        label: { contains: labelPattern, mode: "insensitive" },
        league: { isDemo: true, ...(leagueId ? { id: leagueId } : {}) },
      },
    },
    select: {
      id: true,
      status: true,
      homeTeamId: true,
      awayTeamId: true,
      finalizedAt: true,
      season: { select: { leagueId: true, league: { select: { isDemo: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
  })

  return games
    .filter((g: any) => g.season?.league?.isDemo === true)
    .map(
      (g: any): PoolGame => ({
        id: g.id,
        status: g.status,
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        finalizedAt: g.finalizedAt,
        leagueId: g.season?.leagueId ?? null,
      })
    )
}

async function loadRoster(teamId: string): Promise<string[]> {
  const rows = await (prisma as any).teamPlayer.findMany({
    where: { teamId, status: "ACTIVE" },
    select: { playerId: true },
  })
  return rows.map((r: any) => r.playerId as string)
}

async function countEvents(gameId: string): Promise<number> {
  return (prisma as any).gameEvent.count({ where: { gameId, voided: false } })
}

// ---------------------------------------------------------------------------
// Advance a game: append events (either a normal 1-3 tick, or "catch up to
// event count N" for staggering a freshly-started fixture), flip
// SCHEDULED→LIVE on the very first write, finalize when the sim reaches
// its target/4th-quarter end.
// ---------------------------------------------------------------------------

type AdvanceMode = { kind: "tick" } | { kind: "reach"; targetCount: number }

interface EventDraft {
  eventType: GameEventType
  teamId: string | null
  playerId: string | null
  made: boolean | null
  period: number
  clockSeconds: number
  metadata?: Record<string, unknown>
}

async function advanceGame(
  game: { id: string; homeTeamId: string; awayTeamId: string; leagueId: string | null },
  opts: { seed: number; mode: AdvanceMode }
): Promise<{ finalized: boolean }> {
  if (!(await (await demoModePromise).isDemoGame(game.id))) {
    console.warn(`[carousel] refusing to touch non-demo game ${game.id} (guard rail)`)
    return { finalized: false }
  }

  const rows = await (prisma as any).gameEvent.findMany({
    where: { gameId: game.id },
    orderBy: { sequence: "asc" },
    select: { eventType: true, teamId: true, made: true, period: true, clockSeconds: true, sequence: true, voided: true },
  })
  const nonVoided = rows.filter((r: any) => !r.voided)
  const last = nonVoided[nonVoided.length - 1]
  let period: number = last?.period ?? 1
  let clockSeconds: number = last?.clockSeconds ?? PERIOD_SECONDS
  // Whether the period is still in progress vs already closed (last thing
  // recorded was a PERIOD_END, waiting on the next tip-off). Tracked
  // explicitly rather than inferred from clockSeconds===0, because "clock
  // just hit zero, need a PERIOD_END" and "PERIOD_END already recorded,
  // need the next PERIOD_START" are different states that both otherwise
  // look like "clockSeconds is 0".
  let periodOpen: boolean = !!last && last.eventType !== "PERIOD_END"
  const seq: number = last?.sequence ?? 0

  let homeScore = 0
  let awayScore = 0
  for (const r of nonVoided) {
    if (r.made === true) {
      const pts = SHOT_POINTS[r.eventType as GameEventType] ?? 0
      if (r.teamId === game.homeTeamId) homeScore += pts
      else if (r.teamId === game.awayTeamId) awayScore += pts
    }
  }

  const [homeRoster, awayRoster] = await Promise.all([loadRoster(game.homeTeamId), loadRoster(game.awayTeamId)])

  const startIndex = nonVoided.length
  const targetIndex =
    opts.mode.kind === "tick"
      ? startIndex + (1 + Math.floor(rngFor(opts.seed, game.id, "count", startIndex)() * 3))
      : Math.max(startIndex, opts.mode.targetCount)

  const toCreate: EventDraft[] = []
  let lastMiss: { teamId: string } | null = null
  let lastMake: { teamId: string; playerId: string | null } | null = null
  let finished = false
  let i = startIndex
  let guard = 0

  while (i < targetIndex && !finished && guard < 400) {
    guard++

    // Tip-off: the very first event of the game must open period 1.
    if (i === 0) {
      toCreate.push({ eventType: "PERIOD_START", teamId: null, playerId: null, made: null, period, clockSeconds })
      periodOpen = true
      i++
      continue
    }

    // Last batch ended right after closing a quarter — open the next one
    // before generating any plays (never emit two PERIOD_ENDs in a row).
    if (!periodOpen) {
      period += 1
      clockSeconds = PERIOD_SECONDS
      toCreate.push({ eventType: "PERIOD_START", teamId: null, playerId: null, made: null, period, clockSeconds })
      periodOpen = true
      i++
      continue
    }

    if (clockSeconds <= 0) {
      toCreate.push({ eventType: "PERIOD_END", teamId: null, playerId: null, made: null, period, clockSeconds: 0 })
      periodOpen = false
      i++
      if (period >= FINAL_PERIOD) {
        finished = true
        break
      }
      continue
    }

    const evRng = rngFor(opts.seed, game.id, "event", i)
    let eventType: GameEventType
    let teamId: string
    let playerId: string | null
    let made: boolean | null = null
    let metadata: Record<string, unknown> | undefined

    if (lastMiss && evRng() < 0.72) {
      // A miss is very likely followed by a rebound.
      eventType = "REBOUND"
      const offensive = evRng() < 0.28
      teamId = offensive ? lastMiss.teamId : otherTeam(game, lastMiss.teamId)
      playerId = pickPlayer(evRng, rosterFor(game, teamId, homeRoster, awayRoster))
      metadata = { offensive }
      lastMiss = null
    } else if (lastMake && evRng() < 0.35) {
      // A make sometimes gets credited with an assist from a teammate.
      eventType = "ASSIST"
      teamId = lastMake.teamId
      const roster = rosterFor(game, teamId, homeRoster, awayRoster)
      const others = roster.filter((p) => p !== lastMake!.playerId)
      playerId = pickPlayer(evRng, others.length ? others : roster)
      lastMake = null
    } else {
      lastMiss = null
      lastMake = null
      teamId = evRng() < 0.5 ? game.homeTeamId : game.awayTeamId
      const roster = rosterFor(game, teamId, homeRoster, awayRoster)
      eventType = weightedPick(evRng, PLAY_WEIGHTS)
      playerId = pickPlayer(evRng, roster)

      if (eventType === "SCORE_2PT" || eventType === "SCORE_3PT" || eventType === "SCORE_FT") {
        const p = adjustedMakeProb(eventType, teamId, game.homeTeamId, homeScore, awayScore)
        made = evRng() < p
        const pts = SHOT_POINTS[eventType] ?? 0
        if (made) {
          if (teamId === game.homeTeamId) homeScore += pts
          else awayScore += pts
          lastMake = { teamId, playerId }
        } else {
          lastMiss = { teamId }
        }
      } else if (eventType === "REBOUND") {
        metadata = { offensive: evRng() < 0.28 }
      }
    }

    toCreate.push({ eventType, teamId, playerId, made, period, clockSeconds, metadata })
    // Plausible possession length: 8-28 seconds off the clock per event.
    clockSeconds = Math.max(0, clockSeconds - (8 + Math.floor(evRng() * 20)))
    i++
  }

  if (toCreate.length === 0) return { finalized: false }

  await (prisma as any).$transaction(async (tx: any) => {
    await tx.gameEvent.createMany({
      data: toCreate.map((e, k) => ({
        gameId: game.id,
        eventType: e.eventType,
        teamId: e.teamId,
        playerId: e.playerId,
        made: e.made,
        points: e.made ? (SHOT_POINTS[e.eventType] ?? null) : null,
        period: e.period,
        clockSeconds: e.clockSeconds,
        timestamp: new Date(),
        sequence: seq + k + 1,
        clientEventId: `carousel:${opts.seed}:${game.id}:${startIndex + k}`,
        metadata: e.metadata ?? undefined,
      })),
    })

    // Tip-off: SCHEDULED → LIVE, exactly like the real events route does
    // when a PERIOD_START lands on a still-SCHEDULED game. Also stamps
    // publishedAt/scheduledAt defensively so the fixture is guaranteed
    // publicly visible (Draft/Publish law) and reads as "happening now".
    if (startIndex === 0) {
      const current = await tx.game.findUnique({ where: { id: game.id }, select: { publishedAt: true } })
      await tx.game.update({
        where: { id: game.id },
        data: {
          status: "LIVE",
          scheduledAt: new Date(),
          publishedAt: current?.publishedAt ?? new Date(),
        },
      })
      console.log(`[carousel] tip-off: ${game.id}`)
    }
  })

  try {
    const sums = await (prisma as any).gameEvent.groupBy({
      by: ["teamId"],
      where: { gameId: game.id, voided: false, points: { not: null } },
      _sum: { points: true },
    })
    const scoreFor = (teamId: string) => sums.find((s: any) => s.teamId === teamId)?._sum?.points ?? 0
    const rtm1 = await realtimePromise
    if (rtm1) await rtm1.publishRealtime({
      rooms: [rtm1.rooms.game(game.id), rtm1.rooms.scores, ...(game.leagueId ? [rtm1.rooms.leagueScores(game.leagueId)] : [])],
      event: "game.update",
      payload: {
        gameId: game.id,
        status: finished ? "COMPLETED" : "LIVE",
        homeScore: scoreFor(game.homeTeamId),
        awayScore: scoreFor(game.awayTeamId),
      },
    })
  } catch (err) {
    console.error("[carousel] realtime ping failed (non-fatal):", err)
  }

  if (finished) {
    await finalizeGame(game.id)
    return { finalized: true }
  }
  return { finalized: false }
}

// ---------------------------------------------------------------------------
// Finalize — mirrors apps/web/src/app/api/games/[id]/finalize/route.ts:
// fold the stream, write final score + PlayerStat, auto-publish the recap,
// post the final-score/POTG card, detect milestones + standings movement.
// Skips referee sign-off / playoff advancement / email+bell (see header).
// ---------------------------------------------------------------------------

async function finalizeGame(gameId: string): Promise<void> {
  if (!(await (await demoModePromise).isDemoGame(gameId))) {
    console.warn(`[carousel] refusing to finalize non-demo game ${gameId} (guard rail)`)
    return
  }

  const game = await (prisma as any).game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      season: { select: { leagueId: true } },
    },
  })
  if (!game) return

  const rows = await (prisma as any).gameEvent.findMany({
    where: { gameId },
    orderBy: { sequence: "asc" },
    select: {
      eventType: true,
      teamId: true,
      playerId: true,
      made: true,
      period: true,
      clockSeconds: true,
      sequence: true,
      voided: true,
      timestamp: true,
      metadata: true,
    },
  })
  const events: FoldEvent[] = rows.map((e: any) => ({
    eventType: e.eventType,
    teamId: e.teamId,
    playerId: e.playerId,
    made: e.made,
    period: e.period,
    clockSeconds: e.clockSeconds,
    voided: e.voided,
    sequence: e.sequence,
    timestampMs: new Date(e.timestamp).getTime(),
    metadata: e.metadata ?? null,
  }))
  if (events.filter((e) => !e.voided).length === 0) return

  const folded = foldEvents(events, { homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId })
  const lines: PlayerLine[] = Object.values(folded.players)

  const realPlayers = new Set(
    (
      await (prisma as any).player.findMany({
        where: { id: { in: lines.map((l) => l.playerId) } },
        select: { id: true },
      })
    ).map((p: any) => p.id as string)
  )
  const statLines = lines.filter((l) => realPlayers.has(l.playerId))

  // Top-scorer auto-suggest, same convention the finalize UI uses — only
  // when they actually scored something.
  const potgLine = statLines.slice().sort((a, b) => b.points - a.points || a.playerId.localeCompare(b.playerId))[0]
  const potgPlayerId = potgLine && potgLine.points > 0 ? potgLine.playerId : null

  await (prisma as any).$transaction(async (tx: any) => {
    await tx.game.update({
      where: { id: gameId },
      data: {
        homeScore: folded.homeScore,
        awayScore: folded.awayScore,
        status: "COMPLETED",
        finalizedAt: new Date(),
        scoringSessionId: null,
        scoringSessionUser: null,
        scoringSessionAt: null,
        potgPlayerId,
      },
    })
    await tx.playerStat.deleteMany({ where: { gameId } })
    if (statLines.length > 0) {
      await tx.playerStat.createMany({
        data: statLines.map((l) => ({
          gameId,
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
    }
  })

  let potgName: string | null = null
  if (potgPlayerId) {
    const p = await (prisma as any).player.findUnique({
      where: { id: potgPlayerId },
      select: { firstName: true, lastName: true },
    })
    potgName = p ? `${p.firstName} ${p.lastName}`.trim() : null
  }

  // Final-score / POTG card — same shape as the finalize route's Post.upsert.
  try {
    const finalTitle = `Final: ${game.homeTeam.name} ${folded.homeScore}–${folded.awayScore} ${game.awayTeam.name}`
    await (prisma as any).post.upsert({
      where: { slug: `final-${gameId}` },
      create: {
        kind: potgName ? "PLAYER_OF_GAME" : "ANNOUNCEMENT",
        title: finalTitle,
        slug: `final-${gameId}`,
        body: potgName ? `Player of the Game: ${potgName}.` : "",
        status: "PUBLISHED",
        publishedAt: new Date(),
        visibility: "PUBLIC",
        tags: {
          create: [{ gameId }, { teamId: game.homeTeamId }, { teamId: game.awayTeamId }],
        },
      },
      update: {
        kind: potgName ? "PLAYER_OF_GAME" : "ANNOUNCEMENT",
        title: finalTitle,
        body: potgName ? `Player of the Game: ${potgName}.` : "",
      },
    })
  } catch (err) {
    console.error("[carousel] final post failed (non-fatal):", err)
  }

  try {
    await upsertGameRecap(gameId)
  } catch (err) {
    console.error("[carousel] recap generation failed (non-fatal):", err)
  }

  try {
    const { detectAndPublishMilestones } = await import(
      "../apps/web/src/lib/content/milestones"
    )
    await detectAndPublishMilestones(gameId)
  } catch (err) {
    console.error("[carousel] milestone detection failed (non-fatal):", err)
  }

  try {
    const { detectAndPublishStandingsMovement } = await import(
      "../apps/web/src/lib/content/standings-movement"
    )
    await detectAndPublishStandingsMovement(gameId)
  } catch (err) {
    console.error("[carousel] standings-movement detection failed (non-fatal):", err)
  }

  try {
    const rtm2 = await realtimePromise
    if (rtm2) await rtm2.publishRealtime({
      rooms: [rtm2.rooms.game(gameId), rtm2.rooms.scores, ...(game.season?.leagueId ? [rtm2.rooms.leagueScores(game.season.leagueId)] : [])],
      event: "game.update",
      payload: { gameId, status: "COMPLETED", homeScore: folded.homeScore, awayScore: folded.awayScore },
    })
  } catch (err) {
    console.error("[carousel] realtime publish failed (non-fatal):", err)
  }

  console.log(
    `[carousel] FINAL ${game.homeTeam.name} ${folded.homeScore} - ${folded.awayScore} ${game.awayTeam.name}` +
      (potgName ? ` · POTG ${potgName}` : "")
  )
}

// ---------------------------------------------------------------------------
// Reset — return a game to SCHEDULED, clearing everything this driver wrote:
// events, player stats, and the posts (recap/final/milestones/standings-
// movement) it tagged with this gameId.
// ---------------------------------------------------------------------------

async function resetGame(gameId: string): Promise<void> {
  if (!(await (await demoModePromise).isDemoGame(gameId))) {
    console.warn(`[carousel] refusing to reset non-demo game ${gameId} (guard rail)`)
    return
  }

  await (prisma as any).gameEvent.deleteMany({ where: { gameId } })
  await (prisma as any).playerStat.deleteMany({ where: { gameId } })

  const tags = await (prisma as any).postTag.findMany({ where: { gameId }, select: { postId: true } })
  const postIds = Array.from(new Set(tags.map((t: any) => t.postId as string)))
  if (postIds.length > 0) {
    await (prisma as any).post.deleteMany({ where: { id: { in: postIds } } })
  }

  await (prisma as any).game.update({
    where: { id: gameId },
    data: {
      status: "SCHEDULED",
      homeScore: null,
      awayScore: null,
      finalizedAt: null,
      potgPlayerId: null,
      potgPhotoUrl: null,
      refereeName: null,
      refereeSignedAt: null,
      refereeSignature: null,
      refereeVerified: false,
      scoringSessionId: null,
      scoringSessionUser: null,
      scoringSessionAt: null,
    },
  })
}

async function resetAllInPool(labelPattern: string, leagueId?: string): Promise<void> {
  const pool = await loadPool(labelPattern, leagueId)
  if (pool.length === 0) {
    console.log("[carousel] --reset: no showcase pool found — nothing to reset.")
    return
  }
  for (const g of pool) {
    console.log(`[carousel] resetting ${g.id} (${g.status} → SCHEDULED)`)
    await resetGame(g.id)
  }
  console.log(`[carousel] reset complete: ${pool.length} game(s) returned to SCHEDULED.`)
}

// ---------------------------------------------------------------------------
// Tick — one pass: advance every LIVE slot; recycle COMPLETED fixtures past
// cooldown back to SCHEDULED if the pool is exhausted; fill any open slots
// from SCHEDULED fixtures, staggering fresh starts to unused progress bands.
// ---------------------------------------------------------------------------

interface TickOptions {
  seed: number
  slots: number
  cooldownMs: number
  labelPattern: string
  leagueId?: string
}

async function tick(opts: TickOptions): Promise<void> {
  if (!(await (await demoModePromise).isDemoModeEnabled())) {
    console.log("[carousel] demo mode is OFF (PlatformSettings.demoModeEnabled) — skipping tick")
    return
  }

  const pool = await loadPool(opts.labelPattern, opts.leagueId)
  if (pool.length === 0) {
    console.log(
      `[carousel] no showcase pool found (League.isDemo=true, Season.label containing "${opts.labelPattern}"). ` +
        `Nothing to drive yet — this is expected until the spec-driven seeder runs.`
    )
    return
  }

  const live = pool.filter((g) => g.status === "LIVE")

  // 1. Advance every currently-live slot. Some may finalize mid-loop.
  for (const game of live) {
    try {
      const result = await advanceGame(game, { seed: opts.seed, mode: { kind: "tick" } })
      if (result.finalized) console.log(`[carousel] slot finished this tick: ${game.id}`)
    } catch (err) {
      console.error(`[carousel] advance failed for ${game.id} (non-fatal, skipping):`, err)
    }
  }

  // Re-read: step 1 may have flipped some LIVE games to COMPLETED.
  const poolAfter = await loadPool(opts.labelPattern, opts.leagueId)
  const liveAfter = poolAfter.filter((g) => g.status === "LIVE")
  const scheduledAfter = poolAfter.filter((g) => g.status === "SCHEDULED")
  const completedAfter = poolAfter.filter((g) => g.status === "COMPLETED")

  const now = Date.now()
  const stillCooling = completedAfter.filter(
    (g) => g.finalizedAt && now - new Date(g.finalizedAt).getTime() < opts.cooldownMs
  )
  const effectiveActive = liveAfter.length + stillCooling.length
  const openSlots = Math.max(0, opts.slots - effectiveActive)
  if (openSlots === 0) return

  // 2. Not enough SCHEDULED fixtures? Recycle completed ones past cooldown
  // (reset, don't clone — simpler, bounded data, and explicitly fine per
  // the build spec).
  let candidates = scheduledAfter
  if (candidates.length < openSlots) {
    const stillCoolingIds = new Set(stillCooling.map((g) => g.id))
    const eligibleForRecycle = completedAfter.filter((g) => !stillCoolingIds.has(g.id))
    const needed = openSlots - candidates.length
    const toRecycle = eligibleForRecycle.slice(0, needed)
    for (const g of toRecycle) {
      console.log(`[carousel] pool exhausted — recycling completed fixture ${g.id} back to SCHEDULED`)
      await resetGame(g.id)
    }
    if (toRecycle.length > 0) candidates = [...candidates, ...toRecycle]
  }

  if (candidates.length === 0) {
    console.log(
      `[carousel] ${openSlots} open slot(s) but nothing available to fill them (pool exhausted, ` +
        `rest still cooling down).`
    )
    return
  }
  if (candidates.length < openSlots) {
    console.log(`[carousel] only ${candidates.length} fixture(s) available for ${openSlots} open slot(s).`)
  }

  // 3. Stagger fresh starts into whichever progress band (early/mid/late)
  // isn't currently occupied by a live game.
  const liveFractions: number[] = []
  for (const g of liveAfter) {
    const n = await countEvents(g.id)
    liveFractions.push(Math.min(1, n / TARGET_EVENT_COUNT))
  }
  const unusedTargets = STAGGER_FRACTIONS.filter((f) => !liveFractions.some((lf) => Math.abs(lf - f) < 0.2))

  const toStart = candidates.slice(0, openSlots)
  for (let idx = 0; idx < toStart.length; idx++) {
    const game = toStart[idx]
    const fraction = unusedTargets[idx] ?? STAGGER_FRACTIONS[0]
    const targetCount = Math.max(1, Math.round(fraction * TARGET_EVENT_COUNT))
    console.log(
      `[carousel] starting fixture ${game.id} → fast-forwarding to ~${Math.round(fraction * 100)}% (${targetCount} events)`
    )
    try {
      const result = await advanceGame(game, { seed: opts.seed, mode: { kind: "reach", targetCount } })
      if (result.finalized) console.log(`[carousel] ${game.id} finished during its own catch-up (short game)`)
    } catch (err) {
      console.error(`[carousel] start failed for ${game.id} (non-fatal, skipping):`, err)
    }
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const argv = process.argv.slice(2)
  const flag = (name: string) => argv.includes(`--${name}`)
  const opt = (name: string, def: string) => {
    const prefix = `--${name}=`
    const hit = argv.find((a) => a.startsWith(prefix))
    return hit ? hit.slice(prefix.length) : def
  }
  return {
    tick: flag("tick"),
    loop: flag("loop"),
    reset: flag("reset"),
    seed: Number(opt("seed", String(DEFAULT_SEED))),
    interval: Number(opt("interval", String(DEFAULT_INTERVAL_MS))),
    slots: Math.max(1, Math.min(3, Number(opt("slots", String(DEFAULT_SLOTS))))),
    cooldown: Number(opt("cooldown", String(DEFAULT_COOLDOWN_MS))),
    label: opt("label", DEFAULT_LABEL_PATTERN),
    league: opt("league", "") || undefined,
  }
}

async function main() {
  const args = parseArgs()

  if (args.reset) {
    await resetAllInPool(args.label, args.league)
    await (prisma as any).$disconnect()
    return
  }

  const tickOpts: TickOptions = {
    seed: args.seed,
    slots: args.slots,
    cooldownMs: args.cooldown,
    labelPattern: args.label,
    leagueId: args.league,
  }

  if (args.loop) {
    console.log(
      `[carousel] loop mode — tick every ${args.interval}ms, seed=${args.seed}, slots=${args.slots}, ` +
        `cooldown=${args.cooldown}ms (Ctrl+C to stop)`
    )
    let stopping = false
    const run = async () => {
      if (stopping) return
      try {
        await tick(tickOpts)
      } catch (err) {
        console.error("[carousel] tick failed (non-fatal, will retry next interval):", err)
      }
    }
    await run()
    const handle = setInterval(run, args.interval)
    const shutdown = async () => {
      if (stopping) return
      stopping = true
      clearInterval(handle)
      console.log("\n[carousel] shutting down…")
      await (prisma as any).$disconnect()
      process.exit(0)
    }
    process.on("SIGINT", shutdown)
    process.on("SIGTERM", shutdown)
    return // interval keeps the process alive
  }

  if (args.tick) {
    await tick(tickOpts)
    await (prisma as any).$disconnect()
    return
  }

  console.log(`Usage:
  npx tsx scripts/live-carousel.ts --tick     one pass over up to 3 slots
  npx tsx scripts/live-carousel.ts --loop     tick every ~30s forever (Ctrl+C to stop)
  npx tsx scripts/live-carousel.ts --reset    return every carousel game to SCHEDULED

Options: --seed=N  --interval=<ms> (loop only, default ${DEFAULT_INTERVAL_MS})
         --slots=1-3 (default ${DEFAULT_SLOTS})  --cooldown=<ms> (default ${DEFAULT_COOLDOWN_MS})
         --label=<text> (default "${DEFAULT_LABEL_PATTERN}")  --league=<leagueId>`)
  await (prisma as any).$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
