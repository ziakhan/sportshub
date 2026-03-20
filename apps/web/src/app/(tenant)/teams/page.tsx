import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
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

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: { tenantId?: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/sign-in")
  }

  const tenantId = searchParams.tenantId

  if (!tenantId) {
    return (
      <div className="p-8">
        <p className="text-red-600">Tenant ID is required</p>
      </div>
    )
  }

  const teams = await getTeams(tenantId)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
              <p className="mt-1 text-gray-600">Manage your club&apos;s teams</p>
            </div>
            <Link
              href={`/teams/create?tenantId=${tenantId}`}
              className="rounded-md bg-orange-500 px-4 py-2 text-white font-semibold hover:bg-orange-600"
            >
              Create Team
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {teams.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="mx-auto max-w-md">
              <div className="text-4xl mb-4">🏀</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No teams yet</h3>
              <p className="text-gray-600 mb-6">
                Get started by creating your first team. You can add players, schedule practices,
                and join leagues.
              </p>
              <Link
                href={`/teams/create?tenantId=${tenantId}`}
                className="inline-block rounded-md bg-orange-500 px-6 py-2 text-white font-semibold hover:bg-orange-600"
              >
                Create Your First Team
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {teams.map((team: any) => (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{team.name}</h3>
                  <p className="text-sm text-gray-600">
                    {team.ageGroup}
                    {team.gender ? ` • ${team.gender}` : ""}
                    {team.season ? ` • ${team.season}` : ""}
                  </p>
                </div>

                {team.description && (
                  <p className="mb-4 text-sm text-gray-700 line-clamp-2">{team.description}</p>
                )}

                <div className="flex gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-semibold">{team._count.players}</span> players
                  </div>
                  <div>
                    <span className="font-semibold">
                      {team._count.homeGames + team._count.awayGames}
                    </span>{" "}
                    games
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
