"use client"

import { BoxScore } from "./box-score"
import { GameLeaders } from "./game-leaders"
import { LatestPlays } from "./latest-plays"
import type { GameModel } from "./model"

/**
 * The Game view — the whole story of the game in one screen (2026-08-14).
 *
 * Desktop: box score left (~60%) with its team switcher, leaders and the
 * latest plays stacked in the right rail (~40%), so a 1440px page lands at
 * about a screen and a half instead of 2.6.
 *
 * Phones: one column, leaders first (compact face-off), then the box score
 * with a sticky switcher, then the latest plays. Placement is explicit grid
 * coordinates, so the two orders never fight.
 */
export function GameTab({
  model,
  boxSide,
  onBoxSide,
  onSeeAllPlays,
  stickyTopClass,
}: {
  model: GameModel
  boxSide: "home" | "away"
  onBoxSide: (side: "home" | "away") => void
  onSeeAllPlays: () => void
  stickyTopClass?: string
}) {
  return (
    // `grid-cols-1` is load-bearing on phones (audit 2026-08-14): a bare
    // `grid` sizes its single implicit column to the widest item's MAX-CONTENT,
    // so the box-score table stretched the column to 501px inside a 358px
    // page — the whole document went 517px wide, the navy hero stopped at
    // 390px with white beyond it, and every card looked squeezed. An explicit
    // `minmax(0,1fr)` track (plus `min-w-0` items) keeps the column at the
    // page width and hands overflow back to the table's own scroller.
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-4">
      <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:self-start">
        <GameLeaders model={model} />
      </div>
      <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start">
        <BoxScore
          model={model}
          side={boxSide}
          onSide={onBoxSide}
          stickyTopClass={stickyTopClass}
        />
      </div>
      <div className="min-w-0 lg:col-start-2 lg:row-start-2 lg:self-start">
        <LatestPlays model={model} onSeeAll={onSeeAllPlays} />
      </div>
    </div>
  )
}
