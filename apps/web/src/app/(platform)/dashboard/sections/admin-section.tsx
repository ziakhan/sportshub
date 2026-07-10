import Link from "next/link"
import { StatTile, PanelHeader, Button, Badge, type StatTileTone } from "@/components/ui"
import type { DashboardData } from "../get-dashboard-data"

interface AdminSectionProps {
  data: NonNullable<DashboardData["admin"]>
}

export function AdminSection({ data }: AdminSectionProps) {
  const statCards: {
    label: string
    value: number
    tone: StatTileTone
    icon: JSX.Element
  }[] = [
    {
      label: "Users",
      value: data.totalUsers,
      tone: "brand",
      icon: <IconUsers className="h-5 w-5" />,
    },
    {
      label: "Clubs",
      value: data.totalClubs,
      tone: "court",
      icon: <IconBuilding className="h-5 w-5" />,
    },
    {
      label: "Teams",
      value: data.totalTeams,
      tone: "hoop",
      icon: <IconGroup className="h-5 w-5" />,
    },
    {
      label: "Players",
      value: data.totalPlayers,
      tone: "play",
      icon: <IconUserPlus className="h-5 w-5" />,
    },
    {
      label: "Leagues",
      value: data.totalLeagues,
      tone: "gold",
      icon: <IconTrophy className="h-5 w-5" />,
    },
    {
      label: "Tryouts",
      value: data.totalTryouts,
      tone: "ink",
      icon: <IconClipboard className="h-5 w-5" />,
    },
    {
      label: "Games",
      value: data.totalGames,
      tone: "court",
      icon: <IconCalendar className="h-5 w-5" />,
    },
    {
      label: "Pending Invites",
      value: data.pendingInvitations,
      tone: "hoop",
      icon: <IconMail className="h-5 w-5" />,
    },
  ]

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
            Platform overview
          </h2>
          <p className="text-ink-500 mt-1 text-sm">
            The highest-signal admin metrics and newest activity across the platform.
          </p>
        </div>
        <div className="flex gap-2">
          <Button href="/dashboard/admin/messages" variant="subtle" icon={ACTION_ICONS.mail}>
            Messages
          </Button>
          <Button href="/dashboard/admin/payments" variant="subtle" icon={ACTION_ICONS.payments}>
            Payments
          </Button>
          <Button href="/dashboard/admin/reviews" variant="subtle" icon={ACTION_ICONS.flag}>
            Reviews
          </Button>
          <Button href="/dashboard/admin/settings" variant="subtle" icon={ACTION_ICONS.gear}>
            Admin settings
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card, i) => (
          <StatTile
            key={card.label}
            value={card.value}
            label={card.label}
            tone={card.tone}
            icon={card.icon}
            delay={i * 60}
          />
        ))}
      </div>

      {data.recentClubs.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div
            className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
            style={{ animationDelay: "500ms" }}
          >
            <PanelHeader
              title="Recent clubs"
              action={
                <Link
                  href="/dashboard/admin/clubs"
                  className="text-sm font-semibold text-[color:var(--brand-ink)] hover:underline"
                >
                  View all &rarr;
                </Link>
              }
            />
            <div className="grid gap-4 md:grid-cols-2">
              {data.recentClubs.map((club) => (
                <div
                  key={club.id}
                  className="border-ink-100 bg-ink-50 rounded-2xl border p-5 transition-colors hover:border-[color:var(--brand-line)]"
                >
                  <h4 className="text-ink-950 font-semibold">{club.name}</h4>
                  <p className="text-ink-500 mt-1 text-sm">{club.slug}.youthbasketballhub.com</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone="court">{club._count.teams} teams</Badge>
                    <Badge tone="hoop">{club._count.tryouts} tryouts</Badge>
                    <Badge tone="neutral">{club.plan}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
            style={{ animationDelay: "560ms" }}
          >
            <PanelHeader
              title="Recent users"
              action={
                <Link
                  href="/dashboard/admin/users"
                  className="text-sm font-semibold text-[color:var(--brand-ink)] hover:underline"
                >
                  Manage &rarr;
                </Link>
              }
            />
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

/** Unsized SVG icons for the header buttons (the Button kit sizes them). */
const ACTION_ICONS = {
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 7L2 7" />
    </svg>
  ),
  payments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" strokeLinecap="round" />
    </svg>
  ),
  flag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" strokeLinejoin="round" />
      <line x1="4" y1="22" x2="4" y2="15" strokeLinecap="round" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9v0"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
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
