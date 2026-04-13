import Link from "next/link"
import type { DashboardData } from "../get-dashboard-data"

interface ClubSectionProps {
  data: NonNullable<DashboardData["clubOwner"]>
}

export function ClubSection({ data }: ClubSectionProps) {
  const totalTeams = data.tenants.reduce((sum, tenant) => sum + tenant._count.teams, 0)
  const totalTryouts = data.tenants.reduce((sum, tenant) => sum + tenant._count.tryouts, 0)
  const teams = data.teams

  return (
    <section className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-ink-950 text-2xl font-bold">Club management</h2>
              <p className="text-ink-500 mt-1 text-sm">
                A closer-to-mock dashboard view for club operations, programs, and staffing.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Clubs"
              value={data.tenants.length}
              tone="bg-play-50 text-play-700"
              icon={<IconBuilding className="h-4 w-4" />}
            />
            <MetricCard
              label="Teams"
              value={totalTeams}
              tone="bg-court-50 text-court-700"
              icon={<IconUsers className="h-4 w-4" />}
            />
            <MetricCard
              label="Tryouts"
              value={totalTryouts}
              tone="bg-hoop-50 text-hoop-700"
              icon={<IconClipboard className="h-4 w-4" />}
            />
            <MetricCard
              label="Plans"
              value={new Set(data.tenants.map((tenant) => tenant.plan)).size}
              tone="bg-ink-100 text-ink-700"
              icon={<IconLayers className="h-4 w-4" />}
            />
          </div>
        </div>

        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white lg:col-span-2">
          <div className="border-ink-100 flex items-center gap-2 border-b px-5 py-4">
            <div className="bg-hoop-500 h-2 w-2 rounded-full" />
            <h3 className="font-display text-ink-950 text-sm font-semibold">Needs attention</h3>
          </div>
          <div className="divide-ink-100 divide-y">
            <AttentionRow
              label={`${Math.max(data.tenants.length, 1)} club workspace${data.tenants.length === 1 ? "" : "s"} active`}
              href="/dashboard"
              icon={<IconBuilding className="text-play-600 h-3.5 w-3.5" />}
              iconTone="bg-play-50"
            />
            <AttentionRow
              label={`${totalTryouts} tryout${totalTryouts === 1 ? "" : "s"} currently tracked`}
              href={data.tenants[0] ? `/clubs/${data.tenants[0].id}/tryouts` : "/clubs/create"}
              icon={<IconClipboard className="text-hoop-500 h-3.5 w-3.5" />}
              iconTone="bg-hoop-50"
            />
            <AttentionRow
              label={`${totalTeams} team${totalTeams === 1 ? "" : "s"} across your clubs`}
              href={data.tenants[0] ? `/clubs/${data.tenants[0].id}/teams` : "/clubs/create"}
              icon={<IconUsers className="text-court-700 h-3.5 w-3.5" />}
              iconTone="bg-court-50"
            />
          </div>
        </div>
      </div>

      {data.tenants.length > 0 ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-ink-950 text-lg font-semibold">
                    Club workspaces
                  </h3>
                  <p className="text-ink-500 mt-1 text-sm">
                    Each club keeps its own teams, programs, and settings, even when one account
                    manages multiple organizations.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {data.tenants.map((tenant) => (
                  <div key={tenant.id} className="border-ink-100 bg-ink-50 rounded-2xl border p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-ink-950 font-semibold">{tenant.name}</h4>
                        <p className="text-ink-500 mt-1 text-xs">
                          {tenant.slug}.youthbasketballhub.com
                        </p>
                      </div>
                      <span className="bg-ink-950 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
                        {tenant.plan}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MiniStat
                        label="Teams"
                        value={tenant._count.teams}
                        tone="bg-court-50 text-court-700"
                      />
                      <MiniStat
                        label="Tryouts"
                        value={tenant._count.tryouts}
                        tone="bg-hoop-50 text-hoop-700"
                      />
                    </div>
                    <div className="border-ink-100 mt-4 flex flex-wrap gap-3 border-t pt-4">
                      <Link
                        href={`/clubs/${tenant.id}/teams`}
                        className="text-court-700 hover:text-court-800 text-sm font-semibold transition"
                      >
                        Teams
                      </Link>
                      <Link
                        href={`/clubs/${tenant.id}/tryouts`}
                        className="text-hoop-700 hover:text-hoop-800 text-sm font-semibold transition"
                      >
                        Tryouts
                      </Link>
                      <Link
                        href={`/clubs/${tenant.id}/settings`}
                        className="text-ink-600 hover:text-ink-700 text-sm font-semibold transition"
                      >
                        Settings
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white">
              <div className="border-ink-100 flex items-center gap-2 border-b px-5 py-4">
                <div className="bg-hoop-500 h-2 w-2 rounded-full" />
                <h3 className="font-display text-ink-950 text-sm font-semibold">At a glance</h3>
              </div>
              <div className="divide-ink-100 divide-y">
                <AttentionRow
                  label={`${data.tenants.length} club workspace${data.tenants.length === 1 ? "" : "s"} under management`}
                  href={data.tenants[0] ? `/clubs/${data.tenants[0].id}` : "/clubs/create"}
                  icon={<IconBuilding className="text-play-600 h-3.5 w-3.5" />}
                  iconTone="bg-play-50"
                />
                <AttentionRow
                  label={`${teams.length} active team card${teams.length === 1 ? "" : "s"} available below`}
                  href={data.tenants[0] ? `/clubs/${data.tenants[0].id}/teams` : "/clubs/create"}
                  icon={<IconUsers className="text-court-700 h-3.5 w-3.5" />}
                  iconTone="bg-court-50"
                />
                <AttentionRow
                  label={`${teams.filter((team) => !getLeadCoach(team)).length} team${teams.filter((team) => !getLeadCoach(team)).length === 1 ? "" : "s"} without a head coach`}
                  href={data.tenants[0] ? `/clubs/${data.tenants[0].id}/staff` : "/clubs/create"}
                  icon={<IconAlert className="text-hoop-500 h-3.5 w-3.5" />}
                  iconTone="bg-hoop-50"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-ink-950 text-base font-semibold">Teams</h3>
                <p className="text-ink-500 mt-1 text-sm">
                  A flat operating view across every club you manage.
                </p>
              </div>
              <Link
                href={
                  data.tenants[0] ? `/clubs/${data.tenants[0].id}/teams/create` : "/clubs/create"
                }
                className="border-ink-200 text-ink-600 hover:bg-ink-50 inline-flex items-center gap-1.5 rounded-xl border bg-white px-3.5 py-2 text-xs font-medium transition"
              >
                <IconPlus className="h-3 w-3" />
                Add team
              </Link>
            </div>

            {teams.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {teams.map((team) => {
                  const leadCoach = getLeadCoach(team)
                  const initials = team.players.map((entry) =>
                    getInitials(entry.player.firstName, entry.player.lastName)
                  )
                  const extraPlayers = Math.max(0, team._count.players - initials.length)

                  return (
                    <Link
                      key={team.id}
                      href={`/clubs/${team.tenant.id}/teams/${team.id}/dashboard`}
                      className={`hover:shadow-soft group rounded-2xl border p-4 transition hover:-translate-y-0.5 ${
                        leadCoach ? "border-ink-100 bg-white" : "border-hoop-200 bg-white"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="bg-court-50 text-court-700 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                          Active
                        </span>
                        <span className="text-ink-400 text-[10px] font-semibold uppercase tracking-[0.12em]">
                          {team.tenant.name}
                        </span>
                      </div>
                      <h4 className="font-display text-ink-950 group-hover:text-play-600 text-sm font-semibold transition">
                        {team.name}
                      </h4>
                      <p className="text-ink-400 mb-3 mt-1 text-[11px]">
                        {team.season || "Current season"}
                      </p>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex -space-x-1.5">
                          {initials.map((initial, index) => (
                            <PlayerBadge
                              key={`${team.id}-${index}`}
                              initial={initial}
                              tone={PLAYER_BADGE_TONES[index % PLAYER_BADGE_TONES.length]}
                            />
                          ))}
                          {extraPlayers > 0 && (
                            <div className="bg-ink-200 text-ink-500 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[8px] font-bold">
                              +{extraPlayers}
                            </div>
                          )}
                        </div>
                        <span className="text-ink-400 text-[11px]">
                          {team._count.players} players
                        </span>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 border-t pt-3 ${leadCoach ? "border-ink-50" : "border-hoop-100"}`}
                      >
                        {leadCoach ? (
                          <>
                            <div className="from-court-300 to-court-500 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br text-white">
                              <svg
                                className="h-2.5 w-2.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                            <span className="text-ink-500 text-[11px]">{leadCoach}</span>
                          </>
                        ) : (
                          <>
                            <div className="bg-hoop-100 text-hoop-500 flex h-4 w-4 items-center justify-center rounded-full">
                              <IconAlert className="h-2.5 w-2.5" />
                            </div>
                            <span className="text-hoop-600 text-[11px] font-medium">
                              No coach assigned
                            </span>
                          </>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="border-ink-200 rounded-2xl border border-dashed bg-white p-8 text-center">
                <h3 className="font-display text-ink-950 text-lg font-semibold">No teams yet</h3>
                <p className="text-ink-500 mt-2 text-sm">
                  Create a team in any club workspace and it will appear here in the operating grid.
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="border-ink-200 rounded-[28px] border-2 border-dashed bg-white p-8 text-center">
          <h3 className="text-ink-950 mb-2 text-lg font-semibold">Create Your Club</h3>
          <p className="text-ink-600 mb-4">
            You&apos;ve signed up as a club owner but haven&apos;t created your club yet. Get
            started now!
          </p>
          <Link
            href="/clubs/create"
            className="bg-play-600 hover:bg-play-700 inline-block rounded-2xl px-6 py-3 font-semibold text-white"
          >
            Create Club
          </Link>
        </div>
      )}
    </section>
  )
}

const PLAYER_BADGE_TONES = [
  "from-sky-300 to-sky-500",
  "from-court-300 to-court-500",
  "from-violet-300 to-violet-500",
]

function getLeadCoach(team: NonNullable<DashboardData["clubOwner"]>["teams"][number]) {
  const headCoach = team.staff.find((staffer) => staffer.designation === "HeadCoach")
  const fallbackCoach = team.staff[0]
  const selectedCoach = headCoach || fallbackCoach
  if (!selectedCoach) return null

  return (
    [selectedCoach.user.firstName, selectedCoach.user.lastName].filter(Boolean).join(" ") ||
    "Assigned coach"
  )
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase()
}

function PlayerBadge({ initial, tone }: { initial: string; tone: string }) {
  return (
    <div
      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br ${tone} text-[8px] font-bold text-white`}
    >
      {initial}
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="ring-ink-100 rounded-xl bg-white p-3 text-center ring-1">
      <div
        className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${tone}`}
      >
        {label}
      </div>
      <div className="text-ink-950 mt-2 text-xl font-bold">{value}</div>
    </div>
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
    <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
        <div className="text-ink-400 text-xs font-semibold uppercase tracking-[0.14em]">
          {label}
        </div>
      </div>
      <div className="font-display text-ink-950 text-2xl font-bold">{value}</div>
    </div>
  )
}

function AttentionRow({
  label,
  href,
  icon,
  iconTone,
}: {
  label: string
  href: string
  icon: JSX.Element
  iconTone: string
}) {
  return (
    <Link
      href={href}
      className="hover:bg-ink-50 group flex items-center gap-3 px-5 py-3 transition"
    >
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconTone}`}>
        {icon}
      </div>
      <div className="text-ink-700 flex-1 text-sm">{label}</div>
      <svg
        className="text-ink-300 group-hover:text-play-500 h-3.5 w-3.5 transition"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
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

function IconLayers({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="m12 2 9 5-9 5-9-5 9-5z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
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

function IconAlert({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
