import Link from "next/link"
import { StatTile, AnimatedNumber, Button, PanelHeader, Badge } from "@/components/ui"
import type { DashboardData } from "../get-dashboard-data"

interface ClubSectionProps {
  data: NonNullable<DashboardData["clubOwner"]>
}

export function ClubSection({ data }: ClubSectionProps) {
  const totalTeams = data.tenants.reduce((sum, tenant) => sum + tenant._count.teams, 0)
  const totalTryouts = data.tenants.reduce((sum, tenant) => sum + tenant._count.tryouts, 0)
  const teams = data.teams
  const primaryTenantId = data.tenants[0]?.id

  return (
    <section className="space-y-6">
      <div>
        <div className="mb-5">
          <h2 className="font-condensed text-ink-950 text-3xl font-bold uppercase tracking-wide">
            Club management
          </h2>
          <p className="text-ink-500 mt-1 text-sm">
            A closer-to-mock dashboard view for club operations, programs, and staffing.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Clubs"
            value={data.tenants.length}
            tone="brand"
            icon={<IconBuilding className="h-5 w-5" />}
            delay={0}
          />
          <StatTile
            label="Teams"
            value={totalTeams}
            tone="court"
            icon={<IconUsers className="h-5 w-5" />}
            delay={70}
          />
          <StatTile
            label="Tryouts"
            value={totalTryouts}
            tone="hoop"
            icon={<IconClipboard className="h-5 w-5" />}
            delay={140}
          />
          <StatTile
            label="Plans"
            value={new Set(data.tenants.map((tenant) => tenant.plan)).size}
            tone="ink"
            icon={<IconLayers className="h-5 w-5" />}
            delay={210}
          />
        </div>
      </div>

      <div
        className="reveal border-ink-100 shadow-soft overflow-hidden rounded-[28px] border bg-white"
        style={{ animationDelay: "260ms" }}
      >
        <PanelHeader variant="band" title="Needs attention" />
        <div className="space-y-2 p-4">
          <AttentionRow
            label={`${Math.max(data.tenants.length, 1)} club workspace${data.tenants.length === 1 ? "" : "s"} active`}
            href="/dashboard"
            icon={<IconBuilding className="text-play-600 h-4 w-4" />}
            iconTone="bg-play-50"
          />
          <AttentionRow
            label={`${totalTryouts} tryout${totalTryouts === 1 ? "" : "s"} currently tracked`}
            href={data.tenants[0] ? `/clubs/${data.tenants[0].id}/tryouts` : "/clubs/create"}
            icon={<IconClipboard className="text-hoop-500 h-4 w-4" />}
            iconTone="bg-hoop-50"
          />
          <AttentionRow
            label={`${totalTeams} team${totalTeams === 1 ? "" : "s"} across your clubs`}
            href={data.tenants[0] ? `/clubs/${data.tenants[0].id}/teams` : "/clubs/create"}
            icon={<IconUsers className="text-court-700 h-4 w-4" />}
            iconTone="bg-court-50"
          />
        </div>
      </div>

      {data.tenants.length > 0 ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div
              className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
              style={{ animationDelay: "320ms" }}
            >
              <PanelHeader title="Club workspaces" />
              <p className="text-ink-500 -mt-2 mb-5 text-sm">
                Each club keeps its own teams, programs, and settings, even when one account manages
                multiple organizations.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {data.tenants.map((tenant, index) => (
                  <div
                    key={tenant.id}
                    className="reveal border-ink-100 bg-ink-50 card-lift rounded-2xl border p-5 transition-colors hover:border-[color:var(--brand-line)]"
                    style={{ animationDelay: `${360 + index * 60}ms` }}
                  >
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

            <OfferPipeline pipeline={data.offerPipeline} primaryTenantId={primaryTenantId} />
          </div>

          <div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <PanelHeader title="Teams" />
                <p className="text-ink-500 -mt-2 text-sm">
                  A flat operating view across every club you manage.
                </p>
              </div>
              <Button
                href={
                  data.tenants[0] ? `/clubs/${data.tenants[0].id}/teams/create` : "/clubs/create"
                }
                variant="subtle"
                size="sm"
                icon={<IconPlus />}
              >
                Add team
              </Button>
            </div>

            {teams.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {teams.map((team, teamIndex) => {
                  const leadCoach = getLeadCoach(team)
                  const initials = team.players.map((entry) =>
                    getInitials(entry.player.firstName, entry.player.lastName)
                  )
                  const extraPlayers = Math.max(0, team._count.players - initials.length)

                  return (
                    <Link
                      key={team.id}
                      href={`/clubs/${team.tenant.id}/teams/${team.id}/dashboard`}
                      style={{ animationDelay: `${Math.min(teamIndex, 10) * 45}ms` }}
                      className={`reveal card-lift group rounded-2xl border p-4 ${
                        leadCoach
                          ? "border-ink-100 bg-white hover:border-[color:var(--brand-line)]"
                          : "border-hoop-200 bg-white"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <Badge tone="court">Active</Badge>
                        <span className="text-ink-400 text-[10px] font-semibold uppercase tracking-[0.12em]">
                          {team.tenant.name}
                        </span>
                      </div>
                      <h4 className="font-condensed text-ink-950 group-hover:text-[color:var(--brand-ink)] text-base font-bold uppercase tracking-wide transition">
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
              <div className="border-ink-200 rounded-[28px] border border-dashed bg-white p-8 text-center">
                <h3 className="font-condensed text-ink-950 text-xl font-bold uppercase tracking-wide">
                  No teams yet
                </h3>
                <p className="text-ink-500 mt-2 text-sm">
                  Create a team in any club workspace and it will appear here in the operating grid.
                </p>
              </div>
            )}
          </div>

          <ActivityFeed activity={data.activity} primaryTenantId={primaryTenantId} />
        </>
      ) : (
        <div className="reveal border-ink-200 rounded-[28px] border-2 border-dashed bg-white p-10 text-center">
          <h3 className="font-condensed text-ink-950 mb-2 text-2xl font-bold uppercase tracking-wide">
            Create Your Club
          </h3>
          <p className="text-ink-600 mb-5">
            You&apos;ve signed up as a club owner but haven&apos;t created your club yet. Get
            started now!
          </p>
          <div className="flex justify-center">
            <Button href="/clubs/create" size="lg" icon={<IconPlus />}>
              Create Club
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function OfferPipeline({
  pipeline,
  primaryTenantId,
}: {
  pipeline: NonNullable<DashboardData["clubOwner"]>["offerPipeline"]
  primaryTenantId: string | undefined
}) {
  const offersHref = primaryTenantId ? `/clubs/${primaryTenantId}/offers` : "/clubs/create"

  const stages = [
    {
      value: pipeline.pending,
      label: "Pending",
      seg: "bg-play-500",
      dot: "bg-play-500",
      num: "text-play-700",
      box: "bg-play-50 border-play-100",
    },
    {
      value: pipeline.accepted,
      label: "Accepted",
      seg: "bg-court-500",
      dot: "bg-court-500",
      num: "text-court-700",
      box: "bg-court-50 border-court-100",
    },
    {
      value: pipeline.declined,
      label: "Declined",
      seg: "bg-red-400",
      dot: "bg-red-400",
      num: "text-red-700",
      box: "bg-red-50 border-red-100",
    },
    {
      value: pipeline.expired,
      label: "Expired",
      seg: "bg-ink-300",
      dot: "bg-ink-300",
      num: "text-ink-500",
      box: "bg-ink-50 border-ink-100",
    },
  ]

  return (
    <div
      className="reveal border-ink-100 shadow-soft overflow-hidden rounded-[28px] border bg-white"
      style={{ animationDelay: "380ms" }}
    >
      <PanelHeader
        variant="band"
        title="Offer pipeline"
        action={
          <Link
            href={offersHref}
            className="text-[color:var(--brand-ink)] text-xs font-semibold transition hover:opacity-70"
          >
            View all
          </Link>
        }
      />
      <div className="p-5">
        <div className="grow-x bg-ink-100 mb-5 flex h-2.5 overflow-hidden rounded-full">
          {stages
            .filter((stage) => stage.value > 0)
            .map((stage) => (
              <div
                key={stage.label}
                className={stage.seg}
                style={{ flexGrow: stage.value, minWidth: 6 }}
                title={`${stage.label}: ${stage.value}`}
              />
            ))}
        </div>

        <div className="mb-5 grid grid-cols-4 gap-3">
          {stages.map((stage) => (
            <div key={stage.label} className={`rounded-xl border p-3 text-center ${stage.box}`}>
              <div className={`font-condensed text-2xl font-bold leading-none ${stage.num}`}>
                <AnimatedNumber value={stage.value} />
              </div>
              <div className="text-ink-500 mt-1 inline-flex items-center gap-1 text-[10px] font-medium">
                <span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} aria-hidden="true" />
                {stage.label}
              </div>
            </div>
          ))}
        </div>

        {pipeline.recent.length > 0 ? (
          <div className="space-y-2">
            {pipeline.recent.map((offer, index) => (
              <Link
                key={offer.id}
                href={`/clubs/${offer.team.tenantId}/offers`}
                className="hover:bg-ink-100/60 flex items-center gap-3 rounded-xl bg-[#f7f7f8] p-2.5 transition"
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white ${
                    OFFER_AVATAR_TONES[index % OFFER_AVATAR_TONES.length]
                  }`}
                >
                  {getInitials(offer.player.firstName, offer.player.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-ink-700 text-sm font-medium">
                    {offer.player.firstName} {offer.player.lastName}
                  </span>
                  <span className="text-ink-400 ml-2 text-xs">{offer.team.name}</span>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${OFFER_STATUS_TONES[offer.status] || "bg-ink-50 text-ink-600"}`}
                >
                  {formatStatus(offer.status)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-ink-400 text-xs">
            No offers yet. Send your first offer to see the pipeline fill up.
          </p>
        )}
      </div>
    </div>
  )
}

function ActivityFeed({
  activity,
  primaryTenantId,
}: {
  activity: NonNullable<DashboardData["clubOwner"]>["activity"]
  primaryTenantId: string | undefined
}) {
  if (activity.length === 0) return null

  return (
    <div
      className="reveal border-ink-100 shadow-soft overflow-hidden rounded-[28px] border bg-white"
      style={{ animationDelay: "440ms" }}
    >
      <PanelHeader
        variant="band"
        title="Recent activity"
        action={
          primaryTenantId ? (
            <Link
              href={`/clubs/${primaryTenantId}`}
              className="text-[color:var(--brand-ink)] text-xs font-semibold transition hover:opacity-70"
            >
              View all
            </Link>
          ) : undefined
        }
      />
      <div className="divide-ink-50 divide-y">
        {activity.map((entry) => {
          const visual = ACTIVITY_VISUALS[entry.type]
          return (
            <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
              <div
                className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${visual.tone}`}
              >
                {visual.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-ink-700 text-sm">
                  {entry.type === "tryout_published" || entry.type === "invite_sent" ? (
                    <>
                      {entry.type === "tryout_published" ? (
                        <>
                          <span className="text-ink-950 font-medium">{entry.highlight}</span>{" "}
                          {entry.message}
                        </>
                      ) : (
                        <>
                          {entry.message}{" "}
                          <span className="text-ink-950 font-medium">{entry.highlight}</span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-ink-950 font-medium">{entry.highlight}</span>{" "}
                      {entry.message}
                    </>
                  )}
                </p>
                <p className="text-ink-400 mt-0.5 text-[11px]">{formatRelative(entry.createdAt)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const OFFER_AVATAR_TONES = [
  "from-violet-300 to-violet-500",
  "from-court-300 to-court-500",
  "from-amber-300 to-amber-500",
  "from-sky-300 to-sky-500",
]

const OFFER_STATUS_TONES: Record<string, string> = {
  PENDING: "bg-play-50 text-play-700",
  ACCEPTED: "bg-court-50 text-court-700",
  DECLINED: "bg-red-50 text-red-700",
  EXPIRED: "bg-ink-100 text-ink-600",
}

const ACTIVITY_VISUALS: Record<
  NonNullable<DashboardData["clubOwner"]>["activity"][number]["type"],
  { tone: string; icon: JSX.Element }
> = {
  offer_accepted: {
    tone: "bg-court-50 text-court-600",
    icon: (
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  offer_declined: {
    tone: "bg-red-50 text-red-500",
    icon: (
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
  signup: {
    tone: "bg-play-50 text-play-600",
    icon: (
      <svg
        className="h-3.5 w-3.5"
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
    ),
  },
  invite_sent: {
    tone: "bg-violet-50 text-violet-600",
    icon: (
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  tryout_published: {
    tone: "bg-hoop-50 text-hoop-500",
    icon: (
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      </svg>
    ),
  },
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

function formatRelative(date: Date) {
  const diffMs = Date.now() - new Date(date).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`
  return new Date(date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
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
      <div className="font-condensed text-ink-950 mt-2 text-xl font-bold">
        <AnimatedNumber value={value} />
      </div>
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
      className="border-ink-100 group flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 transition-all duration-200 hover:translate-x-0.5 hover:border-[color:var(--brand-line)] hover:shadow-[0_10px_30px_-22px_rgba(15,23,42,0.45)]"
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconTone}`}>{icon}</div>
      <div className="text-ink-700 flex-1 text-sm">{label}</div>
      <svg
        className="text-ink-300 group-hover:text-[color:var(--brand-ink)] h-3.5 w-3.5 transition"
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
