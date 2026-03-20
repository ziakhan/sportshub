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
  _count: { players: number; homeGames: number; awayGames: number; tryouts: number; offers: number; leagues: number }
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
        <h2 className="text-xl font-bold text-gray-900">Teams ({teams.length})</h2>
        <Link
          href={`/clubs/${params.id}/teams/create`}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          Create Team
        </Link>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No teams yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first team to start managing players and scheduling
            games.
          </p>
          <Link
            href={`/clubs/${params.id}/teams/create`}
            className="inline-block rounded-md bg-green-600 px-6 py-2 text-white font-semibold hover:bg-green-700"
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
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-gray-600 mb-3">No teams match the current filters.</p>
              <Link href={`/clubs/${params.id}/teams`} className="text-sm text-blue-600 hover:underline">
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
                    className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition"
                  >
                    <div className="mb-3">
                      <div className="flex items-start justify-between">
                        <h3 className="text-xl font-bold text-gray-900">
                          {team.name}
                        </h3>
                        {!hasHeadCoach && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                            No coach
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {team.ageGroup}
                        {team.gender ? ` \u2022 ${team.gender}` : ""}
                        {team.season ? ` \u2022 ${team.season}` : ""}
                      </p>
                    </div>

                    {team.description && (
                      <p className="mb-3 text-sm text-gray-700 line-clamp-2">
                        {team.description}
                      </p>
                    )}

                    {/* Status indicators */}
                    {(pendingOffers > 0 || acceptedOffers > 0) && (
                      <div className="mb-3 flex gap-2">
                        {pendingOffers > 0 && (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                            {pendingOffers} pending offer{pendingOffers !== 1 ? "s" : ""}
                          </span>
                        )}
                        {acceptedOffers > 0 && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            {acceptedOffers} accepted
                          </span>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-2 text-center border-t pt-3">
                      <div>
                        <div className="text-lg font-bold text-blue-600">{team._count.players}</div>
                        <div className="text-xs text-gray-500">Players</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600">{team._count.tryouts}</div>
                        <div className="text-xs text-gray-500">Tryouts</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-purple-600">{team._count.offers}</div>
                        <div className="text-xs text-gray-500">Offers</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-orange-600">{team._count.leagues}</div>
                        <div className="text-xs text-gray-500">Leagues</div>
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
