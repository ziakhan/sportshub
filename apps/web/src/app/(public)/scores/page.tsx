import Link from "next/link"
import { format, isSameDay } from "date-fns"
import { getServerSession } from "next-auth"
import { prisma } from "@youthbasketballhub/db"
import { authOptions } from "@/lib/auth"
import { getViewerScope } from "@/lib/privacy/participants"
import { Badge, ScoreCard, SectionHeader } from "@/components/ui"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Scores — SportsHub",
  description: "Live youth basketball scores, recent finals and upcoming games across every league.",
}

const gameSelect = {
  id: true,
  status: true,
  scheduledAt: true,
  homeScore: true,
  awayScore: true,
  homeTeamId: true,
  awayTeamId: true,
  homeTeam: { select: { name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } } },
  awayTeam: { select: { name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } } },
  venue: { select: { name: true } },
  season: { select: { id: true, label: true, league: { select: { name: true } } } },
}

function GameCard({ g }: { g: any }) {
  const status = g.status === "LIVE" ? "LIVE" : g.status === "COMPLETED" ? "FINAL" : "SCHEDULED"
  const card = (
    <ScoreCard
      status={status as any}
      home={{ name: g.homeTeam.name, color: g.homeTeam.tenant?.branding?.primaryColor, score: g.homeScore }}
      away={{ name: g.awayTeam.name, color: g.awayTeam.tenant?.branding?.primaryColor, score: g.awayScore }}
      dateLabel={status === "SCHEDULED" ? format(new Date(g.scheduledAt), "h:mm a") : undefined}
      venue={[g.season?.league?.name, g.venue?.name].filter(Boolean).join(" · ") || undefined}
      className="hover:border-play-200 h-full transition-colors"
    />
  )
  // Upcoming games link too — the pre-game page shows rosters + season stats
  return (
    <Link href={`/live/${g.id}`} className="block h-full">
      {card}
    </Link>
  )
}

function DayGroups({ games, order }: { games: any[]; order: "asc" | "desc" }) {
  const days: Array<{ date: Date; games: any[] }> = []
  const sorted = [...games].sort((a, b) =>
    order === "asc"
      ? +new Date(a.scheduledAt) - +new Date(b.scheduledAt)
      : +new Date(b.scheduledAt) - +new Date(a.scheduledAt)
  )
  for (const g of sorted) {
    const d = new Date(g.scheduledAt)
    const bucket = days.find((x) => isSameDay(x.date, d))
    if (bucket) bucket.games.push(g)
    else days.push({ date: d, games: [g] })
  }
  const today = new Date()
  return (
    <div className="space-y-8">
      {days.map((day) => (
        <div key={day.date.toISOString()}>
          <h3 className="text-ink-400 mb-3 px-1 text-xs font-bold uppercase tracking-[0.14em]">
            {isSameDay(day.date, today) ? "Today" : format(day.date, "EEEE, MMMM d")}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {day.games.map((g) => (
              <GameCard key={g.id} g={g} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default async function ScoresPage({
  searchParams,
}: {
  searchParams?: { season?: string }
}) {
  const seasonFilter = searchParams?.season
  const session = await getServerSession(authOptions).catch(() => null)
  const viewerId = (session?.user as any)?.id ?? null

  const now = new Date()
  const weekBack = new Date(now.getTime() - 7 * 86400_000)
  const weekAhead = new Date(now.getTime() + 7 * 86400_000)
  const seasonWhere = seasonFilter ? { seasonId: seasonFilter } : {}

  const [scope, followedTeams, leagues, live, finals, upcoming] = await Promise.all([
    getViewerScope(viewerId),
    viewerId
      ? (prisma as any).follow.findMany({
          where: { userId: viewerId, teamId: { not: null } },
          select: { teamId: true },
        })
      : [],
    (prisma as any).league.findMany({
      where: { seasons: { some: { games: { some: {} } } } },
      select: {
        name: true,
        seasons: {
          orderBy: { createdAt: "desc" as const },
          take: 1,
          select: { id: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    (prisma as any).game.findMany({
      where: { status: "LIVE", ...seasonWhere },
      select: gameSelect,
      orderBy: { scheduledAt: "asc" },
      take: 12,
    }),
    (prisma as any).game.findMany({
      where: { status: "COMPLETED", scheduledAt: { gte: weekBack }, ...seasonWhere },
      select: gameSelect,
      orderBy: { scheduledAt: "desc" },
      take: 36,
    }),
    (prisma as any).game.findMany({
      where: { status: "SCHEDULED", scheduledAt: { gte: now, lte: weekAhead }, ...seasonWhere },
      select: gameSelect,
      orderBy: { scheduledAt: "asc" },
      take: 24,
    }),
  ])

  // "Your games" pinned first (your kids' teams, your roles, your follows)
  const myTeamIds = new Set<string>(scope.teamIds)
  for (const f of followedTeams) myTeamIds.add(f.teamId)
  const isMine = (g: any) => myTeamIds.has(g.homeTeamId) || myTeamIds.has(g.awayTeamId)
  const all = [...live, ...upcoming, ...finals]
  const myGames = viewerId ? all.filter(isMine) : []
  const myGameIds = new Set(myGames.map((g: any) => g.id))
  const notMine = (list: any[]) => list.filter((g) => !myGameIds.has(g.id))

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6">
      <SectionHeader
        eyebrow="Around the hub"
        title="Scores"
        description="Live games, this week's finals and what's coming up — across every league."
        accent="play"
        className="mb-6"
      />

      <div className="mb-8 flex flex-wrap gap-2">
        <Link
          href="/scores"
          className={`rounded-full px-4 py-1.5 text-xs font-semibold ring-1 transition ${
            !seasonFilter
              ? "bg-ink-950 text-white ring-ink-950"
              : "text-ink-600 ring-ink-200 hover:bg-ink-50 bg-white"
          }`}
        >
          All leagues
        </Link>
        {leagues
          .filter((l: any) => l.seasons.length > 0)
          .map((l: any) => (
            <Link
              key={l.seasons[0].id}
              href={`/scores?season=${l.seasons[0].id}`}
              title={`${l.name} scores`}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold ring-1 transition ${
                seasonFilter === l.seasons[0].id
                  ? "bg-ink-950 text-white ring-ink-950"
                  : "text-ink-600 ring-ink-200 hover:bg-ink-50 bg-white"
              }`}
            >
              {l.name}
            </Link>
          ))}
        {seasonFilter && (
          <Link
            href={`/league/${seasonFilter}`}
            className="text-play-600 ring-play-200 hover:bg-play-50 rounded-full bg-white px-4 py-1.5 text-xs font-semibold ring-1 transition"
          >
            Standings &amp; league hub &rarr;
          </Link>
        )}
      </div>

      {all.length === 0 ? (
        <div className="border-ink-100 rounded-[28px] border bg-white p-12 text-center">
          <p className="text-ink-500">No games in this window — check back soon.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {myGames.length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-ink-950 text-xl font-bold">Your games</h2>
                <Badge tone="hoop">{myGames.length}</Badge>
              </div>
              <p className="text-ink-400 -mt-2 mb-4 text-xs">
                Games for your kids&apos; teams and teams you follow.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {myGames.slice(0, 6).map((g: any) => (
                  <GameCard key={g.id} g={g} />
                ))}
              </div>
            </section>
          )}

          {notMine(live).length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-ink-950 text-xl font-bold">Live now</h2>
                <Badge tone="live" dot>
                  {notMine(live).length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {notMine(live).map((g: any) => (
                  <GameCard key={g.id} g={g} />
                ))}
              </div>
            </section>
          )}

          {notMine(upcoming).length > 0 && (
            <section>
              <h2 className="text-ink-950 mb-4 text-xl font-bold">Upcoming</h2>
              <DayGroups games={notMine(upcoming)} order="asc" />
            </section>
          )}

          {notMine(finals).length > 0 && (
            <section>
              <h2 className="text-ink-950 mb-4 text-xl font-bold">Recent results</h2>
              <DayGroups games={notMine(finals)} order="desc" />
            </section>
          )}
        </div>
      )}
    </div>
  )
}
