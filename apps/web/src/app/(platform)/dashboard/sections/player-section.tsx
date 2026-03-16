import Link from "next/link"
import type { DashboardData } from "../get-dashboard-data"

interface PlayerSectionProps {
  data: NonNullable<DashboardData["player"]>
}

export function PlayerSection({ data }: PlayerSectionProps) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⛹️</span>
          <h2 className="text-xl font-bold text-gray-900">Player Dashboard</h2>
        </div>
        <Link
          href="/player/profile"
          className="text-sm font-medium text-yellow-600 hover:text-yellow-700"
        >
          Edit Player Info
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* My Teams */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-1 text-lg font-semibold text-gray-900">
            My Teams
          </h3>
          <p className="mb-4 text-sm text-gray-500">
            {data.teams.length} team{data.teams.length !== 1 ? "s" : ""}
          </p>

          {data.teams.length > 0 ? (
            <ul className="space-y-2">
              {data.teams.map((team) => (
                <li
                  key={team.id}
                  className="rounded-md border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="font-medium text-gray-900">{team.name}</div>
                  <div className="text-xs text-gray-500">
                    {team.ageGroup} &middot; {team.club}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">
              You haven&apos;t been added to a team yet.
            </p>
          )}
        </div>

        {/* Upcoming Games */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-1 text-lg font-semibold text-gray-900">
            Upcoming Games
          </h3>
          <p className="mb-4 text-sm text-gray-500">
            {data.upcomingGames.length} scheduled
          </p>

          {data.upcomingGames.length > 0 ? (
            <ul className="space-y-2">
              {data.upcomingGames.map((game) => (
                <li
                  key={game.id}
                  className="rounded-md border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="font-medium text-gray-900">
                    {game.homeTeam} vs {game.awayTeam}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(game.scheduledAt).toLocaleDateString()} &middot;{" "}
                    {game.location || "TBD"}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No upcoming games.</p>
          )}
        </div>

        {/* My Stats */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-1 text-lg font-semibold text-gray-900">
            My Stats
          </h3>
          <p className="mb-4 text-sm text-gray-500">Season performance</p>

          {data.stats.length > 0 ? (
            <div className="space-y-3">
              {data.stats.slice(0, 3).map((stat) => (
                <div
                  key={stat.id}
                  className="rounded-md border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Points</span>
                    <span className="font-semibold text-gray-900">
                      {stat.points}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Rebounds</span>
                    <span className="font-semibold text-gray-900">
                      {stat.rebounds}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Assists</span>
                    <span className="font-semibold text-gray-900">
                      {stat.assists}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No stats recorded yet.</p>
          )}

          <Link
            href="/player/stats"
            className="mt-4 inline-flex items-center text-sm font-medium text-yellow-600 hover:text-yellow-700"
          >
            View All Stats &rarr;
          </Link>
        </div>
      </div>
    </section>
  )
}
