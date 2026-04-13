import Link from "next/link"
import type { DashboardData } from "../get-dashboard-data"

interface StaffSectionProps {
  data: NonNullable<DashboardData["staff"]>
}

export function StaffSection({ data }: StaffSectionProps) {
  const totalPlayers = data.teams.reduce((sum, team) => sum + team._count.players, 0)

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-ink-950 text-2xl font-bold">Staff assignments</h2>
          <p className="text-ink-500 mt-1 text-sm">Your active team roles and roster load.</p>
        </div>
        <Link
          href="/settings/profile"
          className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-4 py-2 text-sm font-semibold transition"
        >
          Edit Profile
        </Link>
      </div>

      {data.teams.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Assigned teams"
              value={data.teams.length}
              tone="bg-play-50 text-play-700"
              icon={<IconClipboard className="h-4 w-4" />}
            />
            <MetricCard
              label="Total players"
              value={totalPlayers}
              tone="bg-court-50 text-court-700"
              icon={<IconUsers className="h-4 w-4" />}
            />
            <MetricCard
              label="In season"
              value={data.teams.filter((team) => Boolean(team.season)).length}
              tone="bg-hoop-50 text-hoop-700"
              icon={<IconCalendar className="h-4 w-4" />}
            />
            <MetricCard
              label="Organizations"
              value={new Set(data.teams.map((team) => team.tenant.name)).size}
              tone="bg-ink-100 text-ink-700"
              icon={<IconBuilding className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {data.teams.map((team) => (
              <div
                key={team.id}
                className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-ink-950 font-semibold">{team.name}</h3>
                    <p className="text-ink-500 mt-1 text-sm">
                      {team.ageGroup} · {team.tenant.name}
                      {team.season ? ` · ${team.season}` : ""}
                    </p>
                  </div>
                  <span className="bg-court-50 text-court-700 rounded-lg px-2 py-1 text-xs font-semibold">
                    {team._count.players} players
                  </span>
                </div>

                <div className="border-ink-100 mt-4 flex items-center justify-between border-t pt-4">
                  <span className="text-ink-400 text-xs uppercase tracking-[0.12em]">
                    Team workspace
                  </span>
                  <Link
                    href={`/clubs/${team.tenant.id}/teams/${team.id}/dashboard`}
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
            <IconClipboard className="text-ink-500 h-5 w-5" />
          </div>
          <h3 className="font-display text-ink-950 text-xl font-semibold">
            No team assignments yet
          </h3>
          <p className="text-ink-500 mx-auto mt-2 max-w-xl text-sm">
            When a club assigns you to a team, it will show up here with roster counts and quick
            actions.
          </p>
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

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
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

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
      <path d="M9 15h.01" />
      <path d="M15 15h.01" />
    </svg>
  )
}
