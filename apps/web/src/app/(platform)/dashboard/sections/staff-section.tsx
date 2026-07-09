import Link from "next/link"
import { Badge, Button, StatTile } from "@/components/ui"
import type { DashboardData } from "../get-dashboard-data"

interface StaffSectionProps {
  data: NonNullable<DashboardData["staff"]>
}

export function StaffSection({ data }: StaffSectionProps) {
  const totalPlayers = data.teams.reduce((sum, team) => sum + team._count.players, 0)

  return (
    <section className="font-barlow space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
            Staff assignments
          </h2>
          <p className="text-ink-500 mt-1 text-sm">Your active team roles and roster load.</p>
        </div>
        <Button href="/settings/profile" variant="subtle" icon={<IconEdit />}>
          Edit Profile
        </Button>
      </div>

      {data.teams.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Assigned teams"
              value={data.teams.length}
              tone="brand"
              icon={<IconClipboard className="h-5 w-5" />}
              delay={0}
            />
            <StatTile
              label="Total players"
              value={totalPlayers}
              tone="court"
              icon={<IconUsers className="h-5 w-5" />}
              delay={70}
            />
            <StatTile
              label="In season"
              value={data.teams.filter((team) => Boolean(team.season)).length}
              tone="hoop"
              icon={<IconCalendar className="h-5 w-5" />}
              delay={140}
            />
            <StatTile
              label="Organizations"
              value={new Set(data.teams.map((team) => team.tenant.name)).size}
              tone="ink"
              icon={<IconBuilding className="h-5 w-5" />}
              delay={210}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {data.teams.map((team, index) => (
              <Link
                key={team.id}
                href={`/clubs/${team.tenant.id}/teams/${team.id}/dashboard`}
                className="reveal card-lift border-ink-100 shadow-soft group block rounded-2xl border bg-white p-5 hover:border-[color:var(--brand-line)]"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-ink-950 font-semibold">{team.name}</h3>
                    <p className="text-ink-500 mt-1 text-sm">
                      {team.ageGroup} · {team.tenant.name}
                      {team.season ? ` · ${team.season}` : ""}
                    </p>
                  </div>
                  <Badge tone="court">{team._count.players} players</Badge>
                </div>

                <div className="border-ink-100 mt-4 flex items-center justify-between border-t pt-4">
                  <span className="text-ink-400 text-xs uppercase tracking-[0.12em]">
                    Team workspace
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ink)]">
                    Open
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="reveal border-ink-300 shadow-soft rounded-[28px] border border-dashed bg-white p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)]">
            <IconClipboard className="h-5 w-5 text-[color:var(--brand-ink)]" />
          </div>
          <h3 className="font-condensed text-ink-950 text-xl font-bold uppercase tracking-wide">
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

function IconEdit() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
