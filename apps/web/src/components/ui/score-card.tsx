import Link from "next/link"
import { cn } from "./cn"
import { Badge } from "./badge"
import { Crest } from "./crest"

export type GameStatus = "SCHEDULED" | "LIVE" | "FINAL" | "CANCELLED" | "DEFAULTED"

interface Side {
  name: string
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
  /**
   * There is a camera on this game right now (live-streaming plan, "Schedule
   * rows / game cards"). Callers pass the answer from ONE batched
   * `getStreamingGameIds()` lookup — never a per-card query.
   */
  streaming?: boolean
  className?: string
}

/** A lens, so the mark reads as "picture", not just another status colour. */
function LensGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2 7.5A2.5 2.5 0 0 1 4.5 5h8A2.5 2.5 0 0 1 15 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 2 16.5Z" />
      <path d="m15 10.5 6-3.6v10.2l-6-3.6" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The streaming mark. It lives in the card's top-right slot rather than beside
 * the status badge on purpose: a LIVE game would otherwise carry two chips
 * both reading "Live", and a SCHEDULED game whose camera is already hot needs
 * to keep saying "Upcoming" about the GAME while saying the picture is on.
 */
function WatchLiveBadge() {
  return (
    <Badge tone="live" dot icon={<LensGlyph />}>
      Watch live
    </Badge>
  )
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
        {/* Neutral monogram crest (owner ruling 2026-08-14): a score card is a
            summary, so identity is carried by the name and the winner's weight,
            never by a colour a club was assigned rather than chose. */}
        <Crest name={side.name} size="sm" className={cn(decided && !won && "opacity-60")} />
        <span
          className={cn(
            "truncate text-base",
            decided && won ? "text-ink-950 font-bold" : decided ? "text-ink-600 font-medium" : "text-ink-700 font-medium"
          )}
        >
          {side.name}
        </span>
      </div>
      {typeof side.score === "number" && (
        <span className="flex shrink-0 items-center gap-1.5">
          {decided && won && (
            <svg className="text-ink-950 h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-label="winner">
              <path d="M2 1l8 5-8 5z" transform="rotate(180 6 6)" />
            </svg>
          )}
          <span
            className={cn(
              "font-display tabular-nums",
              decided && won ? "text-ink-950 text-2xl font-bold" : "text-ink-500 text-2xl font-semibold"
            )}
          >
            {side.score}
          </span>
        </span>
      )}
    </div>
  )
}

/** A single game row — upcoming (date/venue) or played (scores + highlights). */
export function ScoreCard({ status, home, away, dateLabel, venue, highlightsHref, streaming, className }: ScoreCardProps) {
  const decided = status === "FINAL" || status === "DEFAULTED"
  const homeWon = decided && (home.score ?? 0) > (away.score ?? 0)
  const awayWon = decided && (away.score ?? 0) > (home.score ?? 0)

  return (
    <div className={cn("border-ink-100 rounded-2xl border bg-white p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <StatusBadge status={status} />
        {streaming ? (
          <WatchLiveBadge />
        ) : (
          dateLabel &&
          !decided &&
          status !== "LIVE" && (
            <span className="text-ink-600 text-[13px] font-medium">{dateLabel}</span>
          )
        )}
      </div>
      <div className="space-y-2">
        <TeamRow side={away} decided={decided} won={awayWon} />
        <TeamRow side={home} decided={decided} won={homeWon} />
      </div>
      {(venue || highlightsHref) && (
        <div className="border-ink-100 mt-3 flex items-center justify-between border-t pt-3">
          {venue ? (
            // min-w-0: without it this nowrap flex item's min-content is the
            // full venue string, which forces the card (and the page) wider
            // than a phone viewport — truncate alone doesn't shrink it.
            <span className="text-ink-600 min-w-0 truncate text-[13px]">{venue}</span>
          ) : (
            <span />
          )}
          {highlightsHref && (
            <Link
              href={highlightsHref}
              className="text-play-600 hover:text-play-700 inline-flex items-center gap-1 text-[13px] font-semibold"
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
