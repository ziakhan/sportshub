"use client"

import type { GameModel } from "./model"

/**
 * Play-by-play — its own full-width view, free to run long. Filters: All,
 * Scoring, then one chip per period played.
 */

export type PlayFilter = "all" | "scoring" | number

export function PlayByPlayTab({
  model,
  filter,
  onFilter,
}: {
  model: GameModel
  filter: PlayFilter
  onFilter: (f: PlayFilter) => void
}) {
  const { playByPlay, periods, periodLabel, describe, colorOf } = model
  const visible = playByPlay.filter(({ e, score }) => {
    if (filter === "all") return true
    if (filter === "scoring") return score !== null || e.eventType.startsWith("PERIOD")
    return e.period === filter
  })

  return (
    <div className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
      <div className="border-ink-100 flex items-center gap-1.5 overflow-x-auto border-b px-4 py-2.5">
        {(
          [
            ["all", "All"],
            ["scoring", "Scoring"],
            ...periods.map((p) => [p, periodLabel(p)] as [number, string]),
          ] as Array<[PlayFilter, string]>
        ).map(([key, label]) => (
          <button
            key={String(key)}
            onClick={() => onFilter(key)}
            aria-pressed={filter === key}
            className={`min-h-[36px] cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              filter === key
                ? "bg-ink-950 text-white shadow-sm"
                : "text-ink-600 border-ink-200 hover:border-ink-400 border bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="max-h-[70vh] overflow-y-auto">
        {visible.map(({ e, score, tail }, i) =>
          e.eventType.startsWith("PERIOD") ? (
            <li
              key={i}
              className="bg-ink-200/80 text-ink-700 border-ink-300 sticky top-0 z-10 border-y px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[0.2em] backdrop-blur-sm"
            >
              {e.eventType === "PERIOD_START" ? describe(e) : "End of period"}
            </li>
          ) : (
            <li
              key={i}
              className={`border-ink-50 flex items-center gap-2.5 border-b px-3.5 py-2 text-[13.5px] sm:px-4 ${
                score ? "bg-ink-50/60 text-ink-950 font-medium" : "text-ink-600"
              }`}
            >
              <span
                className="w-1 self-stretch rounded-full"
                style={{ backgroundColor: colorOf(e.teamId) }}
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
        {visible.length === 0 && (
          <li className="text-ink-500 px-4 py-6 text-center text-[13px]">No plays yet.</li>
        )}
      </ul>
    </div>
  )
}
