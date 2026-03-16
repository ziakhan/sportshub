import Link from "next/link"
import type { DashboardData } from "../get-dashboard-data"

interface StaffSectionProps {
  data: NonNullable<DashboardData["staff"]>
}

export function StaffSection({ data }: StaffSectionProps) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <h2 className="text-xl font-bold text-gray-900">Staff</h2>
        </div>
        <Link
          href="/settings/profile"
          className="text-sm font-medium text-cyan-600 hover:text-cyan-700"
        >
          Edit Profile
        </Link>
      </div>

      {data.teams.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {data.teams.map((team) => (
            <div key={team.id} className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-1 text-lg font-semibold text-gray-900">
                {team.name}
              </h3>
              <p className="mb-3 text-sm text-gray-500">
                {team.ageGroup} &middot; {team.tenant.name}
                {team.season && ` &middot; ${team.season}`}
              </p>

              <div className="mb-4 flex gap-4">
                <div className="rounded-md bg-cyan-50 px-3 py-2 text-center">
                  <div className="text-2xl font-bold text-cyan-700">
                    {team._count.players}
                  </div>
                  <div className="text-xs text-cyan-600">Players</div>
                </div>
              </div>

              <Link
                href={`/teams/${team.id}`}
                className="text-sm font-medium text-cyan-600 hover:text-cyan-700"
              >
                View Team &rarr;
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center">
          <div className="mb-2 text-4xl">📋</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            No Teams Yet
          </h3>
          <p className="text-gray-600">
            You&apos;re registered as staff. When a club owner assigns you to
            a team, it will appear here.
          </p>
        </div>
      )}
    </section>
  )
}
