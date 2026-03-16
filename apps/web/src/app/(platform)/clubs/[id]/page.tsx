import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"

async function getClubOverview(clubId: string) {
  const [teamCount, tryoutCount, staffCount, pendingInvites] =
    await Promise.all([
      prisma.team.count({ where: { tenantId: clubId } }),
      prisma.tryout.count({ where: { tenantId: clubId } }),
      prisma.userRole.count({
        where: {
          tenantId: clubId,
          role: { in: ["ClubOwner", "ClubManager", "Staff"] },
        },
      }),
      prisma.staffInvitation.count({
        where: { tenantId: clubId, status: "PENDING" },
      }),
    ])

  return { teamCount, tryoutCount, staffCount, pendingInvites }
}

export default async function ClubOverviewPage({
  params,
}: {
  params: { id: string }
}) {
  const data = await getClubOverview(params.id)

  return (
    <div>
      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-3xl font-bold text-green-600">
            {data.teamCount}
          </div>
          <div className="text-sm text-gray-500">Teams</div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-3xl font-bold text-blue-600">
            {data.tryoutCount}
          </div>
          <div className="text-sm text-gray-500">Tryouts</div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-3xl font-bold text-purple-600">
            {data.staffCount}
          </div>
          <div className="text-sm text-gray-500">Staff Members</div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-3xl font-bold text-yellow-600">
            {data.pendingInvites}
          </div>
          <div className="text-sm text-gray-500">Pending Invites</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/clubs/${params.id}/teams/create`}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Create Team
          </Link>
          <Link
            href={`/clubs/${params.id}/tryouts/create`}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Create Tryout
          </Link>
          <Link
            href={`/clubs/${params.id}/staff`}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            Manage Staff
          </Link>
          <Link
            href={`/clubs/${params.id}/settings`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Settings
          </Link>
        </div>
      </div>
    </div>
  )
}
