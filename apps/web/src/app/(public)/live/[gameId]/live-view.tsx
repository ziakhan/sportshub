"use client"

import { useEffect, useMemo, useState } from "react"
import { foldEvents, totalRebounds, type FoldEvent } from "@/lib/scoring/fold"

/**
 * Public live scoreboard — polls the read API every 10s and folds the event
 * stream client-side with the SAME engine the console uses, so the numbers
 * can never disagree.
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
    homeTeamName: string
    awayTeamName: string
    venueName: string | null
    leagueName: string | null
  }
  events: FoldEvent[]
  players: LivePlayer[]
}

export function LiveView({ gameId }: { gameId: string }) {
  const [data, setData] = useState<LivePayload | null>(null)
  const [error, setError] = useState(false)
  const [canScore, setCanScore] = useState(false)

  // If the signed-in viewer has scoring access, point them at the console —
  // this page is read-only for everyone and that confuses scorekeepers.
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
  const label = (pid?: string | null) => {
    const p = pid ? byId.get(pid) : null
    return p ? `#${p.jerseyNumber ?? "?"} ${p.name}` : ""
  }

  const live = game.status === "LIVE"
  const final = game.status === "COMPLETED"
  const homeScore = final && game.homeScore != null ? game.homeScore : fold.homeScore
  const awayScore = final && game.awayScore != null ? game.awayScore : fold.awayScore

  const box = (teamId: string, teamName: string) => {
    const lines = Object.values(fold.players)
      .filter((l) => l.teamId === teamId)
      .sort((a, b) => b.points - a.points)
    if (lines.length === 0) return null
    return (
      <div className="border-ink-100 flex-1 overflow-x-auto rounded-2xl border bg-white p-4">
        <h3 className="text-ink-900 mb-2 text-sm font-semibold">{teamName}</h3>
        <table className="w-full text-xs">
          <thead className="text-ink-400 text-left text-[10px] uppercase tracking-wide">
            <tr>
              <th className="py-1 pr-2">Player</th>
              <th className="px-1 text-right">PTS</th>
              <th className="px-1 text-right">REB</th>
              <th className="px-1 text-right">AST</th>
              <th className="px-1 text-right">PF</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.playerId} className="border-ink-100 border-t">
                <td className="text-ink-800 py-1 pr-2">
                  {label(l.playerId) || l.playerId.slice(0, 6)}
                  {l.onFloor && live ? <span className="text-court-600"> ●</span> : null}
                </td>
                <td className="px-1 text-right font-semibold">{l.points}</td>
                <td className="px-1 text-right">{totalRebounds(l)}</td>
                <td className="px-1 text-right">{l.assists}</td>
                <td className="px-1 text-right">{l.fouls}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const playByPlay = [...fold.playByPlay]
    .filter((e) =>
      ["SCORE_2PT", "SCORE_3PT", "SCORE_FT", "FOUL", "SUBSTITUTION", "PERIOD_START", "PERIOD_END"].includes(
        e.eventType
      )
    )
    .reverse()
    .slice(0, 40)

  const describe = (e: FoldEvent): string => {
    switch (e.eventType) {
      case "SCORE_2PT":
      case "SCORE_3PT":
      case "SCORE_FT": {
        const pts = e.eventType === "SCORE_2PT" ? 2 : e.eventType === "SCORE_3PT" ? 3 : 1
        const who = label(e.playerId)
        return e.made === false
          ? `${who} misses ${e.eventType === "SCORE_FT" ? "a free throw" : `a ${pts}-pointer`}`
          : `${who} scores ${pts === 1 ? "a free throw" : `${pts}`}`
      }
      case "FOUL":
        return `Foul on ${label(e.playerId)}`
      case "SUBSTITUTION":
        return `Sub: ${label(e.metadata?.inPlayerId)} in for ${label(e.metadata?.outPlayerId)}`
      case "PERIOD_START":
        return `Period ${e.period} begins`
      case "PERIOD_END":
        return "Period ends"
      default:
        return e.eventType
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      {canScore && !final && (
        <a
          href={`/games/${gameId}/score`}
          className="bg-play-600 hover:bg-play-700 block rounded-2xl px-4 py-3 text-center text-sm font-bold text-white"
        >
          You can score this game — open the scoring console →
        </a>
      )}
      <div className="border-ink-100 rounded-2xl border bg-white p-5 text-center">
        {game.leagueName && <p className="text-ink-400 text-xs">{game.leagueName}</p>}
        <div className="mt-1 flex items-center justify-center gap-4">
          <div className="flex-1 text-right">
            <p className="text-ink-600 text-sm">{game.homeTeamName}</p>
            <p className="text-ink-950 text-4xl font-bold">{homeScore}</p>
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
            <p className="text-ink-600 text-sm">{game.awayTeamName}</p>
            <p className="text-ink-950 text-4xl font-bold">{awayScore}</p>
          </div>
        </div>
        {game.venueName && <p className="text-ink-400 mt-1 text-xs">{game.venueName}</p>}
      </div>

      {!live && !final && fold.playByPlay.length === 0 && (
        <div className="border-ink-100 rounded-2xl border bg-white p-6 text-center">
          <p className="text-ink-900 text-sm font-semibold">This game hasn&apos;t started yet</p>
          <p className="text-ink-500 mt-1 text-xs">
            Tip-off {new Date(game.scheduledAt).toLocaleString()}. The live score, box score and
            play-by-play will appear here automatically once the scorekeeper starts the game —
            keep this page open, it refreshes on its own.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row">
        {box(game.homeTeamId, game.homeTeamName)}
        {box(game.awayTeamId, game.awayTeamName)}
      </div>

      {playByPlay.length > 0 && (
        <div className="border-ink-100 rounded-2xl border bg-white p-4">
          <h3 className="text-ink-900 mb-2 text-sm font-semibold">Play-by-play</h3>
          <ul className="space-y-1">
            {playByPlay.map((e, i) => (
              <li key={i} className="text-ink-600 border-ink-50 border-b pb-1 text-xs">
                <span className="text-ink-400 mr-2">P{e.period ?? "–"}</span>
                {describe(e)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
