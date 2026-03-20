import Link from "next/link"
import type { DashboardData } from "../get-dashboard-data"

interface ClubSectionProps {
  data: NonNullable<DashboardData["clubOwner"]>
}

export function ClubSection({ data }: ClubSectionProps) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏀</span>
          <h2 className="text-xl font-bold text-gray-900">Club Management</h2>
        </div>
        <Link
          href="/settings/profile"
          className="text-sm font-medium text-green-600 hover:text-green-700"
        >
          Edit Profile
        </Link>
      </div>

      {data.tenants.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {data.tenants.map((tenant) => (
            <div key={tenant.id} className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-1 text-lg font-semibold text-gray-900">
                {tenant.name}
              </h3>
              <p className="mb-4 text-sm text-gray-500">
                {tenant.slug}.youthbasketballhub.com
              </p>

              <div className="mb-4 flex gap-4">
                <div className="rounded-md bg-green-50 px-3 py-2 text-center">
                  <div className="text-2xl font-bold text-green-700">
                    {tenant._count.teams}
                  </div>
                  <div className="text-xs text-green-600">Teams</div>
                </div>
                <div className="rounded-md bg-orange-50 px-3 py-2 text-center">
                  <div className="text-2xl font-bold text-orange-700">
                    {tenant._count.tryouts}
                  </div>
                  <div className="text-xs text-orange-600">Tryouts</div>
                </div>
                <div className="rounded-md bg-gray-50 px-3 py-2 text-center">
                  <div className="text-2xl font-bold text-gray-700">
                    {tenant.plan}
                  </div>
                  <div className="text-xs text-gray-600">Plan</div>
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  href={`/clubs/${tenant.id}/teams`}
                  className="text-sm font-medium text-green-600 hover:text-green-700"
                >
                  Manage Teams &rarr;
                </Link>
                <Link
                  href={`/clubs/${tenant.id}/tryouts`}
                  className="text-sm font-medium text-orange-600 hover:text-orange-700"
                >
                  Manage Tryouts &rarr;
                </Link>
                <Link
                  href={`/clubs/${tenant.id}/settings`}
                  className="text-sm font-medium text-gray-600 hover:text-gray-700"
                >
                  Settings &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center">
          <div className="mb-2 text-4xl">🏀</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            Create Your Club
          </h3>
          <p className="mb-4 text-gray-600">
            You&apos;ve signed up as a club owner but haven&apos;t created your
            club yet. Get started now!
          </p>
          <Link
            href="/clubs/create"
            className="inline-block rounded-lg bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700"
          >
            Create Club
          </Link>
        </div>
      )}
    </section>
  )
}
