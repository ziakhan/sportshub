"use client"

import Link from "next/link"
import { monogram } from "@/lib/content/matchup-cover"
import type { GameModel } from "./model"

/**
 * Pre-game view: both rosters with season averages, instead of an empty box
 * score. Shown for SCHEDULED games that have no events yet.
 */

function RosterTable({ model, teamId }: { model: GameModel; teamId: string }) {
  const { data } = model
  const roster = data.players
    .filter((p) => p.teamId === teamId)
    .map((p) => ({ ...p, avg: data.seasonAverages[p.playerId] }))
    .sort((a, b) => (b.avg?.ppg ?? 0) - (a.avg?.ppg ?? 0))
  if (roster.length === 0) {
    return <p className="text-ink-500 px-4 py-6 text-center text-[13px]">Roster not submitted yet.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[15px] tabular-nums">
        <thead className="text-ink-500 text-left text-[11.5px] uppercase tracking-wide">
          <tr>
            <th className="py-2 pl-4 pr-2 font-bold">Player</th>
            <th className="px-1.5 text-right font-bold">GP</th>
            <th className="px-1.5 text-right font-bold">PPG</th>
            <th className="px-1.5 text-right font-bold">RPG</th>
            <th className="px-1.5 pr-4 text-right font-bold">APG</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((p) => (
            <tr key={p.playerId} className="border-ink-50 hover:bg-ink-50 border-t transition-colors">
              <td className="text-ink-900 whitespace-nowrap py-2 pl-4 pr-2 font-semibold">
                <span className="text-ink-500 mr-1.5 font-normal">
                  {p.jerseyNumber ? `#${p.jerseyNumber}` : ""}
                </span>
                <Link href={`/player/${p.playerId}`} className="hover:text-play-600 transition-colors">
                  {p.name}
                </Link>
              </td>
              <td className="px-1.5 text-right">{p.avg?.gp ?? 0}</td>
              <td className="text-ink-950 px-1.5 text-right font-bold">{p.avg?.ppg ?? "—"}</td>
              <td className="px-1.5 text-right">{p.avg?.rpg ?? "—"}</td>
              <td className="px-1.5 pr-4 text-right">{p.avg?.apg ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PregameRosters({ model }: { model: GameModel }) {
  const { game, colorOf } = model
  return (
    <>
      <div className="border-ink-100 rounded-2xl border bg-white p-6 text-center">
        <p className="text-ink-900 text-sm font-semibold">This game hasn&apos;t started yet</p>
        <p className="text-ink-500 mt-1 text-xs">
          Live score, leaders and the box score appear here automatically at tip-off — the page
          refreshes on its own. Season numbers below.
        </p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(
          [
            [game.homeTeamId, game.homeTeamName],
            [game.awayTeamId, game.awayTeamName],
          ] as Array<[string, string]>
        ).map(([tid, tname]) => (
          <div key={tid} className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
            <div
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-extrabold text-white"
              style={{ backgroundColor: colorOf(tid) }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/25 text-[11px]">
                {monogram(tname)}
              </span>
              <Link href={`/team/${tid}`} className="truncate hover:underline">
                {tname}
              </Link>
            </div>
            <RosterTable model={model} teamId={tid} />
          </div>
        ))}
      </div>
    </>
  )
}
