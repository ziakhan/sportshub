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
            <div
              key={team.id}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4">
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
                <p className="mb-4 text-sm text-gray-700 line-clamp-2">
                  {team.description}
                </p>
              )}

              <div className="flex gap-4 text-sm text-gray-600 mb-4">
                <div>
                  <span className="font-semibold">{team._count.players}</span>{" "}
                  players
                </div>
                <div>
                  <span className="font-semibold">
                    {team._count.homeGames + team._count.awayGames}
                  </span>{" "}
                  games
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Link
                  href={`/clubs/${params.id}/teams/${team.id}/edit`}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </Link>
                <Link
                  href={`/clubs/${params.id}/teams/${team.id}/roster`}
                  className="rounded-md border border-green-300 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                >
                  Roster
                </Link>
                <Link
                  href={`/clubs/${params.id}/teams/${team.id}/offer-templates`}
                  className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  Offer Templates
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
