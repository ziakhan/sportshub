"use client"

import Link from "next/link"
import type { GameModel } from "./model"

/**
 * Player of the Game (social-feed-plan P1) + the family share row (P2).
 * Both only ever render on a finished game.
 */

export function PotgCard({ model }: { model: GameModel }) {
  const { game, fold, nameOf, jerseyOf } = model
  if (!game.potgPlayerId || !nameOf(game.potgPlayerId)) return null
  const line = fold.players[game.potgPlayerId]
  return (
    <div className="border-gold-300 from-gold-50 flex items-center gap-4 rounded-2xl border bg-gradient-to-r to-white p-4">
      {game.potgPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={game.potgPhotoUrl}
          alt={nameOf(game.potgPlayerId)}
          className="border-gold-400 h-16 w-16 rounded-full border-2 object-cover"
        />
      ) : (
        <div className="bg-gold-100 text-gold-700 flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold">
          #{jerseyOf(game.potgPlayerId)}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-gold-700 text-[10.5px] font-bold uppercase tracking-[0.2em]">
          🏀 Player of the Game
        </p>
        <Link
          href={`/player/${game.potgPlayerId}`}
          className="text-ink-950 block truncate text-[17px] font-semibold hover:underline"
        >
          #{jerseyOf(game.potgPlayerId)} {nameOf(game.potgPlayerId)}
        </Link>
        {line && (
          <p className="text-ink-500 text-[12px] font-medium uppercase tracking-[0.08em]">
            {line.points} PTS · {line.offRebounds + line.defRebounds} REB · {line.assists} AST
          </p>
        )}
      </div>
    </div>
  )
}

/** Shown to the family of players who played in this final. */
export function ShareRow({
  model,
  onShare,
}: {
  model: GameModel
  onShare: (playerId: string) => void
}) {
  const { data, fold, game, nameOf } = model
  const mine = (data.viewerPlayerIds ?? []).filter((pid) => fold.players[pid])
  if (mine.length === 0) return null
  return (
    <div className="border-ink-100 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3">
      <span className="text-ink-500 text-xs font-semibold uppercase tracking-[0.14em]">Share</span>
      {mine.map((pid) => (
        <button
          key={pid}
          onClick={() => onShare(pid)}
          className="border-play-200 bg-play-50 text-play-700 hover:bg-play-100 flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-3.5 w-3.5"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
          </svg>
          {nameOf(pid)}&apos;s game card
          {pid === game.potgPlayerId ? " 🏀" : ""}
        </button>
      ))}
    </div>
  )
}
