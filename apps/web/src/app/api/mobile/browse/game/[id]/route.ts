import { NextRequest, NextResponse } from "next/server"
import { foldEvents, totalRebounds, type FoldEvent, type PlayerLine } from "@/lib/scoring/fold"
import { GET as liveGET } from "@/app/api/live/[gameId]/route"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/game/[id] — the game page PRE-FOLDED for the native
 * app (web parity, owner 2026-07-16: "make sure the app follows the exact
 * same design as the mobile web"). The web folds the event stream client-side
 * (live-view.tsx); the app gets display-ready linescore / leaders / team
 * stats / box / plays from the SAME live payload + fold engine, so the two
 * can never disagree on a number. Anonymous (mobile/browse allowlist).
 */

const periodLabel = (p: number) => (p <= 4 ? `Q${p}` : `OT${p - 4}`)

/** "Burlington Force Grade 10" → "BF · G10" (same rule as web shortTeam). */
function monogram(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}
function shortTeam(name: string): string {
  const m = name.match(/\b(?:grade\s*(\d{1,2})|gr\s*(\d{1,2})|u(\d{1,2})|(\d{1,2})u)\b/i)
  const qual = m ? (m[1] || m[2] ? `G${m[1] ?? m[2]}` : `U${m[3] ?? m[4]}`) : null
  const base = m ? name.replace(m[0], "").trim() : name
  return qual ? `${monogram(base)} · ${qual}` : monogram(base)
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = await liveGET(
      new NextRequest(`http://internal/api/live/${params.id}`),
      { params: { gameId: params.id } } as any
    )
    if (res.status !== 200) {
      return NextResponse.json({ error: "Game not found" }, { status: res.status })
    }
    const data = (await res.json()) as any
    const game = data.game
    const fold = foldEvents(data.events as FoldEvent[], {
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
    })

    const byId = new Map<string, any>(data.players.map((p: any) => [p.playerId, p]))
    const nameOf = (pid?: string | null) => (pid ? (byId.get(pid)?.name ?? "") : "")
    const jerseyOf = (pid: string) => byId.get(pid)?.jerseyNumber ?? "?"
    const shortName = (pid: string) => {
      const name = nameOf(pid)
      const parts = name.split(" ")
      if (parts.length < 2) return parts[0] || "—"
      const last = parts[parts.length - 1]
      if (/^[A-Z]\.?$/.test(last)) return name
      // Owner 2026-07-16: FIRST name + last initial ("Aiden M."), matching
      // the public privacy form — never "A. Mensah".
      return `${parts[0]} ${last[0]}.`
    }

    const live = game.status === "LIVE"
    const final = game.status === "COMPLETED"
    const homeScore = final && game.homeScore != null ? game.homeScore : fold.homeScore
    const awayScore = final && game.awayScore != null ? game.awayScore : fold.awayScore

    const periods = Array.from(
      new Set(fold.playByPlay.filter((e) => e.period).map((e) => e.period as number))
    ).sort((a, b) => a - b)
    const displayPeriods = [1, 2, 3, 4, ...periods.filter((p) => p > 4)]
    const played = new Set(periods)
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

    const leaderOf = (teamId: string, stat: (l: PlayerLine) => number): PlayerLine | null => {
      const lines = teamLines(teamId).filter((l) => stat(l) > 0)
      if (lines.length === 0) return null
      return lines.reduce((best, l) => (stat(l) > stat(best) ? l : best))
    }
    const leaderCell = (l: PlayerLine | null, value: number, unit: string, sub: string) =>
      l ? { jersey: String(jerseyOf(l.playerId)), name: shortName(l.playerId), value, unit, sub } : null
    const defLeader = (teamId: string) => {
      const st = leaderOf(teamId, (l) => l.steals)
      const bl = leaderOf(teamId, (l) => l.blocks)
      const sv = st?.steals ?? 0
      const bv = bl?.blocks ?? 0
      if (sv === 0 && bv === 0) return null
      const l = bv > sv ? bl! : st!
      return leaderCell(l, bv > sv ? bv : sv, bv > sv ? "BLK" : "STL", `${l.steals} STL · ${l.blocks} BLK`)
    }
    const leaders = [
      {
        label: "Points",
        home: (() => { const l = leaderOf(game.homeTeamId, (x) => x.points); return l ? leaderCell(l, l.points, "PTS", `${totalRebounds(l)} REB · ${l.assists} AST`) : null })(),
        away: (() => { const l = leaderOf(game.awayTeamId, (x) => x.points); return l ? leaderCell(l, l.points, "PTS", `${totalRebounds(l)} REB · ${l.assists} AST`) : null })(),
      },
      {
        label: "Rebounds",
        home: (() => { const l = leaderOf(game.homeTeamId, totalRebounds); return l ? leaderCell(l, totalRebounds(l), "REB", `${l.defRebounds} DReb · ${l.offRebounds} OReb`) : null })(),
        away: (() => { const l = leaderOf(game.awayTeamId, totalRebounds); return l ? leaderCell(l, totalRebounds(l), "REB", `${l.defRebounds} DReb · ${l.offRebounds} OReb`) : null })(),
      },
      {
        label: "Assists",
        home: (() => { const l = leaderOf(game.homeTeamId, (x) => x.assists); return l ? leaderCell(l, l.assists, "AST", `${l.points} PTS · ${l.turnovers} TO`) : null })(),
        away: (() => { const l = leaderOf(game.awayTeamId, (x) => x.assists); return l ? leaderCell(l, l.assists, "AST", `${l.points} PTS · ${l.turnovers} TO`) : null })(),
      },
      { label: "Defense", home: defLeader(game.homeTeamId), away: defLeader(game.awayTeamId) },
    ].filter((s) => s.home || s.away)

    const agg = (teamId: string) => {
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
    const H = agg(game.homeTeamId)
    const A = agg(game.awayTeamId)
    const shooting = (m: number, at: number) =>
      at === 0 ? "0-0" : `${m}-${at} · ${Math.round((m / at) * 100)}%`
    const pct = (m: number, at: number) => (at === 0 ? 0 : m / at)
    const row = (label: string, h: number, a: number, dh?: string, da?: string) => ({
      label,
      home: dh ?? String(h),
      away: da ?? String(a),
      homeWins: h > a,
      awayWins: a > h,
      homeShare: h + a === 0 ? 0.5 : h / (h + a),
    })
    const teamStats = [
      row("Field goals", pct(H.fgm, H.fga), pct(A.fgm, A.fga), shooting(H.fgm, H.fga), shooting(A.fgm, A.fga)),
      row("3-pointers", pct(H.tpm, H.tpa), pct(A.tpm, A.tpa), shooting(H.tpm, H.tpa), shooting(A.tpm, A.tpa)),
      row("Free throws", pct(H.ftm, H.fta), pct(A.ftm, A.fta), shooting(H.ftm, H.fta), shooting(A.ftm, A.fta)),
      row("Rebounds", H.reb, A.reb),
      row("Assists", H.ast, A.ast),
      row("Steals", H.stl, A.stl),
      row("Blocks", H.blk, A.blk),
      row("Turnovers", H.to, A.to),
      row("Fouls", H.pf, A.pf),
    ]

    // Starters = the first LINEUP event per team (permanent, owner v2 rule);
    // the on-court flag carries "on the floor right now" during live games.
    const firstLineup = new Map<string, Set<string>>()
    for (const e of data.events as Array<{ eventType: string; teamId?: string | null; voided?: boolean; metadata?: { playerIds?: string[] } }>) {
      if (e.eventType === "LINEUP" && e.teamId && !e.voided && !firstLineup.has(e.teamId)) {
        firstLineup.set(e.teamId, new Set(e.metadata?.playerIds ?? []))
      }
    }

    const boxFor = (teamId: string, name: string, color: string | null, total: number) => {
      const onFloorNow = live
        ? new Set(teamId === game.homeTeamId ? fold.onFloor.home : fold.onFloor.away)
        : null
      return {
        teamId,
        name,
        short: shortTeam(name),
        color,
        total,
        rows: teamLines(teamId).map((l) => ({
          playerId: l.playerId,
          jersey: String(jerseyOf(l.playerId)),
          name: shortName(l.playerId),
          starter: firstLineup.get(teamId)?.has(l.playerId) ?? false,
          onCourt: onFloorNow ? onFloorNow.has(l.playerId) : false,
          pts: l.points,
          reb: totalRebounds(l),
          ast: l.assists,
          stl: l.steals,
          to: l.turnovers,
        })),
      }
    }

    // Narrative merge (owner 2026-07-16): shots absorb the adjacent
    // ASSIST/REBOUND chained right after them by the console — one line:
    // "Basket by X, assisted by Y" / "X misses — defensive rebound Z".
    const SCORE_PTS: Record<string, number> = { SCORE_2PT: 2, SCORE_3PT: 3, SCORE_FT: 1 }
    const PLAY_TYPES = ["SCORE_2PT", "SCORE_3PT", "SCORE_FT", "FOUL", "PERIOD_START", "PERIOD_END"]
    let runHome = 0
    let runAway = 0
    const ordered = fold.playByPlay
    const consumed = new Set<number>()
    const plays: Array<{
      key: number
      period: number | null
      marker: boolean
      text: string
      score: string | null
      teamId: string | null
    }> = []
    for (let i = 0; i < ordered.length; i++) {
      if (consumed.has(i)) continue
      const e = ordered[i]
      const pts = SCORE_PTS[e.eventType]
      const scored = pts != null && e.made !== false && !!e.teamId
      if (scored) {
        if (e.teamId === game.homeTeamId) runHome += pts
        else if (e.teamId === game.awayTeamId) runAway += pts
      }
      let tail = ""
      if (pts != null && e.eventType !== "SCORE_FT") {
        for (let j = i + 1; j <= i + 2 && j < ordered.length; j++) {
          if (consumed.has(j)) continue
          const n = ordered[j]
          if (e.made !== false && n.eventType === "ASSIST" && n.teamId === e.teamId) {
            if (n.playerId) tail = `, assisted by #${jerseyOf(n.playerId)} ${shortName(n.playerId)}`
            consumed.add(j)
            break
          }
          if (e.made === false && n.eventType === "REBOUND") {
            const off = (n.metadata as { offensive?: boolean } | null)?.offensive
            if (n.playerId)
              tail = ` — ${off ? "offensive" : "defensive"} rebound #${jerseyOf(n.playerId)} ${shortName(n.playerId)}`
            consumed.add(j)
            break
          }
          if (["SCORE_2PT", "SCORE_3PT", "SCORE_FT", "PERIOD_START", "PERIOD_END"].includes(n.eventType)) break
        }
      }
      if (!PLAY_TYPES.includes(e.eventType)) continue
      const who = e.playerId ? `#${jerseyOf(e.playerId)} ${shortName(e.playerId)}` : "Team"
      let text: string
      switch (e.eventType) {
        case "SCORE_2PT":
        case "SCORE_3PT":
        case "SCORE_FT": {
          text =
            e.made === false
              ? `${who} misses ${e.eventType === "SCORE_FT" ? "a free throw" : `a ${pts}-pointer`}`
              : `${who} ${e.eventType === "SCORE_FT" ? "makes a free throw" : `scores ${pts}`}`
          break
        }
        case "FOUL":
          text = `Foul on ${who}`
          break
        case "PERIOD_START":
          text = periodLabel(e.period ?? 1)
          break
        default:
          text = "End of period"
      }
      plays.push({
        key: i,
        period: e.period ?? null,
        marker: e.eventType.startsWith("PERIOD"),
        text: text + tail,
        score: scored ? `${runHome}–${runAway}` : null,
        teamId: e.teamId ?? null,
      })
    }
    plays.reverse()

    return NextResponse.json({
      game: {
        id: game.id,
        status: game.status,
        live,
        final,
        scheduledAt: game.scheduledAt,
        period: fold.period,
        periodLabel: periodLabel(fold.period),
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeName: game.homeTeamName,
        awayName: game.awayTeamName,
        homeShort: shortTeam(game.homeTeamName),
        awayShort: shortTeam(game.awayTeamName),
        homeMonogram: monogram(game.homeTeamName),
        awayMonogram: monogram(game.awayTeamName),
        homeColor: game.homeColor,
        awayColor: game.awayColor,
        homeRecord: game.homeRecord?.record ?? null,
        awayRecord: game.awayRecord?.record ?? null,
        homeScore,
        awayScore,
        venueName: game.venueName,
        leagueName: game.leagueName,
        seasonName: game.seasonName,
        clockMode: game.clockMode ?? "OFF",
      },
      // Player of the Game (social-feed-plan P1/P2): banner + shareable card.
      // Name/photo consent-gating already happened inside /api/live.
      potg:
        final && game.potgPlayerId && nameOf(game.potgPlayerId)
          ? {
              playerId: game.potgPlayerId,
              name: shortName(game.potgPlayerId),
              jersey: String(jerseyOf(game.potgPlayerId)),
              photoUrl: game.potgPhotoUrl ?? null,
              line: fold.players[game.potgPlayerId]
                ? {
                    points: fold.players[game.potgPlayerId].points,
                    rebounds:
                      fold.players[game.potgPlayerId].offRebounds +
                      fold.players[game.potgPlayerId].defRebounds,
                    assists: fold.players[game.potgPlayerId].assists,
                  }
                : null,
              cardPath: `/api/live/${game.id}/card`,
            }
          : null,
      hasStats: Object.keys(fold.players).length > 0,
      linescore: {
        periods: displayPeriods.map((p) => ({ label: p <= 4 ? String(p) : periodLabel(p), played: played.has(p) })),
        rows: [
          { short: shortTeam(game.homeTeamName), color: game.homeColor, cells: displayPeriods.map((p) => (played.has(p) ? periodPoints(game.homeTeamId, p) : null)), total: homeScore },
          { short: shortTeam(game.awayTeamName), color: game.awayColor, cells: displayPeriods.map((p) => (played.has(p) ? periodPoints(game.awayTeamId, p) : null)), total: awayScore },
        ],
      },
      leaders,
      teamStats,
      box: [
        boxFor(game.homeTeamId, game.homeTeamName, game.homeColor, homeScore),
        boxFor(game.awayTeamId, game.awayTeamName, game.awayColor, awayScore),
      ],
      plays,
    })
  } catch (error) {
    console.error("Mobile game view error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
