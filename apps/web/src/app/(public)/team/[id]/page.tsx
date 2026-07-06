import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { getTeamPublicData } from "@/lib/queries/season-stats"
import { getViewerScope, isParticipant } from "@/lib/privacy/participants"
import { playerDisplayName } from "@/lib/privacy/names"
import { Card, EntityHeader, NewsCard, ScoreCard, SectionHeader } from "@/components/ui"
import { FollowButton } from "@/components/follow-button"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { id: string } }) {
  const data = await getTeamPublicData(params.id)
  if (!data) return { title: "Team not found — SportsHub" }
  const { team } = data
  return {
    title: `${team.name} (${team.ageGroup}) — ${team.tenant?.name ?? "SportsHub"}`,
    description: `Schedule, results, roster and stats for ${team.name}${
      team.tenant ? ` of ${team.tenant.name}` : ""
    }.`,
  }
}

export default async function PublicTeamPage({ params }: { params: { id: string } }) {
  const data = await getTeamPublicData(params.id)
  if (!data) notFound()
  const { team, games, record, playerAverages, posts, staff } = data

  const session = await getServerSession(authOptions)
  const viewerId = (session?.user as any)?.id ?? null
  const scope = await getViewerScope(viewerId)
  const participant = isParticipant(scope, { teamId: team.id, tenantId: team.tenantId })

  const following = viewerId
    ? !!(await (prisma as any).follow.findFirst({
        where: { userId: viewerId, teamId: team.id },
        select: { id: true },
      }))
    : false

  const primaryColor = team.tenant?.branding?.primaryColor ?? "#4f46e5"
  const completed = games.filter((g: any) => g.status === "COMPLETED" || g.status === "LIVE")
  const upcoming = games
    .filter((g: any) => g.status === "SCHEDULED" && new Date(g.scheduledAt) >= new Date())
    .reverse() // query is desc; upcoming reads better ascending

  const rosterNames = new Map<string, string>(
    team.players.map((tp: any) => [tp.player.id, playerDisplayName(tp.player, participant)])
  )
  const seasonInfo = games.find((g: any) => g.season)?.season ?? null

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6">
      <EntityHeader
        name={team.name}
        subtitle={[team.tenant?.name, team.ageGroup, team.season].filter(Boolean).join(" · ")}
        meta={[
          `${record.wins}–${record.losses}${record.ties ? `–${record.ties}` : ""}`,
          ...(seasonInfo ? [`${seasonInfo.league.name} ${seasonInfo.label}`] : []),
          `${team.players.length} players`,
        ]}
        primaryColor={primaryColor}
        logoUrl={team.tenant?.branding?.logoUrl}
        crestText={team.name.slice(0, 1)}
        action={
          <FollowButton teamId={team.id} initialFollowing={following} isAuthenticated={!!viewerId} />
        }
        className="mb-4"
      />

      <div className="mb-8 flex flex-wrap gap-2">
        {seasonInfo && (
          <Link
            href={`/league/${seasonInfo.id}`}
            className="bg-ink-50 text-ink-700 ring-ink-200 hover:bg-ink-100 rounded-full px-4 py-1.5 text-xs font-semibold ring-1 transition"
          >
            {seasonInfo.league.name} {seasonInfo.label} &rarr;
          </Link>
        )}
        {team.tenant && (
          <Link
            href={`/club/${team.tenant.slug}`}
            className="bg-ink-50 text-ink-700 ring-ink-200 hover:bg-ink-100 rounded-full px-4 py-1.5 text-xs font-semibold ring-1 transition"
          >
            {team.tenant.name} &rarr;
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {completed.length === 0 && upcoming.length === 0 && (
            <div className="border-ink-100 rounded-2xl border bg-white p-8 text-center">
              <p className="text-ink-500 text-sm">
                No games on the calendar yet — the schedule appears here once this team is placed
                in a league season.
              </p>
            </div>
          )}
          {(completed.length > 0 || upcoming.length > 0) && (
            <section>
              <SectionHeader
                title="Schedule & results"
                accent="play"
                className="mb-5"
                action={
                  seasonInfo ? (
                    <Link
                      href={`/league/${seasonInfo.id}/leaders`}
                      className="text-play-600 hover:text-play-700 text-sm font-semibold"
                    >
                      League leaders &rarr;
                    </Link>
                  ) : undefined
                }
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {upcoming.slice(0, 4).map((g: any) => (
                  <Link key={g.id} href={`/live/${g.id}`} className="block">
                    <ScoreCard
                      status="SCHEDULED"
                      home={{ name: g.homeTeam.name, color: g.homeTeam.tenant?.branding?.primaryColor }}
                      away={{ name: g.awayTeam.name, color: g.awayTeam.tenant?.branding?.primaryColor }}
                      dateLabel={format(new Date(g.scheduledAt), "EEE MMM d · h:mm a")}
                      venue={g.venue?.name}
                      className="hover:border-play-200 transition-colors"
                    />
                  </Link>
                ))}
                {completed.slice(0, 8).map((g: any) => (
                  <Link key={g.id} href={`/live/${g.id}`} className="block">
                    <ScoreCard
                      status={g.status === "LIVE" ? "LIVE" : "FINAL"}
                      home={{
                        name: g.homeTeam.name,
                        color: g.homeTeam.tenant?.branding?.primaryColor,
                        score: g.homeScore,
                      }}
                      away={{
                        name: g.awayTeam.name,
                        color: g.awayTeam.tenant?.branding?.primaryColor,
                        score: g.awayScore,
                      }}
                      venue={g.venue?.name}
                      className="hover:border-play-200 transition-colors"
                    />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {playerAverages.length > 0 && (
            <section>
              <SectionHeader title="Player stats" accent="gold" className="mb-5" />
              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-ink-400 border-ink-100 border-b text-left text-xs uppercase tracking-wide">
                        <th className="px-6 py-3 font-semibold">Player</th>
                        <th className="px-4 py-3 text-right font-semibold">GP</th>
                        <th className="px-4 py-3 text-right font-semibold">PPG</th>
                        <th className="px-4 py-3 text-right font-semibold">RPG</th>
                        <th className="px-4 py-3 text-right font-semibold">APG</th>
                        <th className="px-4 py-3 text-right font-semibold">SPG</th>
                        <th className="px-6 py-3 text-right font-semibold">BPG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerAverages.map((row) => (
                        <tr key={row.playerId} className="border-ink-50 hover:bg-ink-50/50 border-b last:border-0">
                          <td className="px-6 py-3">
                            <Link
                              href={`/player/${row.playerId}`}
                              className="text-ink-950 hover:text-play-600 font-medium"
                            >
                              {rosterNames.get(row.playerId) ?? "Former player"}
                            </Link>
                          </td>
                          <td className="text-ink-500 px-4 py-3 text-right tabular-nums">{row.gamesPlayed}</td>
                          <td className="text-ink-950 px-4 py-3 text-right font-semibold tabular-nums">
                            {row.ppg.toFixed(1)}
                          </td>
                          <td className="text-ink-700 px-4 py-3 text-right tabular-nums">{row.rpg.toFixed(1)}</td>
                          <td className="text-ink-700 px-4 py-3 text-right tabular-nums">{row.apg.toFixed(1)}</td>
                          <td className="text-ink-700 px-4 py-3 text-right tabular-nums">{row.spg.toFixed(1)}</td>
                          <td className="text-ink-700 px-6 py-3 text-right tabular-nums">{row.bpg.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>
          )}

          {posts.length > 0 && (
            <section>
              <SectionHeader title="Team news" accent="hoop" className="mb-5" />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {posts.map((p: any) => (
                  <NewsCard
                    key={p.id}
                    title={p.title}
                    excerpt={p.body.replace(/\s+/g, " ").slice(0, 140)}
                    coverUrl={p.media?.[0]?.url ?? p.media?.[0]?.posterUrl ?? null}
                    dateLabel={p.publishedAt ? format(new Date(p.publishedAt), "MMM d, yyyy") : ""}
                    author={p.kind === "RECAP_AI" ? "Game recap" : undefined}
                    href={`/news/${p.slug}`}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-ink-950 mb-4 text-lg font-bold">Roster</h2>
            {team.players.length === 0 ? (
              <p className="text-ink-500 text-sm">No players on the public roster yet.</p>
            ) : (
              <ul className="space-y-1">
                {team.players
                  .slice()
                  .sort((a: any, b: any) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99))
                  .map((tp: any) => (
                    <li key={tp.player.id}>
                      <Link
                        href={`/player/${tp.player.id}`}
                        className="hover:bg-ink-50 flex items-center gap-3 rounded-xl px-3 py-2 transition-colors"
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {tp.jerseyNumber ?? "–"}
                        </span>
                        <span className="text-ink-950 min-w-0 flex-1 truncate text-sm font-medium">
                          {rosterNames.get(tp.player.id)}
                        </span>
                        {tp.player.position && (
                          <span className="text-ink-400 text-xs">{tp.player.position}</span>
                        )}
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </Card>

          {staff.length > 0 && (
            <Card>
              <h2 className="text-ink-950 mb-4 text-lg font-bold">Coaching staff</h2>
              <ul className="space-y-2.5">
                {staff.map((s: any, i: number) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink-950 font-medium">
                      {s.user.firstName} {s.user.lastName}
                    </span>
                    <span className="text-ink-500 text-xs">
                      {s.designation === "HeadCoach"
                        ? "Head coach"
                        : s.designation === "AssistantCoach"
                          ? "Assistant coach"
                          : s.role === "TeamManager"
                            ? "Team manager"
                            : "Staff"}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {team.tenant && (
            <Card>
              <h2 className="text-ink-950 mb-2 text-lg font-bold">Club</h2>
              <Link href={`/club/${team.tenant.slug}`} className="text-play-600 text-sm font-semibold hover:underline">
                {team.tenant.name} &rarr;
              </Link>
              {(team.tenant.city || team.tenant.state) && (
                <p className="text-ink-500 mt-1 text-sm">
                  {[team.tenant.city, team.tenant.state].filter(Boolean).join(", ")}
                </p>
              )}
            </Card>
          )}
        </div>
      </div>

      <p className="text-ink-400 mt-8 text-xs">
        Player names on public pages show first name and last initial unless a parent has opted
        into full public names. Signed-in league and club participants see full names.
      </p>
    </div>
  )
}
