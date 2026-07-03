import { cn } from "./cn"

export interface StandingsRow {
  rank: number
  name: string
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

/** Division standings table — shared by league and team hubs. */
export function StandingsTable({ rows, highlightLeaders = 1, className }: StandingsTableProps) {
  return (
    <div className={cn("border-ink-100 overflow-hidden rounded-2xl border bg-white", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-ink-100 text-ink-400 border-b text-left text-xs uppercase tracking-[0.12em]">
            <th className="px-4 py-3 font-semibold">#</th>
            <th className="px-2 py-3 font-semibold">Team</th>
            <th className="px-2 py-3 text-center font-semibold">W</th>
            <th className="px-2 py-3 text-center font-semibold">L</th>
            <th className="px-2 py-3 text-center font-semibold">PCT</th>
            <th className="hidden px-2 py-3 text-center font-semibold sm:table-cell">GB</th>
            <th className="hidden px-4 py-3 text-center font-semibold sm:table-cell">STRK</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const leader = row.rank <= highlightLeaders
            return (
              <tr
                key={row.rank}
                className={cn(
                  "border-ink-50 border-b last:border-0",
                  leader && "bg-gold-50/50"
                )}
              >
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "font-display tabular-nums text-base font-bold",
                      leader ? "text-gold-600" : "text-ink-400"
                    )}
                  >
                    {row.rank}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-5 w-5 shrink-0 rounded-md"
                      style={{ backgroundColor: row.color || "#4f46e5" }}
                      aria-hidden="true"
                    />
                    <span className="text-ink-900 font-semibold">{row.name}</span>
                  </div>
                </td>
                <td className="text-ink-700 px-2 py-3 text-center font-semibold tabular-nums">{row.wins}</td>
                <td className="text-ink-700 px-2 py-3 text-center font-semibold tabular-nums">{row.losses}</td>
                <td className="text-ink-900 px-2 py-3 text-center font-semibold tabular-nums">{pctLabel(row.pct)}</td>
                <td className="text-ink-500 hidden px-2 py-3 text-center tabular-nums sm:table-cell">
                  {row.gamesBack ?? "—"}
                </td>
                <td className="hidden px-4 py-3 text-center sm:table-cell">
                  <span className="text-ink-500 text-xs font-semibold">{row.streak ?? "—"}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
