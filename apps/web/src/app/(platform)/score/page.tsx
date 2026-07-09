import Link from "next/link"
import { GameRefereeControl } from "@/components/scoring/game-referee-control"
import { GameScorekeeperControl } from "@/components/scoring/game-scorekeeper-control"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * "Games I can score" — the scorekeeper's entry point. Shows LIVE games plus
 * everything scheduled from yesterday through the next 7 days for leagues the
 * user owns or clubs where they're staff (v1 access rule).
 */
export default async function ScoreListPage() {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) redirect("/sign-in")

  const [ownedLeagues, staffRoles, myScorekeeperRoles] = await Promise.all([
    (prisma as any).league.findMany({
      where: { ownerId: sessionInfo.userId },
      select: { id: true },
    }),
    prisma.userRole.findMany({
      where: {
        userId: sessionInfo.userId,
        role: { in: ["ClubOwner", "ClubManager", "Staff"] },
        tenantId: { not: null },
      },
      select: { tenantId: true },
    }),
    // Games this user is personally assigned to score.
    prisma.userRole.findMany({
      where: { userId: sessionInfo.userId, role: "Scorekeeper", gameId: { not: null } },
      select: { gameId: true },
    }),
  ])
  const leagueIds = ownedLeagues.map((l: any) => l.id)
  const tenantIds = Array.from(new Set(staffRoles.map((r) => r.tenantId).filter(Boolean)))
  const myScorekeeperGameIds = Array.from(
    new Set(myScorekeeperRoles.map((r) => r.gameId).filter(Boolean))
  ) as string[]

  const windowStart = new Date(Date.now() - 24 * 3600 * 1000)
  const windowEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000)

  const games = await (prisma as any).game.findMany({
    where: {
      OR: [
        { status: "LIVE" },
        { status: "SCHEDULED", scheduledAt: { gte: windowStart, lte: windowEnd } },
      ],
      AND: [
        {
          OR: [
            ...(leagueIds.length > 0 ? [{ season: { leagueId: { in: leagueIds } } }] : []),
            ...(tenantIds.length > 0
              ? [
                  { homeTeam: { tenantId: { in: tenantIds as string[] } } },
                  { awayTeam: { tenantId: { in: tenantIds as string[] } } },
                ]
              : []),
            ...(myScorekeeperGameIds.length > 0 ? [{ id: { in: myScorekeeperGameIds } }] : []),
          ],
        },
      ],
    },
    orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
    take: 50,
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      venue: { select: { name: true } },
      court: { select: { name: true } },
      season: { select: { label: true, league: { select: { name: true } } } },
    },
  })

  const gameIds = games.map((g: any) => g.id)
  const [refRoles, keeperRoles] = await Promise.all([
    (prisma as any).userRole.findMany({
      where: { role: "Referee", gameId: { in: gameIds } },
      select: { gameId: true, user: { select: { id: true, firstName: true, lastName: true } } },
    }),
    (prisma as any).userRole.findMany({
      where: { role: "Scorekeeper", gameId: { in: gameIds } },
      select: { gameId: true, user: { select: { id: true, firstName: true, lastName: true } } },
    }),
  ])
  const refsByGame = new Map<string, { userId: string; name: string }[]>()
  for (const r of refRoles) {
    const list = refsByGame.get(r.gameId) ?? []
    list.push({ userId: r.user.id, name: `${r.user.firstName ?? ""} ${r.user.lastName ?? ""}`.trim() })
    refsByGame.set(r.gameId, list)
  }
  const keepersByGame = new Map<string, { userId: string; name: string }[]>()
  for (const r of keeperRoles) {
    const list = keepersByGame.get(r.gameId) ?? []
    list.push({ userId: r.user.id, name: `${r.user.firstName ?? ""} ${r.user.lastName ?? ""}`.trim() })
    keepersByGame.set(r.gameId, list)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="font-display text-ink-950 text-2xl font-bold">Score a game</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Live games and everything scheduled in the next 7 days for your leagues and clubs.
        </p>
      </div>

      {games.length === 0 ? (
        <div className="border-ink-200 rounded-2xl border bg-white p-6 text-center text-sm">
          <p className="text-ink-500">No games to score right now.</p>
          <p className="text-ink-500 mt-2">
            Games appear here on game day.{" "}
            <Link href="/scores" className="text-play-600 font-semibold hover:underline">
              See the public scoreboard &rarr;
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {games.map((g: any) => (
            <div
              key={g.id}
              className="border-ink-200 hover:border-play-300 flex items-center justify-between gap-3 rounded-2xl border bg-white p-4 transition"
            >
              <div className="min-w-0">
                <p className="text-ink-950 truncate text-sm font-semibold">
                  {g.homeTeam.name} vs {g.awayTeam.name}
                </p>
                <p className="text-ink-500 mt-0.5 truncate text-xs">
                  {format(new Date(g.scheduledAt), "EEE MMM d · h:mm a")}
                  {g.venue?.name ? ` · ${g.venue.name}` : ""}
                  {g.court?.name ? ` · ${g.court.name}` : ""}
                  {g.season?.league?.name ? ` · ${g.season.league.name}` : ""}
                </p>
                <GameRefereeControl gameId={g.id} assigned={refsByGame.get(g.id) ?? []} />
                <GameScorekeeperControl gameId={g.id} assigned={keepersByGame.get(g.id) ?? []} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/live/${g.id}`}
                  className="text-ink-500 hover:text-ink-900 whitespace-nowrap px-1 text-xs font-semibold"
                >
                  Box score
                </Link>
                {g.status === "LIVE" ? (
                  <Link href={`/games/${g.id}/score`} className="bg-hoop-50 text-hoop-700 hover:bg-hoop-100 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition">
                    ● LIVE {g.homeScore ?? 0}–{g.awayScore ?? 0}
                  </Link>
                ) : (
                  <Link href={`/games/${g.id}/score`} className="bg-play-50 text-play-700 hover:bg-play-100 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition">
                    Score →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
