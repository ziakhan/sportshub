import Link from "next/link"
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSeasonLeaders } from "@/lib/queries/season-stats"
import { getViewerScope, isParticipant } from "@/lib/privacy/participants"
import { playerDisplayName } from "@/lib/privacy/names"
import { Card, SectionHeader } from "@/components/ui"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { id: string } }) {
  const leaders = await getSeasonLeaders(params.id)
  if (!leaders) return { title: "Leaders — SportsHub" }
  return {
    title: `${leaders.season.leagueName} ${leaders.season.label} — Stat Leaders — SportsHub`,
    description: `Points, rebounds, assists, steals and blocks leaders for ${leaders.season.leagueName} ${leaders.season.label}.`,
  }
}

export default async function LeagueLeadersPage({ params }: { params: { id: string } }) {
  const leaders = await getSeasonLeaders(params.id)
  if (!leaders) notFound()

  const session = await getServerSession(authOptions)
  const scope = await getViewerScope((session?.user as any)?.id ?? null)
  const participant = isParticipant(scope, { leagueId: leaders.season.leagueId })

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6">
      <div className="mb-6">
        <Link href={`/league/${params.id}`} className="text-hoop-600 text-sm hover:underline">
          &larr; {leaders.season.leagueName} {leaders.season.label}
        </Link>
      </div>

      <SectionHeader
        eyebrow="Stat leaders"
        title={`${leaders.season.leagueName} leaders`}
        description={`Per-game leaders across ${leaders.completedGames} completed game${
          leaders.completedGames === 1 ? "" : "s"
        }. Players must appear in at least half of their team's games to qualify.`}
        accent="gold"
        className="mb-10"
      />

      {leaders.categories.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-ink-500">
            No completed games with player stats yet — leaders appear as soon as games are scored.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {leaders.categories.map((cat) => (
            <Card key={cat.key} className="overflow-hidden p-0">
              <div className="border-ink-100 flex items-baseline justify-between border-b px-5 py-4">
                <h2 className="text-ink-950 text-lg font-bold">{cat.label}</h2>
                <span className="text-ink-400 text-xs font-semibold uppercase tracking-[0.14em]">
                  per game
                </span>
              </div>
              <ol>
                {cat.rows.map((row, i) => (
                  <li
                    key={row.playerId}
                    className="border-ink-50 flex items-center gap-3 border-b px-5 py-3 last:border-0"
                  >
                    <span
                      className={`w-6 shrink-0 text-center text-sm font-bold tabular-nums ${
                        i === 0 ? "text-gold-600" : "text-ink-400"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/player/${row.playerId}`}
                        className="text-ink-950 hover:text-play-600 block truncate text-sm font-semibold transition-colors"
                      >
                        {playerDisplayName(row, participant)}
                      </Link>
                      <Link
                        href={`/team/${row.teamId}`}
                        className="text-ink-400 hover:text-ink-600 block truncate text-xs"
                      >
                        {row.teamName} · {row.gamesPlayed} GP
                      </Link>
                    </div>
                    <span className="font-display text-ink-950 text-xl font-bold tabular-nums">
                      {row.value.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      )}

      <p className="text-ink-400 mt-8 text-xs">
        Player names on public pages show first name and last initial unless a parent has opted
        into full public names. Signed-in league and club participants see full names.
      </p>
    </div>
  )
}
