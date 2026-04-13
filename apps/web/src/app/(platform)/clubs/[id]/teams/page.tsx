import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { TeamsFilter } from "./teams-filter"

interface TeamListItem {
  id: string
  name: string
  ageGroup: string
  gender: string | null
  season: string | null
  description: string | null
  createdAt: Date
  _count: {
    players: number
    homeGames: number
    awayGames: number
    tryouts: number
    offers: number
    leagues: number
  }
  staff: { designation: string | null }[]
  offers: { status: string }[]
}

async function getTeams(tenantId: string): Promise<TeamListItem[]> {
  return await prisma.team.findMany({
    where: { tenantId },
    include: {
      _count: {
        select: {
          players: true,
          homeGames: true,
          awayGames: true,
          tryouts: true,
          offers: true,
          leagues: true,
        },
      },
      staff: {
        where: { role: { in: ["Staff", "TeamManager"] } },
        select: { designation: true },
      },
      offers: {
        select: { status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export default async function ClubTeamsPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { age?: string; q?: string }
}) {
  const teams = await getTeams(params.id)

  const ageFilter = searchParams.age
  const searchQuery = searchParams.q?.toLowerCase()

  // Get unique age groups for filter
  const ageGroups = [...new Set(teams.map((t) => t.ageGroup))].sort()

  // Apply filters
  const filtered = teams.filter((t) => {
    if (ageFilter && t.ageGroup !== ageFilter) return false
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery)) return false
    return true
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-ink-900 text-xl font-bold">Teams ({teams.length})</h2>
        <Link
          href={`/clubs/${params.id}/teams/create`}
          className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white"
        >
          Create Team
        </Link>
      </div>

      {teams.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="text-ink-900 mb-2 text-lg font-semibold">No teams yet</h3>
          <p className="text-ink-600 mb-6">
            Create your first team to start managing players and scheduling games.
          </p>
          <Link
            href={`/clubs/${params.id}/teams/create`}
            className="bg-play-600 hover:bg-play-700 inline-block rounded-xl px-6 py-2 font-semibold text-white"
          >
            Create Your First Team
          </Link>
        </div>
      ) : (
        <>
          <TeamsFilter
            clubId={params.id}
            ageGroups={ageGroups}
            activeAge={ageFilter}
            activeSearch={searchParams.q}
          />

          {filtered.length === 0 ? (
            <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-8 text-center">
              <p className="text-ink-600 mb-3">No teams match the current filters.</p>
              <Link
                href={`/clubs/${params.id}/teams`}
                className="text-play-700 text-sm hover:underline"
              >
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((team) => {
                const pendingOffers = team.offers.filter((o) => o.status === "PENDING").length
                const acceptedOffers = team.offers.filter((o) => o.status === "ACCEPTED").length
                const hasHeadCoach = team.staff.some((s) => s.designation === "HeadCoach")

                return (
                  <Link
                    key={team.id}
                    href={`/clubs/${params.id}/teams/${team.id}/dashboard`}
                    className="border-ink-100 shadow-soft hover:shadow-panel hover:border-play-300 block rounded-2xl border bg-white p-6 transition"
                  >
                    <div className="mb-3">
                      <div className="flex items-start justify-between">
                        <h3 className="text-ink-900 text-xl font-bold">{team.name}</h3>
                        {!hasHeadCoach && (
                          <span className="bg-hoop-100 text-hoop-700 rounded-full px-2 py-0.5 text-xs font-medium">
                            No coach
                          </span>
                        )}
                      </div>
                      <p className="text-ink-600 text-sm">
                        {team.ageGroup}
                        {team.gender ? ` \u2022 ${team.gender}` : ""}
                        {team.season ? ` \u2022 ${team.season}` : ""}
                      </p>
                    </div>

                    {team.description && (
                      <p className="text-ink-700 mb-3 line-clamp-2 text-sm">{team.description}</p>
                    )}

                    {/* Status indicators */}
                    {(pendingOffers > 0 || acceptedOffers > 0) && (
                      <div className="mb-3 flex gap-2">
                        {pendingOffers > 0 && (
                          <span className="bg-hoop-100 text-hoop-700 rounded-full px-2 py-0.5 text-xs font-medium">
                            {pendingOffers} pending offer{pendingOffers !== 1 ? "s" : ""}
                          </span>
                        )}
                        {acceptedOffers > 0 && (
                          <span className="bg-court-100 text-court-700 rounded-full px-2 py-0.5 text-xs font-medium">
                            {acceptedOffers} accepted
                          </span>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 border-t pt-3 text-center sm:grid-cols-4">
                      <div>
                        <div className="text-court-700 text-lg font-bold">
                          {team._count.players}
                        </div>
                        <div className="text-ink-500 text-xs">Players</div>
                      </div>
                      <div>
                        <div className="text-hoop-600 text-lg font-bold">{team._count.tryouts}</div>
                        <div className="text-ink-500 text-xs">Tryouts</div>
                      </div>
                      <div>
                        <div className="text-play-700 text-lg font-bold">{team._count.offers}</div>
                        <div className="text-ink-500 text-xs">Offers</div>
                      </div>
                      <div>
                        <div className="text-play-700 text-lg font-bold">{team._count.leagues}</div>
                        <div className="text-ink-500 text-xs">Leagues</div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
