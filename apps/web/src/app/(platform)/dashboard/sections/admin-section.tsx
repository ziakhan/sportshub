import Link from "next/link"
import type { DashboardData } from "../get-dashboard-data"

interface AdminSectionProps {
  data: NonNullable<DashboardData["admin"]>
}

export function AdminSection({ data }: AdminSectionProps) {
  const statCards = [
    {
      label: "Users",
      value: data.totalUsers,
      tone: "bg-play-50 text-play-600",
      icon: <IconUsers className="h-4 w-4" />,
    },
    {
      label: "Clubs",
      value: data.totalClubs,
      tone: "bg-court-50 text-court-600",
      icon: <IconBuilding className="h-4 w-4" />,
    },
    {
      label: "Teams",
      value: data.totalTeams,
      tone: "bg-hoop-50 text-hoop-600",
      icon: <IconGroup className="h-4 w-4" />,
    },
    {
      label: "Players",
      value: data.totalPlayers,
      tone: "bg-sky-50 text-sky-600",
      icon: <IconUserPlus className="h-4 w-4" />,
    },
    {
      label: "Leagues",
      value: data.totalLeagues,
      tone: "bg-violet-50 text-violet-600",
      icon: <IconTrophy className="h-4 w-4" />,
    },
    {
      label: "Tryouts",
      value: data.totalTryouts,
      tone: "bg-amber-50 text-amber-600",
      icon: <IconClipboard className="h-4 w-4" />,
    },
    {
      label: "Games",
      value: data.totalGames,
      tone: "bg-rose-50 text-rose-600",
      icon: <IconCalendar className="h-4 w-4" />,
    },
    {
      label: "Pending Invites",
      value: data.pendingInvitations,
      tone: "bg-ink-100 text-ink-700",
      icon: <IconMail className="h-4 w-4" />,
    },
  ]

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-ink-950 text-2xl font-bold">Platform overview</h2>
          <p className="text-ink-500 mt-1 text-sm">
            The highest-signal admin metrics and newest activity across the platform.
          </p>
        </div>
        <Link
          href="/dashboard/admin/settings"
          className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-4 py-2 text-sm font-semibold transition"
        >
          Admin settings
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${card.tone}`}>
                {card.icon}
              </div>
              <div className="text-ink-400 text-xs font-semibold uppercase tracking-[0.14em]">
                {card.label}
              </div>
            </div>
            <div className="font-display text-ink-950 text-3xl font-bold">{card.value}</div>
          </div>
        ))}
      </div>

      {data.recentClubs.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-ink-950 text-lg font-semibold">Recent clubs</h3>
              <Link
                href="/dashboard/admin/clubs"
                className="text-play-600 hover:text-play-700 text-sm font-semibold"
              >
                View all
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {data.recentClubs.map((club) => (
                <div key={club.id} className="border-ink-100 bg-ink-50 rounded-2xl border p-5">
                  <h4 className="text-ink-950 font-semibold">{club.name}</h4>
                  <p className="text-ink-500 mt-1 text-sm">{club.slug}.youthbasketballhub.com</p>
                  <div className="mt-4 flex gap-3 text-sm">
                    <span className="bg-court-50 text-court-700 rounded-xl px-3 py-2">
                      {club._count.teams} teams
                    </span>
                    <span className="bg-hoop-50 text-hoop-700 rounded-xl px-3 py-2">
                      {club._count.tryouts} tryouts
                    </span>
                    <span className="bg-ink-100 text-ink-700 rounded-xl px-3 py-2">
                      {club.plan}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-ink-950 text-lg font-semibold">Recent users</h3>
              <Link
                href="/dashboard/admin/users"
                className="text-play-600 hover:text-play-700 text-sm font-semibold"
              >
                Manage
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="divide-ink-100 min-w-full divide-y">
                <thead className="bg-ink-50">
                  <tr>
                    <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase">
                      Name
                    </th>
                    <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase">
                      Email
                    </th>
                    <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase">
                      Roles
                    </th>
                    <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-ink-100 divide-y">
                  {data.recentUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="text-ink-950 whitespace-nowrap px-4 py-3 text-sm font-medium">
                        {user.firstName} {user.lastName}
                      </td>
                      <td className="text-ink-600 whitespace-nowrap px-4 py-3 text-sm">
                        {user.email}
                      </td>
                      <td className="text-ink-600 px-4 py-3 text-sm">
                        {user.roles.map((r) => r.role).join(", ")}
                      </td>
                      <td className="text-ink-500 whitespace-nowrap px-4 py-3 text-sm">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
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

function IconGroup({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H4a4 4 0 0 0-4 4v2" />
      <circle cx="8" cy="7" r="4" />
      <path d="M20 8v6" />
      <path d="M23 11h-6" />
    </svg>
  )
}

function IconUserPlus({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
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

function IconMail({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 7L2 7" />
    </svg>
  )
}
