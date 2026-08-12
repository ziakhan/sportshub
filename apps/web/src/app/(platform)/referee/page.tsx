import Link from "next/link"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getRefereeGames, type RefereeGame } from "@/lib/queries/referee-games"
import { Badge, Button, Card, toneForStatus } from "@/components/ui"

export const dynamic = "force-dynamic"

/**
 * /referee — My games (QA T-012). The nav has always had a "My Games" tab for
 * referees, but it redirected to the shift inbox, so an accepted shift turned
 * into games the referee could only find inside the generic My Calendar. This
 * is the schedule that accepting produces: assigned games, next one first,
 * with the day, the floor and the rate that was agreed.
 *
 * Games come from lib/queries/referee-games, the same module My Calendar's
 * refereeing lens reads (parity law), so only PUBLISHED games ever show.
 */
export default async function RefereeGamesPage() {
  const auth = await getSessionUserId()
  if (!auth) redirect("/sign-in?callbackUrl=/referee")

  const { upcoming, past } = await getRefereeGames(auth.userId)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-ink-950 text-2xl font-bold">My games</h1>
          <p className="text-ink-500 mt-1 text-sm">
            Every game you&apos;re officiating, next one first. Games land here when a league
            books your shift and publishes that day&apos;s schedule.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button href="/referee/requests" variant="subtle" size="sm" icon={<IconWhistle />}>
            Shifts and availability
          </Button>
          <Link
            href="/referee/profile"
            className="text-play-600 rounded-lg px-1 py-1.5 text-sm font-semibold hover:underline"
          >
            My profile
          </Link>
        </div>
      </div>

      {upcoming.length === 0 ? (
        <Card className="border-dashed text-center">
          <h2 className="text-ink-900 font-semibold">No games on your schedule yet</h2>
          <p className="text-ink-500 mx-auto mt-2 max-w-md text-sm">
            {past.length > 0
              ? "Nothing coming up. Keep your availability current and answer offers to get booked on the next session."
              : "Leagues book referees by the day. Add your availability and answer shift offers, and the games you get assigned appear here."}
          </p>
          <div className="mt-5 flex justify-center">
            <Button href="/referee/requests" icon={<IconWhistle />}>
              Open shifts and availability
            </Button>
          </div>
        </Card>
      ) : (
        <section className="space-y-3">
          <h2 className="text-ink-400 text-xs font-semibold uppercase tracking-[0.12em]">
            Coming up ({upcoming.length})
          </h2>
          {upcoming.map((g) => (
            <GameRow key={g.id} game={g} />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <details className="group">
          <summary className="text-ink-500 hover:text-ink-900 flex cursor-pointer list-none items-center gap-2 rounded-lg py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <svg
              viewBox="0 0 24 24"
              className="text-ink-400 h-4 w-4 transition-transform group-open:rotate-90"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            Games you&apos;ve worked ({past.length})
          </summary>
          <div className="mt-2 space-y-3">
            {past.map((g) => (
              <GameRow key={g.id} game={g} past />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function GameRow({ game, past = false }: { game: RefereeGame; past?: boolean }) {
  const at = new Date(game.at)
  const where = [game.venue, game.court].filter(Boolean).join(" · ")
  const league = [game.leagueName, game.seasonLabel].filter(Boolean).join(" · ")
  const final =
    game.homeScore != null && game.awayScore != null
      ? `Final ${game.homeScore}-${game.awayScore}`
      : null

  return (
    <Link
      href={`/live/${game.id}`}
      className="border-ink-100 shadow-soft hover:border-play-200 hover:bg-ink-50/50 block cursor-pointer rounded-2xl border bg-white p-4 transition-colors duration-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={past ? "text-ink-600 text-sm font-semibold" : "text-ink-900 text-sm font-semibold"}>
          {format(at, "EEE, MMM d")} · {format(at, "h:mm a")}
        </p>
        <div className="flex items-center gap-2">
          {game.ratePerGame != null && (
            <span className="text-court-700 text-xs font-semibold">${game.ratePerGame}/game</span>
          )}
          {game.status === "LIVE" ? (
            <Badge tone="live" dot>
              Live
            </Badge>
          ) : game.status !== "SCHEDULED" ? (
            <Badge tone={toneForStatus(game.status)}>{game.status.toLowerCase()}</Badge>
          ) : null}
        </div>
      </div>
      <p className={past ? "text-ink-700 mt-1 font-medium" : "text-ink-950 mt-1 font-semibold"}>
        {game.homeTeam} vs {game.awayTeam}
      </p>
      <p className="text-ink-500 mt-0.5 text-xs">
        {where || "Venue to be confirmed"}
        {league ? ` · ${league}` : ""}
        {final ? ` · ${final}` : ""}
      </p>
    </Link>
  )
}

function IconWhistle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="7" cy="14" r="4" />
      <path d="M11 14h5a4 4 0 0 0 0-8h-2" />
      <circle cx="16" cy="8" r="1" />
    </svg>
  )
}
