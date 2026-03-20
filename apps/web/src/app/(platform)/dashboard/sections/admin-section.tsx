import Link from "next/link"
import type { DashboardData } from "../get-dashboard-data"

interface AdminSectionProps {
  data: NonNullable<DashboardData["admin"]>
}

export function AdminSection({ data }: AdminSectionProps) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-2xl">⚙️</span>
        <h2 className="text-xl font-bold text-gray-900">Platform Overview</h2>
      </div>

      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-3xl font-bold text-indigo-700">{data.totalUsers}</div>
          <div className="text-sm text-gray-600">Total Users</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-3xl font-bold text-green-700">{data.totalClubs}</div>
          <div className="text-sm text-gray-600">Clubs</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-3xl font-bold text-orange-700">{data.totalTeams}</div>
          <div className="text-sm text-gray-600">Teams</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-3xl font-bold text-orange-700">{data.totalPlayers}</div>
          <div className="text-sm text-gray-600">Players</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-3xl font-bold text-purple-700">{data.totalLeagues}</div>
          <div className="text-sm text-gray-600">Leagues</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-3xl font-bold text-teal-700">{data.totalTryouts}</div>
          <div className="text-sm text-gray-600">Tryouts</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-3xl font-bold text-red-700">{data.totalGames}</div>
          <div className="text-sm text-gray-600">Games</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-3xl font-bold text-yellow-700">{data.pendingInvitations}</div>
          <div className="text-sm text-gray-600">Pending Invites</div>
        </div>
      </div>

      {/* Recent clubs */}
      {data.recentClubs.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-lg font-semibold text-gray-900">Clubs</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {data.recentClubs.map((club) => (
              <div key={club.id} className="rounded-lg bg-white p-5 shadow">
                <h4 className="font-semibold text-gray-900">{club.name}</h4>
                <p className="text-sm text-gray-500">{club.slug}.youthbasketballhub.com</p>
                <div className="mt-3 flex gap-4 text-sm text-gray-600">
                  <span>{club._count.teams} teams</span>
                  <span>{club._count.tryouts} tryouts</span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
                    {club.plan}
                  </span>
                </div>
                <div className="mt-3 flex gap-3">
                  <Link
                    href={`/clubs/${club.id}/teams`}
                    className="text-sm font-medium text-green-600 hover:text-green-700"
                  >
                    Teams →
                  </Link>
                  <Link
                    href={`/clubs/${club.id}/staff`}
                    className="text-sm font-medium text-orange-600 hover:text-orange-700"
                  >
                    Staff →
                  </Link>
                  <Link
                    href={`/clubs/${club.id}/tryouts`}
                    className="text-sm font-medium text-orange-600 hover:text-orange-700"
                  >
                    Tryouts →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent users */}
      {data.recentUsers.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-900">Recent Users</h3>
          <div className="overflow-x-auto rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Roles</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.recentUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {user.roles.map((r) => r.role).join(", ")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
