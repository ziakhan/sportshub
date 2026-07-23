import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getPlayerSeasonData } from "@/lib/queries/season-stats"
import { getViewerScope, isParticipant } from "@/lib/privacy/participants"
import { playerDisplayName, publicPlayerName } from "@/lib/privacy/names"
import { hasFamilyPass } from "@/lib/entitlements"
import { prisma } from "@youthbasketballhub/db"
import { Card, EntityHeader, StatBlock } from "@/components/ui"
import { FollowButton } from "@/components/follow-button"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { id: string } }) {
  const data = await getPlayerSeasonData(params.id)
  if (!data) return { title: "Player not found" }
  // Metadata is always public-safe regardless of viewer
  return { title: `${publicPlayerName(data.player)} — Player Profile`, alternates: { canonical: `/player/${params.id}` } }
}

export default async function PublicPlayerPage({ params }: { params: { id: string } }) {
  const data = await getPlayerSeasonData(params.id)
  if (!data) notFound()

  const session = await getServerSession(authOptions)
  const viewerId = (session?.user as any)?.id ?? null
  const scope = await getViewerScope(viewerId)
  const participant =
    scope.playerIds.has(data.player.id) ||
    data.rosterTeamIds.some((teamId) => isParticipant(scope, { teamId })) ||
    data.leagueIds.some((leagueId) => isParticipant(scope, { leagueId })) ||
    data.player.teams.some((tp: any) => isParticipant(scope, { tenantId: tp.team.tenantId }))

  const name = playerDisplayName(data.player, participant)
  const primaryTeam = data.player.teams[0]?.team ?? null
  const jersey = data.player.teams[0]?.jerseyNumber

  // Family Pass gates the FULL game log depth in P3+ (plan §12) — free for
  // everyone today, but the surface is built gated from day one.
  const showFullLog = await hasFamilyPass(viewerId)
  const gameLog = showFullLog ? data.gameLog : data.gameLog.slice(0, 3)

  // Player follows (social-feed-plan P3): show the button + the viewer's
  // current state; private players get a parent-approved request.
  const myFollow = viewerId
    ? await (prisma as any).follow.findFirst({
        where: { userId: viewerId, playerId: data.player.id },
        select: { status: true },
      })
    : null
  const followState: "none" | "pending" | "active" = !myFollow
    ? "none"
    : myFollow.status === "PENDING"
      ? "pending"
      : "active"

  // Profile moments grid (social-feed-plan P4): the player's shared card
  // posts. PUBLIC for everyone; FOLLOWERS also for approved followers/family.
  const canSeeFollowersPosts =
    followState === "active" || scope.playerIds.has(data.player.id)
  const momentPosts = await (prisma as any).post.findMany({
    where: {
      status: "PUBLISHED",
      kind: { in: ["STAT_CARD", "PLAYER_OF_GAME"] },
      tags: { some: { playerId: data.player.id } },
      ...(canSeeFollowersPosts ? {} : { visibility: "PUBLIC" }),
    },
    select: {
      id: true,
      kind: true,
      tags: { where: { gameId: { not: null } }, select: { gameId: true }, take: 1 },
    },
    orderBy: { publishedAt: "desc" },
    take: 6,
  })

  const a = data.aggregate

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6">
      <EntityHeader
        name={name}
        subtitle={
          primaryTeam
            ? `${primaryTeam.name} · ${primaryTeam.ageGroup}${
                primaryTeam.tenant ? ` · ${primaryTeam.tenant.name}` : ""
              }`
            : "Free agent"
        }
        meta={[
          ...(jersey != null ? [`#${jersey}`] : []),
          ...(data.player.position ? [data.player.position] : []),
          ...(a ? [`${a.gamesPlayed} games`] : []),
        ]}
        primaryColor={primaryTeam?.tenant?.branding?.primaryColor ?? "#4f46e5"}
        crestText={name.slice(0, 1)}
        className="mb-4"
      />

      <div className="mb-4 flex justify-end">
        <FollowButton
          playerId={data.player.id}
          initialFollowing={followState === "active"}
          initialStatus={followState}
          isAuthenticated={!!viewerId}
          variant="light"
        />
      </div>

      {(primaryTeam || data.player.teams[0]?.team?.tenant) && (
        <div className="mb-8 flex flex-wrap gap-2">
          {primaryTeam && (
            <Link
              href={`/team/${primaryTeam.id}`}
              className="bg-ink-50 text-ink-700 ring-ink-200 hover:bg-ink-100 rounded-full px-4 py-1.5 text-xs font-semibold ring-1 transition"
            >
              {primaryTeam.name} &rarr;
            </Link>
          )}
          {primaryTeam?.tenant && (
            <Link
              href={`/club/${primaryTeam.tenant.slug}`}
              className="bg-ink-50 text-ink-700 ring-ink-200 hover:bg-ink-100 rounded-full px-4 py-1.5 text-xs font-semibold ring-1 transition"
            >
              {primaryTeam.tenant.name} &rarr;
            </Link>
          )}
        </div>
      )}

      {a ? (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatBlock label="Points per game" value={a.ppg.toFixed(1)} tone="play" />
            <StatBlock label="Rebounds per game" value={a.rpg.toFixed(1)} tone="hoop" />
            <StatBlock label="Assists per game" value={a.apg.toFixed(1)} tone="court" />
            <StatBlock label="Steals per game" value={a.spg.toFixed(1)} tone="sky" />
            <StatBlock label="Blocks per game" value={a.bpg.toFixed(1)} tone="violet" />
            <StatBlock label="Games played" value={a.gamesPlayed} tone="neutral" />
          </div>

          {momentPosts.length > 0 && (
            <div className="mb-8">
              <h2 className="text-ink-950 mb-3 text-lg font-bold">Moments</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {momentPosts.map((p: any) => {
                  const gameId = p.tags[0]?.gameId
                  if (!gameId) return null
                  const img =
                    p.kind === "PLAYER_OF_GAME"
                      ? `/api/live/${gameId}/card?src=post:${p.id}&v=3`
                      : `/api/live/${gameId}/card/${data.player.id}?src=post:${p.id}&v=3`
                  return (
                    <Link key={p.id} href={`/live/${gameId}`} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt="Shared game card"
                        className="border-ink-100 w-full rounded-xl border transition hover:opacity-90"
                      />
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          <Card className="overflow-hidden p-0">
            <div className="border-ink-100 flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-ink-950 text-lg font-bold">Game log</h2>
              <span className="text-ink-400 text-xs">
                Season totals: {a.points} PTS · {a.rebounds} REB · {a.assists} AST
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ink-400 border-ink-100 border-b text-left text-xs uppercase tracking-wide">
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Matchup</th>
                    <th className="px-4 py-3 font-semibold">Result</th>
                    <th className="px-4 py-3 text-right font-semibold">PTS</th>
                    <th className="px-4 py-3 text-right font-semibold">REB</th>
                    <th className="px-4 py-3 text-right font-semibold">AST</th>
                    <th className="px-4 py-3 text-right font-semibold">STL</th>
                    <th className="px-4 py-3 text-right font-semibold">BLK</th>
                    <th className="px-4 py-3 text-right font-semibold">TO</th>
                    <th className="px-6 py-3 text-right font-semibold">PF</th>
                  </tr>
                </thead>
                <tbody>
                  {gameLog.map((row) => (
                    <tr key={row.gameId} className="border-ink-50 hover:bg-ink-50/50 border-b last:border-0">
                      <td className="text-ink-500 whitespace-nowrap px-6 py-3">
                        {format(new Date(row.dateISO), "MMM d")}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/live/${row.gameId}`} className="text-ink-950 hover:text-play-600 font-medium">
                          {row.opponent ? `vs ${row.opponent}` : `${row.awayName} @ ${row.homeName}`}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {row.result ? (
                          <span
                            className={`font-semibold ${
                              row.result === "W" ? "text-court-600" : row.result === "L" ? "text-live-600" : "text-ink-500"
                            }`}
                          >
                            {row.result} {row.teamScore}–{row.opponentScore}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="text-ink-950 px-4 py-3 text-right font-semibold tabular-nums">{row.points}</td>
                      <td className="text-ink-700 px-4 py-3 text-right tabular-nums">{row.rebounds}</td>
                      <td className="text-ink-700 px-4 py-3 text-right tabular-nums">{row.assists}</td>
                      <td className="text-ink-700 px-4 py-3 text-right tabular-nums">{row.steals}</td>
                      <td className="text-ink-700 px-4 py-3 text-right tabular-nums">{row.blocks}</td>
                      <td className="text-ink-700 px-4 py-3 text-right tabular-nums">{row.turnovers}</td>
                      <td className="text-ink-700 px-6 py-3 text-right tabular-nums">{row.fouls}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-ink-500">
            No stats yet — {name}&apos;s numbers appear here once games are scored.
          </p>
        </Card>
      )}

      <p className="text-ink-400 mt-8 text-xs">
        Player names on public pages show first name and last initial unless a parent has opted
        into full public names. Signed-in league and club participants see full names.
      </p>
    </div>
  )
}
