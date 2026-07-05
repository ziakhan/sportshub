import Link from "next/link"
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

  const [ownedLeagues, staffRoles] = await Promise.all([
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
  ])
  const leagueIds = ownedLeagues.map((l: any) => l.id)
  const tenantIds = Array.from(new Set(staffRoles.map((r) => r.tenantId).filter(Boolean)))

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
      season: { select: { name: true, league: { select: { name: true } } } },
    },
  })

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="font-display text-ink-950 text-2xl font-bold">Score a game</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Live games and everything scheduled in the next 7 days for your leagues and clubs.
        </p>
      </div>

      {games.length === 0 ? (
        <p className="border-ink-200 text-ink-500 rounded-2xl border bg-white p-6 text-center text-sm">
          No games to score right now.
        </p>
      ) : (
        <div className="space-y-2">
          {games.map((g: any) => (
            <Link
              key={g.id}
              href={`/games/${g.id}/score`}
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
              </div>
              {g.status === "LIVE" ? (
                <span className="bg-hoop-50 text-hoop-700 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold">
                  ● LIVE {g.homeScore ?? 0}–{g.awayScore ?? 0}
                </span>
              ) : (
                <span className="bg-play-50 text-play-700 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold">
                  Score →
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
