import Link from "next/link"
import { getServerSession } from "next-auth"
import { prisma } from "@youthbasketballhub/db"
import { authOptions } from "@/lib/auth"
import { Badge, SectionHeader } from "@/components/ui"
import { FollowButton } from "@/components/follow-button"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Browse Leagues",
  alternates: { canonical: "/leagues" },
  description:
    "Follow youth basketball leagues: live scores, standings, stat leaders, schedules and game recaps.",
}

const STATUS_LABEL: Record<string, { label: string; tone: "court" | "play" | "neutral" }> = {
  IN_PROGRESS: { label: "Season underway", tone: "court" },
  REGISTRATION: { label: "Registration open", tone: "play" },
  REGISTRATION_CLOSED: { label: "Starting soon", tone: "play" },
  FINALIZED: { label: "Starting soon", tone: "play" },
  COMPLETED: { label: "Season complete", tone: "neutral" },
  DRAFT: { label: "Coming soon", tone: "neutral" },
}

async function getPublicLeagues() {
  const leagues = await (prisma as any).league.findMany({
    where: { seasons: { some: {} } },
    select: {
      id: true,
      name: true,
      description: true,
      seasons: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          label: true,
          status: true,
          _count: { select: { teamSubmissions: { where: { status: "APPROVED" } }, divisions: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  return Promise.all(
    leagues
      .filter((l: any) => l.seasons.length > 0)
      .map(async (l: any) => {
        const season = l.seasons[0]
        const completedGames = await (prisma as any).game.count({
          where: { seasonId: season.id, status: "COMPLETED" },
        })
        const liveGames = await (prisma as any).game.count({
          where: { seasonId: season.id, status: "LIVE" },
        })
        return { ...l, season, completedGames, liveGames }
      })
  )
}

export default async function PublicLeaguesPage() {
  const leagues = await getPublicLeagues()
  // Active content first, drafts last
  leagues.sort((a: any, b: any) => b.completedGames + b.liveGames * 10 - (a.completedGames + a.liveGames * 10))

  // Follow (favorite) state per league for the signed-in viewer
  const session = await getServerSession(authOptions).catch(() => null)
  const viewerId = (session?.user as any)?.id ?? null
  const followed = new Set<string>(
    viewerId
      ? (
          await (prisma as any).follow.findMany({
            where: { userId: viewerId, leagueId: { not: null } },
            select: { leagueId: true },
          })
        ).map((f: any) => f.leagueId)
      : []
  )

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6">
      <SectionHeader
        eyebrow="Competitive play"
        title="Browse leagues"
        description="Live scores, standings, stat leaders and recaps from every league on the platform."
        accent="court"
        className="mb-10"
      />

      {leagues.length === 0 ? (
        <div className="border-ink-100 rounded-[28px] border bg-white p-12 text-center">
          <p className="text-ink-500 mb-3">No leagues are public yet.</p>
          <Link href="/for-leagues" className="text-play-600 text-sm font-semibold hover:underline">
            Run a league? Bring it to SportsHub &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {leagues.map((l: any) => {
            const status = STATUS_LABEL[l.season.status] ?? STATUS_LABEL.DRAFT
            return (
              <div key={l.id} className="relative">
                <div className="absolute right-5 top-5 z-10">
                  <FollowButton
                    leagueId={l.id}
                    initialFollowing={followed.has(l.id)}
                    isAuthenticated={!!viewerId}
                    compact
                  />
                </div>
              <Link
                href={`/league/${l.season.id}`}
                className="card-lift border-ink-100 shadow-soft group flex flex-col rounded-[28px] border bg-white p-7"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 pr-10">
                  {l.liveGames > 0 && <Badge tone="live" dot>{l.liveGames} live now</Badge>}
                  <Badge tone={status.tone}>{status.label}</Badge>
                  <Badge tone="hoop">{l.season.label}</Badge>
                </div>
                <h2 className="text-ink-950 group-hover:text-play-600 mb-2 text-2xl font-bold transition-colors">
                  {l.name}
                </h2>
                {l.description && (
                  <p className="text-ink-500 mb-5 line-clamp-2 flex-1 text-sm leading-6">{l.description}</p>
                )}
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-ink-50 rounded-2xl p-3">
                    <div className="text-ink-400 text-xs uppercase tracking-[0.14em]">Teams</div>
                    <div className="text-ink-950 mt-1 text-lg font-semibold tabular-nums">
                      {l.season._count.teamSubmissions}
                    </div>
                  </div>
                  <div className="bg-ink-50 rounded-2xl p-3">
                    <div className="text-ink-400 text-xs uppercase tracking-[0.14em]">Divisions</div>
                    <div className="text-ink-950 mt-1 text-lg font-semibold tabular-nums">
                      {l.season._count.divisions}
                    </div>
                  </div>
                  <div className="bg-ink-50 rounded-2xl p-3">
                    <div className="text-ink-400 text-xs uppercase tracking-[0.14em]">Games</div>
                    <div className="text-ink-950 mt-1 text-lg font-semibold tabular-nums">{l.completedGames}</div>
                  </div>
                </div>
                <span className="text-play-600 group-hover:text-play-700 mt-5 inline-flex items-center gap-1 text-sm font-semibold">
                  Scores, standings &amp; leaders
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
              </div>
            )
          })}
        </div>
      )}

      <div className="border-ink-100 mt-10 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border bg-white p-6">
        <p className="text-ink-600 text-sm">
          Organizing competitive play? Registration, scheduling, live scoring and standings — all included.
        </p>
        <Link
          href="/for-leagues"
          className="bg-ink-950 hover:bg-ink-800 inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition"
        >
          Run your league here
        </Link>
      </div>
    </div>
  )
}
