import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"

async function getTeams(tenantId: string) {
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
    },
    orderBy: { createdAt: "desc" },
  })
}

export default async function ClubTeamsPage({
  params,
}: {
  params: { id: string }
}) {
  const teams = await getTeams(params.id)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Teams</h2>
        <Link
          href={`/clubs/${params.id}/teams/create`}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          Create Team
        </Link>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <div className="text-4xl mb-4">🏀</div>
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/clubs/${params.id}/teams/${team.id}/dashboard`}
              className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition"
            >
              <div className="mb-3">
                <h3 className="text-xl font-bold text-gray-900">
                  {team.name}
                </h3>
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
          ))}
        </div>
      )}
    </div>
  )
}
