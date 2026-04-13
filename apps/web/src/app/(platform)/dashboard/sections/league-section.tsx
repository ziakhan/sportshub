import Link from "next/link"
import type { DashboardData } from "../get-dashboard-data"

interface LeagueSectionProps {
  data: NonNullable<DashboardData["leagueOwner"]>
}

export function LeagueSection({ data }: LeagueSectionProps) {
  const totalTeams = data.leagues.reduce((sum, league) => sum + league._count.teams, 0)
  const totalGames = data.leagues.reduce((sum, league) => sum + league._count.games, 0)

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-ink-950 text-2xl font-bold">League operations</h2>
          <p className="text-ink-500 mt-1 text-sm">Track teams, fixtures, and season activity.</p>
        </div>
        {data.leagues.length > 0 && (
          <Link
            href={`/leagues/${data.leagues[0].id}/manage`}
            className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-4 py-2 text-sm font-semibold transition"
          >
            Edit League
          </Link>
        )}
      </div>

      {data.leagues.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Leagues"
              value={data.leagues.length}
              tone="bg-play-50 text-play-700"
              icon={<IconTrophy className="h-4 w-4" />}
            />
            <MetricCard
              label="Teams"
              value={totalTeams}
              tone="bg-court-50 text-court-700"
              icon={<IconUsers className="h-4 w-4" />}
            />
            <MetricCard
              label="Games"
              value={totalGames}
              tone="bg-hoop-50 text-hoop-700"
              icon={<IconCalendar className="h-4 w-4" />}
            />
            <MetricCard
              label="Avg games"
              value={Math.round(totalGames / Math.max(data.leagues.length, 1))}
              tone="bg-ink-100 text-ink-700"
              icon={<IconChart className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {data.leagues.map((league) => (
              <div
                key={league.id}
                className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-ink-950 font-semibold">{league.name}</h3>
                    <p className="text-ink-500 mt-1 text-sm">{league.season}</p>
                  </div>
                  <span className="bg-play-50 text-play-700 rounded-lg px-2 py-1 text-xs font-semibold">
                    Live
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-ink-50 rounded-xl p-3">
                    <p className="text-ink-400 text-xs uppercase tracking-[0.1em]">Teams</p>
                    <p className="text-ink-900 mt-1 text-lg font-semibold">{league._count.teams}</p>
                  </div>
                  <div className="bg-ink-50 rounded-xl p-3">
                    <p className="text-ink-400 text-xs uppercase tracking-[0.1em]">Games</p>
                    <p className="text-ink-900 mt-1 text-lg font-semibold">{league._count.games}</p>
                  </div>
                </div>

                <div className="border-ink-100 mt-4 flex items-center justify-between border-t pt-4">
                  <span className="text-ink-400 text-xs uppercase tracking-[0.12em]">
                    League workspace
                  </span>
                  <Link
                    href={`/leagues/${league.id}/manage`}
                    className="text-play-600 hover:text-play-700 text-sm font-semibold"
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-8 text-center">
          <div className="bg-ink-50 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl">
            <IconTrophy className="text-ink-500 h-5 w-5" />
          </div>
          <h3 className="font-display text-ink-950 text-xl font-semibold">
            Create your first league
          </h3>
          <p className="text-ink-500 mx-auto mb-5 mt-2 max-w-xl text-sm">
            You&apos;ve signed up as a league organizer but haven&apos;t created a league yet. Get
            started now!
          </p>
          <Link
            href="/leagues/create"
            className="bg-play-600 hover:bg-play-700 inline-flex items-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition"
          >
            Create League
          </Link>
        </div>
      )}
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

function IconTrophy({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M17 6h2a2 2 0 0 1 0 4h-2" />
      <path d="M7 6H5a2 2 0 0 0 0 4h2" />
    </svg>
  )
}
