import Link from "next/link"
import type { DashboardData } from "../get-dashboard-data"

interface PlayerSectionProps {
  data: NonNullable<DashboardData["player"]>
}

export function PlayerSection({ data }: PlayerSectionProps) {
  const averagePoints =
    data.stats.length > 0
      ? Math.round(data.stats.reduce((sum, stat) => sum + stat.points, 0) / data.stats.length)
      : 0

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-ink-950 text-2xl font-bold">Player dashboard</h2>
          <p className="text-ink-500 mt-1 text-sm">
            Your teams, upcoming fixtures, and latest stat line.
          </p>
        </div>
        <Link
          href="/settings/profile"
          className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-4 py-2 text-sm font-semibold transition"
        >
          Edit profile
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Teams"
          value={data.teams.length}
          tone="bg-play-50 text-play-700"
          icon={<IconUsers className="h-4 w-4" />}
        />
        <MetricCard
          label="Upcoming games"
          value={data.upcomingGames.length}
          tone="bg-hoop-50 text-hoop-700"
          icon={<IconCalendar className="h-4 w-4" />}
        />
        <MetricCard
          label="Recent stat lines"
          value={data.stats.length}
          tone="bg-court-50 text-court-700"
          icon={<IconChart className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg points"
          value={averagePoints}
          tone="bg-ink-100 text-ink-700"
          icon={<IconTarget className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-ink-950 text-lg font-semibold">My teams</h3>
            <span className="text-ink-400 text-xs uppercase tracking-[0.12em]">Current season</span>
          </div>
          {data.teams.length > 0 ? (
            <ul className="space-y-3">
              {data.teams.map((team) => (
                <li key={team.id} className="border-ink-100 bg-ink-50 rounded-xl border p-4">
                  <p className="text-ink-900 font-semibold">{team.name}</p>
                  <p className="text-ink-500 mt-1 text-sm">
                    {team.ageGroup} · {team.club}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-500 text-sm">You have not been added to a team yet.</p>
          )}
        </div>

        <div className="space-y-6">
          <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
            <h3 className="font-display text-ink-950 text-lg font-semibold">Upcoming games</h3>
            {data.upcomingGames.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {data.upcomingGames.map((game) => (
                  <li key={game.id} className="border-ink-100 bg-ink-50 rounded-xl border p-4">
                    <p className="text-ink-900 font-semibold">
                      {game.homeTeam} vs {game.awayTeam}
                    </p>
                    <p className="text-ink-500 mt-1 text-sm">
                      {new Date(game.scheduledAt).toLocaleDateString()} · {game.location || "TBD"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-500 mt-3 text-sm">No upcoming games scheduled yet.</p>
            )}
          </div>

          <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
            <h3 className="font-display text-ink-950 text-lg font-semibold">Recent stat lines</h3>
            {data.stats.length > 0 ? (
              <div className="mt-4 space-y-3">
                {data.stats.slice(0, 3).map((stat) => (
                  <div key={stat.id} className="border-ink-100 bg-ink-50 rounded-xl border p-4">
                    <StatRow label="Points" value={stat.points} />
                    <StatRow label="Rebounds" value={stat.rebounds} />
                    <StatRow label="Assists" value={stat.assists} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-ink-500 mt-3 text-sm">No stats recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function MetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: number
  tone: string
  icon: JSX.Element
}) {
  return (
    <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
        <div className="text-ink-400 text-xs font-semibold uppercase tracking-[0.14em]">
          {label}
        </div>
      </div>
      <div className="font-display text-ink-950 text-3xl font-bold">{value}</div>
    </div>
  )
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M3 3v18h18" />
      <path d="m7 14 3-3 3 2 4-5" />
    </svg>
  )
}

function IconTarget({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-900 font-semibold">{value}</span>
    </div>
  )
}
