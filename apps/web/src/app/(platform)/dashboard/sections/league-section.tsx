import Link from "next/link"
import type { DashboardData } from "../get-dashboard-data"

interface LeagueSectionProps {
  data: NonNullable<DashboardData["leagueOwner"]>
}

export function LeagueSection({ data }: LeagueSectionProps) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <h2 className="text-xl font-bold text-gray-900">League Management</h2>
        </div>
        {data.leagues.length > 0 && (
          <Link
            href={`/leagues/${data.leagues[0].id}/settings`}
            className="text-sm font-medium text-purple-600 hover:text-purple-700"
          >
            Edit League
          </Link>
        )}
      </div>

      {data.leagues.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {data.leagues.map((league) => (
            <div key={league.id} className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-1 text-lg font-semibold text-gray-900">
                {league.name}
              </h3>
              <p className="mb-3 text-sm text-gray-500">{league.season}</p>

              <div className="mb-4 flex gap-4">
                <div className="rounded-md bg-purple-50 px-3 py-2 text-center">
                  <div className="text-2xl font-bold text-purple-700">
                    {league._count.teams}
                  </div>
                  <div className="text-xs text-purple-600">Teams</div>
                </div>
                <div className="rounded-md bg-indigo-50 px-3 py-2 text-center">
                  <div className="text-2xl font-bold text-indigo-700">
                    {league._count.games}
                  </div>
                  <div className="text-xs text-indigo-600">Games</div>
                </div>
              </div>

              <Link
                href={`/leagues/${league.id}`}
                className="text-sm font-medium text-purple-600 hover:text-purple-700"
              >
                Manage League &rarr;
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center">
          <div className="mb-2 text-4xl">🏆</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            Create Your League
          </h3>
          <p className="mb-4 text-gray-600">
            You&apos;ve signed up as a league organizer but haven&apos;t created
            a league yet. Get started now!
          </p>
          <Link
            href="/leagues/create"
            className="inline-block rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
          >
            Create League
          </Link>
        </div>
      )}
    </section>
  )
}
