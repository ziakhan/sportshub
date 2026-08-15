"use client"

import { Panel } from "./ui-bits"
import type { GameModel } from "./model"

/**
 * Latest plays — the last five entries of the stream, shown next to the box
 * score so the desktop page tells the whole game story without a tab change
 * (owner 2026-08-14). The full feed, filters and all, stays one tap away.
 */

const PREVIEW_COUNT = 5

export function LatestPlays({ model, onSeeAll }: { model: GameModel; onSeeAll: () => void }) {
  const { playByPlay, describe, game } = model
  const homeTeamId = game.homeTeamId
  const rows = playByPlay.slice(0, PREVIEW_COUNT)

  return (
    <Panel
      title="Latest plays"
      action={
        <button
          onClick={onSeeAll}
          className="text-play-600 hover:text-play-800 cursor-pointer text-[12.5px] font-semibold transition-colors"
        >
          See all plays
        </button>
      }
    >
      <ul className="divide-ink-50 divide-y">
        {rows.map(({ e, score, tail }, i) =>
          e.eventType.startsWith("PERIOD") ? (
            <li
              key={i}
              className="bg-ink-50 text-ink-600 px-4 py-1.5 text-center text-[10.5px] font-bold uppercase tracking-[0.18em]"
            >
              {e.eventType === "PERIOD_START" ? describe(e) : "End of period"}
            </li>
          ) : (
            <li
              key={i}
              className={`flex items-center gap-2.5 px-3.5 py-2 text-[13px] sm:px-4 ${
                score ? "text-ink-950 font-medium" : "text-ink-600"
              }`}
            >
              {/* Which side made the play is already in the sentence next to
                  it, so the rail is a neutral tick, not a club colour (owner
                  ruling 2026-08-14). */}
              <span
                className={`w-1 self-stretch rounded-full ${
                  e.teamId === homeTeamId ? "bg-ink-400" : "bg-ink-200"
                }`}
              />
              <span className="min-w-0 flex-1">
                {describe(e)}
                {tail}
              </span>
              {score && (
                <span className="font-condensed text-ink-950 shrink-0 text-[15px] font-semibold tabular-nums">
                  {score}
                </span>
              )}
            </li>
          )
        )}
        {rows.length === 0 && (
          <li className="text-ink-500 px-4 py-6 text-center text-[13px]">No plays yet.</li>
        )}
      </ul>
    </Panel>
  )
}
