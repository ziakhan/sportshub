import Link from "next/link"
import { cn } from "./cn"

export interface StandingsRow {
  rank: number
  name: string
  /** Team hub link — names render as anchors when present. */
  href?: string
  color?: string
  wins: number
  losses: number
  /** Win percentage 0–1; rendered as .XXX. Optional. */
  pct?: number
  /** Games back. Optional. */
  gamesBack?: number | string
  /** Short streak label, e.g. "W3". Optional. */
  streak?: string
}

interface StandingsTableProps {
  rows: StandingsRow[]
  /** Accent the top row(s) in gold. */
  highlightLeaders?: number
  className?: string
}

function pctLabel(pct?: number) {
  if (typeof pct !== "number") return "—"
  return pct.toFixed(3).replace(/^0/, "")
}

/**
 * Division standings table — shared by league and team hubs.
 * Phone shape (responsive-design-concept.md, Shape 2): every column always
 * exists; the identity column (rank + team) is sticky and the stat block
 * scrolls INSIDE the card with an edge fade. No column silently drops, and
 * the page itself never scrolls sideways.
 */
export function StandingsTable({ rows, highlightLeaders = 1, className }: StandingsTableProps) {
  return (
    <div className={cn("border-ink-100 relative overflow-hidden rounded-2xl border bg-white", className)}>
      <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[430px] text-[15px]">
          <thead>
            <tr className="border-ink-100 text-ink-500 border-b text-left text-[11.5px] uppercase tracking-[0.12em]">
              <th className="sticky left-0 z-10 bg-white px-4 py-3 font-extrabold">Team</th>
              <th className="px-2 py-3 text-center font-extrabold">W</th>
              <th className="px-2 py-3 text-center font-extrabold">L</th>
              <th className="px-2 py-3 text-center font-extrabold">PCT</th>
              <th className="px-2 py-3 text-center font-extrabold">GB</th>
              <th className="px-4 py-3 text-center font-extrabold">STRK</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const leader = row.rank <= highlightLeaders
              return (
                <tr
                  key={row.rank}
                  className={cn("border-ink-50 border-b last:border-0", leader && "bg-highlight-soft")}
                >
                  {/* Sticky identity cell needs an OPAQUE bg to cover the
                      stats sliding beneath it */}
                  <td className={cn("sticky left-0 z-10 px-4 py-3", leader ? "bg-highlight-soft" : "bg-white")}>
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "font-display w-5 shrink-0 text-right tabular-nums text-base font-bold",
                          leader ? "text-gold-600" : "text-ink-400"
                        )}
                      >
                        {row.rank}
                      </span>
                      <span
                        className="h-5 w-5 shrink-0 rounded-md"
                        style={{ backgroundColor: row.color || "#4f46e5" }}
                        aria-hidden="true"
                      />
                      {row.href ? (
                        <Link
                          href={row.href}
                          className="text-ink-950 hover:text-play-600 font-bold transition-colors"
                        >
                          {row.name}
                        </Link>
                      ) : (
                        <span className="text-ink-950 font-bold">{row.name}</span>
                      )}
                    </div>
                  </td>
                  <td className="text-energy-ink px-2 py-3 text-center font-extrabold tabular-nums">{row.wins}</td>
                  <td className="text-ink-700 px-2 py-3 text-center font-bold tabular-nums">{row.losses}</td>
                  <td className="text-ink-900 px-2 py-3 text-center font-bold tabular-nums">{pctLabel(row.pct)}</td>
                  <td className="text-ink-500 px-2 py-3 text-center tabular-nums">{row.gamesBack ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {row.streak ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-extrabold",
                          row.streak.startsWith("W")
                            ? "bg-court-100 text-court-700"
                            : row.streak.startsWith("L")
                              ? "bg-hoop-50 text-hoop-700"
                              : "text-ink-500"
                        )}
                      >
                        {row.streak}
                      </span>
                    ) : (
                      <span className="text-ink-400 text-xs font-semibold">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* Scroll affordance on phones; the table fits without it on sm+ */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-2xl bg-gradient-to-l from-white to-transparent sm:hidden" />
    </div>
  )
}
