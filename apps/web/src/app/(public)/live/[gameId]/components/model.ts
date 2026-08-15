import { monogram } from "@/lib/content/matchup-cover"
import { totalRebounds, type FoldEvent, type FoldResult, type PlayerLine } from "@/lib/scoring/fold"
import type { LeaderEntry, LeaderSection, LivePayload, PlayRow } from "./types"

/**
 * Every derived value the live game page renders, built once per poll from
 * the payload + the folded event stream (R2 split, 2026-08-14). This is a
 * straight lift of the maths that used to sit inline in live-view.tsx: same
 * inputs, same outputs, no behaviour change. Views get `model` and render.
 *
 * No team colours live here any more (owner ruling 2026-08-14). The payload
 * still carries `homeColor` / `awayColor` for other consumers, but this page
 * is a summary surface end to end, so crests, chips and bars are ink-toned and
 * home versus away is told by position and type. Deriving a colour here was
 * what let it leak into eight components at once.
 */

export interface GameModel {
  data: LivePayload
  game: LivePayload["game"]
  fold: FoldResult
  nameOf: (playerId?: string | null) => string
  jerseyOf: (playerId: string) => string
  /** Head shot if the payload carried one, else null and the mug is drawn. */
  photoOf: (playerId?: string | null) => string | null
  shortName: (playerId: string) => string
  shortTeam: (name: string) => string
  live: boolean
  final: boolean
  homeScore: number
  awayScore: number
  /** Periods that have actually been played, ascending. */
  periods: number[]
  /** Always four quarters, plus any overtime reached. */
  displayPeriods: number[]
  playedPeriods: Set<number>
  periodLabel: (p: number) => string
  periodPoints: (teamId: string, p: number) => number
  teamLines: (teamId: string) => PlayerLine[]
  starterIds: Map<string, Set<string>>
  leaderSections: LeaderSection[]
  teamAgg: (teamId: string) => TeamAgg
  /** Newest first, with the running score attached to scoring plays. */
  playByPlay: PlayRow[]
  describe: (e: FoldEvent) => string
  hasAnyStats: boolean
}

export interface TeamAgg {
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  reb: number
  ast: number
  stl: number
  blk: number
  to: number
  pf: number
}

export function buildModel(data: LivePayload, fold: FoldResult): GameModel {
  const { game } = data

  const byId = new Map(data.players.map((p) => [p.playerId, p]))
  const nameOf = (pid?: string | null) => (pid ? byId.get(pid)?.name ?? "" : "")
  const jerseyOf = (pid: string) => byId.get(pid)?.jerseyNumber ?? "?"
  const photoOf = (pid?: string | null) => (pid ? (byId.get(pid)?.photoUrl ?? null) : null)
  const shortName = (pid: string) => {
    const name = nameOf(pid) || ""
    // Game-day guests carry a flag, not a name suffix — label AFTER the
    // abbreviation so "Marcus Lee" never mangles into "Marcus (."
    const guestTag = (byId.get(pid) as any)?.guest ? " (Guest)" : ""
    const parts = name.split(" ")
    if (parts.length < 2) return (parts[0] || "—") + guestTag
    // Privacy-abbreviated names ("Cameron K.") arrive pre-shortened — never
    // initial them again. Compression matches the privacy form (owner
    // 2026-07-16): FIRST name + last initial, "Aiden M.", never "A. Mensah".
    const last = parts[parts.length - 1]
    if (/^[A-Z]\.?$/.test(last)) return name + guestTag
    return `${parts[0]} ${last[0]}.${guestTag}`
  }

  // Youth team names run long ("Burlington Force Grade 10") — the score
  // surfaces show initials + a grade/age qualifier ("BF · G10") until teams
  // get an owner-set short name (backlog).
  const shortTeam = (name: string) => {
    const m = name.match(/\b(?:grade\s*(\d{1,2})|gr\s*(\d{1,2})|u(\d{1,2})|(\d{1,2})u)\b/i)
    const qual = m ? (m[1] || m[2] ? `G${m[1] ?? m[2]}` : `U${m[3] ?? m[4]}`) : null
    const base = m ? name.replace(m[0], "").trim() : name
    return qual ? `${monogram(base)} · ${qual}` : monogram(base)
  }

  const live = game.status === "LIVE"
  const final = game.status === "COMPLETED"
  const homeScore = final && game.homeScore != null ? game.homeScore : fold.homeScore
  const awayScore = final && game.awayScore != null ? game.awayScore : fold.awayScore

  const periods = Array.from(
    new Set(fold.playByPlay.filter((e) => e.period).map((e) => e.period as number))
  ).sort((a, b) => a - b)
  const periodLabel = (p: number) => (p <= 4 ? `Q${p}` : `OT${p - 4}`)
  const periodPoints = (teamId: string, p: number) =>
    fold.playByPlay
      .filter(
        (e) =>
          e.teamId === teamId &&
          e.period === p &&
          e.made !== false &&
          ["SCORE_2PT", "SCORE_3PT", "SCORE_FT"].includes(e.eventType)
      )
      .reduce(
        (s, e) => s + (e.eventType === "SCORE_2PT" ? 2 : e.eventType === "SCORE_3PT" ? 3 : 1),
        0
      )

  const teamLines = (teamId: string) =>
    Object.values(fold.players)
      .filter((l) => l.teamId === teamId)
      .sort((a, b) => b.points - a.points)

  // Starting five = the first LINEUP event each team recorded
  const starterIds = new Map<string, Set<string>>()
  for (const e of data.events) {
    if (e.eventType === "LINEUP" && e.teamId && !e.voided && !starterIds.has(e.teamId)) {
      starterIds.set(e.teamId, new Set((e.metadata as any)?.playerIds ?? []))
    }
  }

  const leaderOf = (teamId: string, stat: (l: PlayerLine) => number): PlayerLine | null => {
    const lines = teamLines(teamId).filter((l) => stat(l) > 0)
    if (lines.length === 0) return null
    return lines.reduce((best, l) => (stat(l) > stat(best) ? l : best))
  }

  const teamAgg = (teamId: string): TeamAgg => {
    const lines = teamLines(teamId)
    const sum = (get: (l: PlayerLine) => number) => lines.reduce((t, l) => t + get(l), 0)
    return {
      fgm: sum((l) => l.fgMade2 + l.fgMade3),
      fga: sum((l) => l.fgMade2 + l.fgMiss2 + l.fgMade3 + l.fgMiss3),
      tpm: sum((l) => l.fgMade3),
      tpa: sum((l) => l.fgMade3 + l.fgMiss3),
      ftm: sum((l) => l.ftMade),
      fta: sum((l) => l.ftMade + l.ftMiss),
      reb: sum(totalRebounds),
      ast: sum((l) => l.assists),
      stl: sum((l) => l.steals),
      blk: sum((l) => l.blocks),
      to: sum((l) => l.turnovers),
      pf: sum((l) => l.fouls),
    }
  }

  const defLeader = (teamId: string): LeaderEntry | null => {
    const st = leaderOf(teamId, (l) => l.steals)
    const bl = leaderOf(teamId, (l) => l.blocks)
    const sv = st?.steals ?? 0
    const bv = bl?.blocks ?? 0
    if (sv === 0 && bv === 0) return null
    return bv > sv ? { l: bl!, value: bv, unit: "BLK" } : { l: st!, value: sv, unit: "STL" }
  }

  const leaderSections: LeaderSection[] = [
    {
      label: "Points",
      unit: "PTS",
      pick: (tid) => {
        const l = leaderOf(tid, (x) => x.points)
        return l ? { l, value: l.points, unit: "PTS" } : null
      },
      sub: (l) => `${totalRebounds(l)} REB · ${l.assists} AST`,
    },
    {
      label: "Rebounds",
      unit: "REB",
      pick: (tid) => {
        const l = leaderOf(tid, totalRebounds)
        return l ? { l, value: totalRebounds(l), unit: "REB" } : null
      },
      sub: (l) => `${l.defRebounds} DREB · ${l.offRebounds} OREB`, // W-001: stat abbreviations are all-caps
    },
    {
      label: "Assists",
      unit: "AST",
      pick: (tid) => {
        const l = leaderOf(tid, (x) => x.assists)
        return l ? { l, value: l.assists, unit: "AST" } : null
      },
      sub: (l) => `${l.points} PTS · ${l.turnovers} TO`,
    },
    {
      label: "Defense",
      unit: "",
      pick: defLeader,
      sub: (l) => `${l.steals} STL · ${l.blocks} BLK`,
    },
  ]

  // Play-by-play with a running score attached to scoring plays
  const SCORE_PTS: Record<string, number> = { SCORE_2PT: 2, SCORE_3PT: 3, SCORE_FT: 1 }
  const PBP_TYPES = new Set([
    "SCORE_2PT",
    "SCORE_3PT",
    "SCORE_FT",
    "FOUL",
    "SUBSTITUTION",
    "PERIOD_START",
    "PERIOD_END",
  ])
  // Narrative merge (owner 2026-07-16): the console writes ASSIST right
  // after a made shot and REBOUND right after a miss (single-scorer lock →
  // always adjacent), so shots absorb their follow-up into one line:
  // "Basket by X, assisted by Y" / "X misses — defensive rebound Z".
  let runHome = 0
  let runAway = 0
  const ordered = fold.playByPlay
  const consumed = new Set<number>()
  const playByPlay: PlayRow[] = []
  for (let i = 0; i < ordered.length; i++) {
    if (consumed.has(i)) continue
    const e = ordered[i]
    const pts = SCORE_PTS[e.eventType]
    const scored = pts != null && e.made !== false && !!e.teamId
    if (scored) {
      if (e.teamId === game.homeTeamId) runHome += pts
      else if (e.teamId === game.awayTeamId) runAway += pts
    }
    let tail: string | null = null
    if (pts != null && e.eventType !== "SCORE_FT") {
      // look at the next two entries for the chained follow-up
      for (let j = i + 1; j <= i + 2 && j < ordered.length; j++) {
        if (consumed.has(j)) continue
        const n = ordered[j]
        if (e.made !== false && n.eventType === "ASSIST" && n.teamId === e.teamId) {
          tail = n.playerId ? `, assisted by #${jerseyOf(n.playerId)} ${shortName(n.playerId)}` : null
          consumed.add(j)
          break
        }
        if (e.made === false && n.eventType === "REBOUND") {
          const off = (n.metadata as { offensive?: boolean } | null)?.offensive
          tail = n.playerId
            ? ` — ${off ? "offensive" : "defensive"} rebound #${jerseyOf(n.playerId)} ${shortName(n.playerId)}`
            : null
          consumed.add(j)
          break
        }
        if (["SCORE_2PT", "SCORE_3PT", "SCORE_FT", "PERIOD_START", "PERIOD_END"].includes(n.eventType)) break
      }
    }
    if (!PBP_TYPES.has(e.eventType)) continue
    playByPlay.push({ e, score: scored ? `${runHome}–${runAway}` : null, tail })
  }
  playByPlay.reverse()

  const describe = (e: FoldEvent): string => {
    switch (e.eventType) {
      case "SCORE_2PT":
      case "SCORE_3PT":
      case "SCORE_FT": {
        const pts = e.eventType === "SCORE_2PT" ? 2 : e.eventType === "SCORE_3PT" ? 3 : 1
        const who = e.playerId ? `#${jerseyOf(e.playerId)} ${shortName(e.playerId)}` : "—"
        return e.made === false
          ? `${who} misses ${e.eventType === "SCORE_FT" ? "a free throw" : `a ${pts}-pointer`}`
          : `${who} ${e.eventType === "SCORE_FT" ? "makes a free throw" : `scores ${pts}`}`
      }
      case "FOUL":
        return `Foul on ${e.playerId ? `#${jerseyOf(e.playerId)} ${shortName(e.playerId)}` : "team"}${
          (e.metadata as any)?.technical ? " (technical)" : ""
        }`
      case "SUBSTITUTION":
        return `Sub: ${(e.metadata as any)?.inPlayerId ? `#${jerseyOf((e.metadata as any).inPlayerId)}` : "?"} in, ${
          (e.metadata as any)?.outPlayerId ? `#${jerseyOf((e.metadata as any).outPlayerId)}` : "?"
        } out`
      case "PERIOD_START":
        return `${periodLabel(e.period ?? 1)}`
      case "PERIOD_END":
        return "End of period"
      default:
        return e.eventType
    }
  }

  // Always show all four quarters — a dash marks the unplayed ones (owner:
  // fixed columns read better); overtime columns append only when reached.
  const displayPeriods = [1, 2, 3, 4, ...periods.filter((p) => p > 4)]

  return {
    data,
    game,
    fold,
    nameOf,
    jerseyOf,
    photoOf,
    shortName,
    shortTeam,
    live,
    final,
    homeScore,
    awayScore,
    periods,
    displayPeriods,
    playedPeriods: new Set(periods),
    periodLabel,
    periodPoints,
    teamLines,
    starterIds,
    leaderSections,
    teamAgg,
    playByPlay,
    describe,
    hasAnyStats: Object.keys(fold.players).length > 0,
  }
}
