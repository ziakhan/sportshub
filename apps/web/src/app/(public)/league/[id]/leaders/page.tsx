import Link from "next/link"
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSeasonLeaders } from "@/lib/queries/season-stats"
import { getViewerScope, isParticipant } from "@/lib/privacy/participants"
import { playerDisplayName } from "@/lib/privacy/names"
import { Card, SectionHeader, SmartBack } from "@/components/ui"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { id: string } }) {
  const leaders = await getSeasonLeaders(params.id)
  if (!leaders) return { title: "Leaders" }
  return {
    title: `${leaders.season.leagueName} ${leaders.season.label} — Stat Leaders`,
    description: `Points, rebounds, assists, steals and blocks leaders for ${leaders.season.leagueName} ${leaders.season.label}.`,
    alternates: { canonical: `/league/${params.id}/leaders` },
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
        <SmartBack
          fallback={`/league/${params.id}`}
          fallbackLabel={`${leaders.season.leagueName} ${leaders.season.label}`}
          className="-ml-1"
        />
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
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {leaders.categories.map((cat) => {
            const [top, ...rest] = cat.rows
            return (
              <Card key={cat.key} className="overflow-hidden p-0">
                <div className="border-ink-100 flex items-baseline justify-between border-b px-4 py-2.5">
                  <h2 className="text-ink-950 text-sm font-bold uppercase tracking-wide">
                    {cat.label}
                  </h2>
                  <span className="text-ink-400 text-[10px] font-semibold uppercase tracking-[0.14em]">
                    per game
                  </span>
                </div>
                {top && (
                  <div className="bg-gold-50/60 border-gold-400 border-l-2 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/player/${top.playerId}`}
                          className="text-ink-950 hover:text-play-600 block truncate text-base font-bold transition-colors"
                        >
                          {playerDisplayName(top, participant)}
                        </Link>
                        <Link
                          href={`/team/${top.teamId}`}
                          className="text-ink-500 hover:text-ink-700 block truncate text-xs"
                        >
                          {top.teamName} · {top.gamesPlayed} GP
                        </Link>
                      </div>
                      <span className="font-display text-ink-950 text-3xl font-bold tabular-nums">
                        {top.value.toFixed(1)}
                      </span>
                    </div>
                  </div>
                )}
                <ol>
                  {rest.map((row, i) => (
                    <li
                      key={row.playerId}
                      className="border-ink-50 flex items-center gap-2.5 border-b px-4 py-1.5 last:border-0"
                    >
                      <span className="text-ink-400 w-4 shrink-0 text-center text-xs font-bold tabular-nums">
                        {i + 2}
                      </span>
                      <Link
                        href={`/player/${row.playerId}`}
                        className="text-ink-900 hover:text-play-600 min-w-0 flex-1 truncate text-sm font-medium transition-colors"
                      >
                        {playerDisplayName(row, participant)}
                        <span className="text-ink-400 text-xs font-normal"> · {row.teamName}</span>
                      </Link>
                      <span className="text-ink-900 text-sm font-bold tabular-nums">
                        {row.value.toFixed(1)}
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>
            )
          })}
        </div>
      )}

      <p className="text-ink-400 mt-8 text-xs">
        Player names on public pages show first name and last initial unless a parent has opted
        into full public names. Signed-in league and club participants see full names.
      </p>
    </div>
  )
}
