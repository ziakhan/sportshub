"use client"

import { format } from "date-fns"

const TIEBREAKER_OPTIONS: { key: string; label: string }[] = [
  { key: "HEAD_TO_HEAD", label: "Head-to-head record" },
  { key: "POINT_DIFFERENTIAL", label: "Point differential" },
  { key: "POINTS_SCORED", label: "Points scored" },
  { key: "POINTS_ALLOWED", label: "Points allowed (fewest)" },
  { key: "WINS", label: "Total wins" },
  { key: "COIN_FLIP", label: "Coin flip (last resort)" },
]

export function TiebreakersTab({
  league,
  patchSeason,
}: {
  league: any
  patchSeason: (body: Record<string, any>) => Promise<void>
}) {
  const moveTiebreaker = (idx: number, direction: -1 | 1) => {
    const order: string[] = Array.isArray(league?.tiebreakerOrder) ? [...league.tiebreakerOrder] : []
    const target = idx + direction
    if (target < 0 || target >= order.length) return
    ;[order[idx], order[target]] = [order[target], order[idx]]
    patchSeason({ tiebreakerOrder: order })
  }

  const addTiebreaker = (key: string) => {
    const order: string[] = Array.isArray(league?.tiebreakerOrder) ? [...league.tiebreakerOrder] : []
    if (order.includes(key)) return
    order.push(key)
    patchSeason({ tiebreakerOrder: order })
  }

  const removeTiebreaker = (key: string) => {
    const order: string[] = Array.isArray(league?.tiebreakerOrder) ? [...league.tiebreakerOrder] : []
    patchSeason({ tiebreakerOrder: order.filter((k) => k !== key) })
  }

  return (
    <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-ink-900 font-semibold">Tiebreaker order</h3>
          <p className="text-ink-500 mt-0.5 text-xs">
            Used to rank teams with identical records. Applied top-to-bottom until one team
            wins the tiebreaker.
          </p>
        </div>
        {league.tiebreakersLockedAt && (
          <span className="bg-hoop-50 text-hoop-700 rounded-full px-3 py-1 text-xs font-medium">
            Locked {format(new Date(league.tiebreakersLockedAt), "MMM d, yyyy")}
          </span>
        )}
      </div>

      {Array.isArray(league.tiebreakerOrder) && league.tiebreakerOrder.length > 0 ? (
        <ol className="space-y-2">
          {league.tiebreakerOrder.map((key: string, idx: number) => {
            const opt = TIEBREAKER_OPTIONS.find((o) => o.key === key)
            const locked = !!league.tiebreakersLockedAt
            return (
              <li
                key={key}
                className="border-court-100 bg-court-50 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
              >
                <span className="text-ink-900">
                  <span className="text-ink-400 mr-2 font-mono text-xs">{idx + 1}.</span>
                  {opt?.label ?? key}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => moveTiebreaker(idx, -1)}
                    disabled={idx === 0 || locked}
                    className="text-ink-500 hover:text-ink-700 text-xs disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveTiebreaker(idx, 1)}
                    disabled={idx === league.tiebreakerOrder.length - 1 || locked}
                    className="text-ink-500 hover:text-ink-700 text-xs disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeTiebreaker(key)}
                    disabled={locked}
                    className="text-xs text-red-500 hover:text-red-600 disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="text-ink-500 text-sm">No tiebreakers configured.</p>
      )}

      <div className="border-ink-200 mt-4 border-t pt-4">
        <p className="text-ink-600 mb-2 text-xs font-medium">Add a tiebreaker</p>
        <div className="flex flex-wrap gap-2">
          {TIEBREAKER_OPTIONS.filter(
            (o) => !(league.tiebreakerOrder ?? []).includes(o.key)
          ).map((opt) => (
            <button
              key={opt.key}
              disabled={!!league.tiebreakersLockedAt}
              onClick={() => addTiebreaker(opt.key)}
              className="border-ink-200 text-ink-700 hover:border-play-300 hover:text-play-700 rounded-full border px-3 py-1 text-xs transition disabled:opacity-50"
            >
              + {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
