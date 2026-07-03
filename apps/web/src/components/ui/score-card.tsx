import Link from "next/link"
import { cn } from "./cn"
import { Badge } from "./badge"

export type GameStatus = "SCHEDULED" | "LIVE" | "FINAL" | "CANCELLED" | "DEFAULTED"

interface Side {
  name: string
  /** Brand color for the team chip. */
  color?: string
  score?: number | null
}

interface ScoreCardProps {
  status: GameStatus
  home: Side
  away: Side
  /** Date/time label for SCHEDULED games, e.g. "Sat · 2:00 PM". */
  dateLabel?: string
  /** Venue/court line, e.g. "Maple Gym · Court 2". */
  venue?: string
  highlightsHref?: string
  className?: string
}

function StatusBadge({ status }: { status: GameStatus }) {
  switch (status) {
    case "LIVE":
      return <Badge tone="live" dot>Live</Badge>
    case "FINAL":
      return <Badge tone="neutral">Final</Badge>
    case "CANCELLED":
      return <Badge tone="danger">Cancelled</Badge>
    case "DEFAULTED":
      return <Badge tone="warning">Default</Badge>
    default:
      return <Badge tone="play">Upcoming</Badge>
  }
}

function TeamRow({ side, decided, won }: { side: Side; decided: boolean; won: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="h-6 w-6 shrink-0 rounded-lg"
          style={{ backgroundColor: side.color || "#4f46e5" }}
          aria-hidden="true"
        />
        <span
          className={cn(
            "truncate text-sm",
            decided && won ? "text-ink-950 font-bold" : "text-ink-700 font-medium"
          )}
        >
          {side.name}
        </span>
      </div>
      {typeof side.score === "number" && (
        <span
          className={cn(
            "font-display tabular-nums",
            decided && won ? "text-ink-950 text-2xl font-bold" : "text-ink-600 text-2xl font-semibold"
          )}
        >
          {side.score}
        </span>
      )}
    </div>
  )
}

/** A single game row — upcoming (date/venue) or played (scores + highlights). */
export function ScoreCard({ status, home, away, dateLabel, venue, highlightsHref, className }: ScoreCardProps) {
  const decided = status === "FINAL" || status === "DEFAULTED"
  const homeWon = decided && (home.score ?? 0) > (away.score ?? 0)
  const awayWon = decided && (away.score ?? 0) > (home.score ?? 0)

  return (
    <div className={cn("border-ink-100 rounded-2xl border bg-white p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <StatusBadge status={status} />
        {dateLabel && !decided && status !== "LIVE" && (
          <span className="text-ink-500 text-xs font-medium">{dateLabel}</span>
        )}
      </div>
      <div className="space-y-2">
        <TeamRow side={away} decided={decided} won={awayWon} />
        <TeamRow side={home} decided={decided} won={homeWon} />
      </div>
      {(venue || highlightsHref) && (
        <div className="border-ink-100 mt-3 flex items-center justify-between border-t pt-3">
          {venue ? (
            <span className="text-ink-400 truncate text-xs">{venue}</span>
          ) : (
            <span />
          )}
          {highlightsHref && (
            <Link
              href={highlightsHref}
              className="text-play-600 hover:text-play-700 inline-flex items-center gap-1 text-xs font-semibold"
            >
              Highlights
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
