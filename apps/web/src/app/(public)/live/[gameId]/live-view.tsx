"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { foldEvents, totalRebounds, type FoldEvent, type PlayerLine } from "@/lib/scoring/fold"

/**
 * Public game page, sports-app style (Bleacher Report / theScore / Yahoo):
 * score header with line score, Game Leaders, then Box Score / Play-by-Play
 * tabs with a team switcher. Polls every 10s and folds the event stream
 * client-side with the SAME engine the console uses.
 */

interface LivePlayer {
  playerId: string
  name: string
  jerseyNumber: string | null
}

interface LivePayload {
  game: {
    id: string
    status: string
    scheduledAt: string
    homeScore: number | null
    awayScore: number | null
    homeTeamId: string
    awayTeamId: string
    seasonId?: string | null
    homeTeamName: string
    awayTeamName: string
    venueName: string | null
    leagueName: string | null
  }
  events: FoldEvent[]
  players: LivePlayer[]
}

type Tab = "box" | "plays"

export function LiveView({ gameId }: { gameId: string }) {
  const [data, setData] = useState<LivePayload | null>(null)
  const [error, setError] = useState(false)
  const [canScore, setCanScore] = useState(false)
  const [tab, setTab] = useState<Tab>("box")
  const [boxSide, setBoxSide] = useState<"home" | "away">("home")

  useEffect(() => {
    fetch(`/api/games/${gameId}/scoring`)
      .then((res) => setCanScore(res.ok))
      .catch(() => {})
  }, [gameId])

  useEffect(() => {
    let stop = false
    async function poll() {
      try {
        const res = await fetch(`/api/live/${gameId}`)
        if (!res.ok) throw new Error()
        const payload = await res.json()
        if (!stop) {
          setData(payload)
          setError(false)
        }
      } catch {
        if (!stop) setError(true)
      }
    }
    poll()
    const t = setInterval(poll, 10_000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [gameId])

  const fold = useMemo(
    () =>
      data
        ? foldEvents(data.events, {
            homeTeamId: data.game.homeTeamId,
            awayTeamId: data.game.awayTeamId,
          })
        : null,
    [data]
  )

  if (!data || !fold) {
    return (
      <p className="text-ink-500 p-10 text-center text-sm">
        {error ? "Couldn't load this game." : "Loading…"}
      </p>
    )
  }

  const { game } = data
  const byId = new Map(data.players.map((p) => [p.playerId, p]))
  const nameOf = (pid?: string | null) => (pid ? byId.get(pid)?.name ?? "" : "")
  const jerseyOf = (pid: string) => byId.get(pid)?.jerseyNumber ?? "?"
  const shortName = (pid: string) => {
    const parts = (nameOf(pid) || "").split(" ")
    return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(-1)[0]}` : parts[0] || "—"
  }

  const live = game.status === "LIVE"
  const final = game.status === "COMPLETED"
  const homeScore = final && game.homeScore != null ? game.homeScore : fold.homeScore
  const awayScore = final && game.awayScore != null ? game.awayScore : fold.awayScore

  const periods = Array.from(
    new Set(fold.playByPlay.filter((e) => e.period).map((e) => e.period as number))
  ).sort((a, b) => a - b)
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

  const LEADER_STATS: Array<{ label: string; get: (l: PlayerLine) => number }> = [
    { label: "Points", get: (l) => l.points },
    { label: "Rebounds", get: (l) => totalRebounds(l) },
    { label: "Assists", get: (l) => l.assists },
  ]

  const hasAnyStats = Object.keys(fold.players).length > 0

  const leaderCell = (l: PlayerLine | null, value: number | null, align: "left" | "right") => (
    <div className={`flex-1 ${align === "right" ? "text-right" : ""}`}>
      {l ? (
        <>
          <p className="text-ink-900 truncate text-xs font-semibold">
            #{jerseyOf(l.playerId)} {shortName(l.playerId)}
          </p>
          <p className="text-ink-950 text-lg font-bold">{value}</p>
        </>
      ) : (
        <p className="text-ink-300 text-xs">—</p>
      )}
    </div>
  )

  const boxTeamId = boxSide === "home" ? game.homeTeamId : game.awayTeamId

  // One team's full stat table — phones show one at a time behind the
  // switcher; desktop lays both teams out in full (ESPN/Yahoo style).
  const statsTable = (teamId: string) => {
    const lines = teamLines(teamId)
    const showMinutes = lines.some((l) => l.secondsPlayed > 0)
    const totals = lines.reduce(
      (t, l) => ({
        pts: t.pts + l.points,
        reb: t.reb + totalRebounds(l),
        ast: t.ast + l.assists,
        stl: t.stl + l.steals,
        blk: t.blk + l.blocks,
        to: t.to + l.turnovers,
        pf: t.pf + l.fouls,
      }),
      { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0 }
    )
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs lg:text-sm">
          <thead className="text-ink-400 text-left text-[10px] uppercase lg:text-[11px]">
            <tr>
              <th className="py-1.5 pr-2">Player</th>
              {showMinutes && <th className="px-1.5 text-right">MIN</th>}
              <th className="px-1.5 text-right">PTS</th>
              <th className="px-1.5 text-right">REB</th>
              <th className="px-1.5 text-right">AST</th>
              <th className="px-1.5 text-right">STL</th>
              <th className="px-1.5 text-right">BLK</th>
              <th className="px-1.5 text-right">TO</th>
              <th className="px-1.5 text-right">PF</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.playerId} className="border-ink-100 border-t">
                <td className="text-ink-800 whitespace-nowrap py-1.5 pr-2">
                  <span className="text-ink-400 mr-1">#{jerseyOf(l.playerId)}</span>
                  <Link href={`/player/${l.playerId}`} className="hover:text-play-600 transition-colors">
                    {shortName(l.playerId)}
                  </Link>
                  {l.onFloor && live ? <span className="text-court-600"> ●</span> : null}
                </td>
                {showMinutes && (
                  <td className="px-1.5 text-right">{Math.round(l.secondsPlayed / 60)}</td>
                )}
                <td className="px-1.5 text-right font-semibold">{l.points}</td>
                <td className="px-1.5 text-right">{totalRebounds(l)}</td>
                <td className="px-1.5 text-right">{l.assists}</td>
                <td className="px-1.5 text-right">{l.steals}</td>
                <td className="px-1.5 text-right">{l.blocks}</td>
                <td className="px-1.5 text-right">{l.turnovers}</td>
                <td className="px-1.5 text-right">
                  {l.fouls}
                  {l.technicalFouls > 0 ? "T" : ""}
                </td>
              </tr>
            ))}
            <tr className="border-ink-200 text-ink-900 border-t font-bold">
              <td className="py-1.5 pr-2">Team</td>
              {showMinutes && <td />}
              <td className="px-1.5 text-right">{totals.pts}</td>
              <td className="px-1.5 text-right">{totals.reb}</td>
              <td className="px-1.5 text-right">{totals.ast}</td>
              <td className="px-1.5 text-right">{totals.stl}</td>
              <td className="px-1.5 text-right">{totals.blk}</td>
              <td className="px-1.5 text-right">{totals.to}</td>
              <td className="px-1.5 text-right">{totals.pf}</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  const playByPlay = [...fold.playByPlay]
    .filter((e) =>
      [
        "SCORE_2PT",
        "SCORE_3PT",
        "SCORE_FT",
        "FOUL",
        "SUBSTITUTION",
        "PERIOD_START",
        "PERIOD_END",
      ].includes(e.eventType)
    )
    .reverse()

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
          e.metadata?.technical ? " (technical)" : ""
        }`
      case "SUBSTITUTION":
        return `Sub: ${e.metadata?.inPlayerId ? `#${jerseyOf(e.metadata.inPlayerId)}` : "?"} in, ${
          e.metadata?.outPlayerId ? `#${jerseyOf(e.metadata.outPlayerId)}` : "?"
        } out`
      case "PERIOD_START":
        return `— Period ${e.period} —`
      case "PERIOD_END":
        return "— End of period —"
      default:
        return e.eventType
    }
  }

  const sideDot = (teamId?: string | null) =>
    teamId === game.homeTeamId ? (
      <span className="bg-play-400 mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" />
    ) : teamId === game.awayTeamId ? (
      <span className="bg-court-400 mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" />
    ) : (
      <span className="mr-3" />
    )

  return (
    // Phone-first column; on desktop it widens and splits into box score +
    // play-by-play rail (the tab UI is a small-screen affordance only).
    <div className="mx-auto max-w-3xl space-y-3 p-3 lg:max-w-6xl lg:space-y-4 lg:px-6 lg:py-6">
      {canScore && !final && (
        <a
          href={`/games/${gameId}/score`}
          className="bg-play-600 hover:bg-play-700 block rounded-2xl px-4 py-3 text-center text-sm font-bold text-white"
        >
          You can score this game — open the scoring console →
        </a>
      )}

      {/* score header */}
      <div className="border-ink-100 rounded-2xl border bg-white p-4">
        {game.leagueName &&
          (game.seasonId ? (
            <p className="text-center text-[11px]">
              <Link href={`/league/${game.seasonId}`} className="text-ink-400 hover:text-play-600 underline-offset-2 hover:underline">
                {game.leagueName}
              </Link>
            </p>
          ) : (
            <p className="text-ink-400 text-center text-[11px]">{game.leagueName}</p>
          ))}
        <div className="mt-1 flex items-center justify-center gap-5 lg:gap-10">
          <div className="flex-1 text-right">
            <p className="text-ink-700 text-sm font-semibold lg:text-base">
              <Link href={`/team/${game.homeTeamId}`} className="hover:text-play-600 transition-colors">
                {game.homeTeamName}
              </Link>{" "}
              <span className="bg-play-400 ml-1 inline-block h-2 w-2 rounded-full" />
            </p>
            <p className="text-ink-950 text-4xl font-bold lg:text-6xl">{homeScore}</p>
          </div>
          <div className="text-center">
            {live && (
              <span className="bg-hoop-50 text-hoop-700 rounded-full px-2 py-0.5 text-[10px] font-bold">
                ● LIVE · P{fold.period}
              </span>
            )}
            {final && (
              <span className="bg-ink-100 text-ink-700 rounded-full px-2 py-0.5 text-[10px] font-bold">
                FINAL
              </span>
            )}
            {!live && !final && (
              <span className="text-ink-400 text-[10px]">
                {new Date(game.scheduledAt).toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-ink-700 text-sm font-semibold lg:text-base">
              <span className="bg-court-400 mr-1 inline-block h-2 w-2 rounded-full" />{" "}
              <Link href={`/team/${game.awayTeamId}`} className="hover:text-play-600 transition-colors">
                {game.awayTeamName}
              </Link>
            </p>
            <p className="text-ink-950 text-4xl font-bold lg:text-6xl">{awayScore}</p>
          </div>
        </div>

        {/* line score */}
        {periods.length > 0 && (
          <table className="mx-auto mt-3 border-collapse text-center text-xs">
            <thead>
              <tr className="text-ink-400 text-[10px]">
                <th className="px-2 py-0.5 text-left"></th>
                {periods.map((p) => (
                  <th key={p} className="px-2 py-0.5 font-semibold">
                    {p <= 4 ? `Q${p}` : `OT${p - 4}`}
                  </th>
                ))}
                <th className="px-2 py-0.5 font-bold">T</th>
              </tr>
            </thead>
            <tbody className="text-ink-700">
              <tr className="border-ink-100 border-t">
                <td className="px-2 py-0.5 text-left font-semibold">
                  {game.homeTeamName.slice(0, 14)}
                </td>
                {periods.map((p) => (
                  <td key={p} className="px-2 py-0.5">
                    {periodPoints(game.homeTeamId, p)}
                  </td>
                ))}
                <td className="px-2 py-0.5 font-bold">{homeScore}</td>
              </tr>
              <tr className="border-ink-100 border-t">
                <td className="px-2 py-0.5 text-left font-semibold">
                  {game.awayTeamName.slice(0, 14)}
                </td>
                {periods.map((p) => (
                  <td key={p} className="px-2 py-0.5">
                    {periodPoints(game.awayTeamId, p)}
                  </td>
                ))}
                <td className="px-2 py-0.5 font-bold">{awayScore}</td>
              </tr>
            </tbody>
          </table>
        )}

        {game.venueName && (
          <p className="text-ink-400 mt-2 text-center text-[10px]">{game.venueName}</p>
        )}
        {/* No scoresheet link here — the official sheet is league/club-only
            (linked from the scoring console and the finalize email). */}
      </div>

      {!live && !final && fold.playByPlay.length === 0 && (
        <div className="border-ink-100 rounded-2xl border bg-white p-6 text-center">
          <p className="text-ink-900 text-sm font-semibold">This game hasn&apos;t started yet</p>
          <p className="text-ink-500 mt-1 text-xs">
            Tip-off {new Date(game.scheduledAt).toLocaleString()}. Live score, leaders and the box
            score will appear here automatically — this page refreshes on its own.
          </p>
        </div>
      )}

      {/* Leaders + box score (main column) with play-by-play alongside on
          desktop; on small screens the two panels collapse into tabs. */}
      {hasAnyStats && (
      <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-4 lg:space-y-0">
      <div className="space-y-3 lg:space-y-4">
        <div className="border-ink-100 rounded-2xl border bg-white p-4">
          <h3 className="text-ink-400 mb-2 text-[10px] font-bold uppercase tracking-wider">
            Game leaders
          </h3>
          <div className="space-y-2">
            {LEADER_STATS.map(({ label, get }) => {
              const h = leaderOf(game.homeTeamId, get)
              const a = leaderOf(game.awayTeamId, get)
              if (!h && !a) return null
              return (
                <div key={label} className="border-ink-50 flex items-center gap-3 border-b pb-2 last:border-0 last:pb-0">
                  {leaderCell(h, h ? get(h) : null, "left")}
                  <p className="text-ink-400 w-20 shrink-0 text-center text-[10px] font-semibold uppercase">
                    {label}
                  </p>
                  {leaderCell(a, a ? get(a) : null, "right")}
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-ink-100 rounded-2xl border bg-white">
          <div className="border-ink-100 flex border-b lg:hidden">
            {(
              [
                ["box", "Box score"],
                ["plays", "Play-by-play"],
              ] as Array<[Tab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-2.5 text-sm font-semibold ${
                  tab === key
                    ? "text-play-700 border-play-600 border-b-2"
                    : "text-ink-400 hover:text-ink-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <h3 className="text-ink-400 hidden px-4 pt-4 text-[10px] font-bold uppercase tracking-wider lg:block">
            Box score
          </h3>

          <div className={`${tab === "box" ? "block" : "hidden"} lg:block`}>
            {/* phone: one team at a time behind a switcher */}
            <div className="p-3 lg:hidden">
              <div className="bg-ink-50 mb-2 flex rounded-xl p-0.5">
                {(["home", "away"] as const).map((side) => (
                  <button
                    key={side}
                    onClick={() => setBoxSide(side)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${
                      boxSide === side ? "text-ink-900 bg-white shadow-sm" : "text-ink-500"
                    }`}
                  >
                    {side === "home" ? game.homeTeamName : game.awayTeamName}
                  </button>
                ))}
              </div>
              {statsTable(boxTeamId)}
            </div>

            {/* desktop: both teams laid out in full */}
            <div className="hidden space-y-7 p-4 pt-3 lg:block">
              <div>
                <h4 className="text-ink-900 mb-1 text-sm font-bold">
                  <span className="bg-play-400 mr-1.5 inline-block h-2 w-2 rounded-full" />
                  {game.homeTeamName}
                </h4>
                {statsTable(game.homeTeamId)}
              </div>
              <div>
                <h4 className="text-ink-900 mb-1 text-sm font-bold">
                  <span className="bg-court-400 mr-1.5 inline-block h-2 w-2 rounded-full" />
                  {game.awayTeamName}
                </h4>
                {statsTable(game.awayTeamId)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* play-by-play — right rail on desktop, "Plays" tab on mobile */}
      <div
        className={`border-ink-100 rounded-2xl border bg-white ${
          tab === "plays" ? "block" : "hidden"
        } lg:sticky lg:top-[76px] lg:block`}
      >
        <h3 className="text-ink-400 hidden px-4 pt-4 text-[10px] font-bold uppercase tracking-wider lg:block">
          Play-by-play
        </h3>
        <ul className="max-h-[420px] overflow-y-auto p-3 lg:max-h-[calc(100vh-180px)] lg:px-4">
          {playByPlay.map((e, i) => (
            <li
              key={i}
              className={`border-ink-50 border-b py-1.5 text-xs last:border-0 ${
                e.eventType.startsWith("PERIOD")
                  ? "text-ink-400 text-center font-semibold"
                  : "text-ink-700"
              }`}
            >
              {!e.eventType.startsWith("PERIOD") && sideDot(e.teamId)}
              {describe(e)}
            </li>
          ))}
        </ul>
      </div>
      </div>
      )}
    </div>
  )
}
