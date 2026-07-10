import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { Button, Badge, AnimatedNumber } from "@/components/ui"
import { TeamsFilter } from "./teams-filter"

interface TeamListItem {
  id: string
  name: string
  ageGroup: string
  gender: string | null
  season: string | null
  description: string | null
  archivedAt: Date | null
  createdAt: Date
  _count: {
    players: number
    tryouts: number
    offers: number
  }
  staff: {
    designation: string | null
    user: { firstName: string | null; lastName: string | null } | null
  }[]
  offers: { status: string }[]
  seasonSubmissions: {
    id: string
    status: string
    season: { id: string; label: string; league: { name: string } }
  }[]
}

const SUBMISSION_CHIP: Record<string, string> = {
  APPROVED: "bg-court-100 text-court-700",
  PENDING: "bg-hoop-100 text-hoop-700",
  REJECTED: "bg-hoop-100 text-hoop-700",
  WITHDRAWN: "bg-court-100 text-ink-500",
}

const PLUS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
)

const TROPHY_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 4h10v4a5 5 0 01-10 0V4z" />
    <path
      d="M7 4H4v2a3 3 0 003 3M17 4h3v2a3 3 0 01-3 3M9 21h6M12 13v8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ROLLOVER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path
      d="M4 9a8 8 0 0114-3M4 4v5h5M20 15a8 8 0 01-14 3M20 20v-5h-5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

async function getTeams(tenantId: string): Promise<TeamListItem[]> {
  return await prisma.team.findMany({
    where: { tenantId },
    include: {
      _count: {
        select: { players: true, tryouts: true, offers: true },
      },
      staff: {
        where: { role: { in: ["Staff", "TeamManager"] } },
        select: {
          designation: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
      offers: { select: { status: true } },
      seasonSubmissions: {
        select: {
          id: true,
          status: true,
          season: { select: { id: true, label: true, league: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

/** teamId -> W–L across completed games (defaults count as losses for the defaulting side). */
async function getRecords(tenantId: string): Promise<Map<string, { w: number; l: number }>> {
  const games = await prisma.game.findMany({
    where: {
      status: "COMPLETED",
      OR: [{ homeTeam: { tenantId } }, { awayTeam: { tenantId } }],
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  })
  const records = new Map<string, { w: number; l: number }>()
  const bump = (teamId: string, won: boolean) => {
    const r = records.get(teamId) ?? { w: 0, l: 0 }
    if (won) r.w++
    else r.l++
    records.set(teamId, r)
  }
  for (const g of games) {
    if (g.homeScore === g.awayScore) continue
    const homeWon = (g.homeScore ?? 0) > (g.awayScore ?? 0)
    bump(g.homeTeamId, homeWon)
    bump(g.awayTeamId, !homeWon)
  }
  return records
}

export default async function ClubTeamsPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { age?: string; q?: string; archived?: string }
}) {
  const [teams, records] = await Promise.all([getTeams(params.id), getRecords(params.id)])

  const showArchived = searchParams.archived === "1"
  const activeTeams = teams.filter((t) => !t.archivedAt)
  const archivedTeams = teams.filter((t) => t.archivedAt)
  const view = showArchived ? archivedTeams : activeTeams

  const ageFilter = searchParams.age
  const searchQuery = searchParams.q?.toLowerCase()

  // Get unique age groups for filter (within the current view)
  const ageGroups = [...new Set(view.map((t) => t.ageGroup))].sort()

  // Apply filters
  const filtered = view.filter((t) => {
    if (ageFilter && t.ageGroup !== ageFilter) return false
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery)) return false
    return true
  })

  const baseUrl = `/clubs/${params.id}/teams${showArchived ? "?archived=1" : ""}`

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-condensed text-ink-950 flex items-center gap-2.5 text-2xl font-bold uppercase tracking-wide">
          <span className="h-6 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden />
          {showArchived ? `Archived teams (${archivedTeams.length})` : `Teams (${activeTeams.length})`}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {showArchived ? (
            <Button href={`/clubs/${params.id}/teams`} variant="subtle">
              Active teams ({activeTeams.length})
            </Button>
          ) : (
            archivedTeams.length > 0 && (
              <Button href={`/clubs/${params.id}/teams?archived=1`} variant="subtle">
                Archived ({archivedTeams.length})
              </Button>
            )
          )}
          <Button href="/browse-leagues" variant="subtle" icon={TROPHY_ICON}>
            Add a Team to a League
          </Button>
          <Button href={`/clubs/${params.id}/teams/create`} icon={PLUS_ICON}>
            Create Team
          </Button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="reveal border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="text-ink-900 mb-2 text-lg font-semibold">No teams yet</h3>
          <p className="text-ink-600 mb-6">
            Create your first team to start managing players and scheduling games.
          </p>
          <div className="flex justify-center">
            <Button href={`/clubs/${params.id}/teams/create`} size="lg" icon={PLUS_ICON}>
              Create Your First Team
            </Button>
          </div>
        </div>
      ) : view.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="text-ink-900 mb-2 text-lg font-semibold">
            {showArchived ? "No archived teams" : "No active teams"}
          </h3>
          <p className="text-ink-600 mb-6">
            {showArchived
              ? "When a season ends, start the next one from a team — the old team lands here as read-only history."
              : "All of your teams are archived. Start a new season from an archived team, or create a fresh one."}
          </p>
          <div className="flex justify-center">
            <Button
              href={showArchived ? `/clubs/${params.id}/teams` : `/clubs/${params.id}/teams?archived=1`}
              variant="subtle"
            >
              {showArchived ? "Back to active teams" : `View archived (${archivedTeams.length})`}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <TeamsFilter
            clubId={params.id}
            ageGroups={ageGroups}
            activeAge={ageFilter}
            activeSearch={searchParams.q}
            archived={showArchived}
          />

          {filtered.length === 0 ? (
            <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-8 text-center">
              <p className="text-ink-600 mb-3">No teams match the current filters.</p>
              <div className="flex justify-center">
                <Button href={baseUrl} variant="subtle" size="sm">
                  Clear filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((team, i) => {
                const pendingOffers = team.offers.filter((o) => o.status === "PENDING").length
                const acceptedOffers = team.offers.filter((o) => o.status === "ACCEPTED").length
                const headCoach = team.staff.find((s) => s.designation === "HeadCoach")
                const record = records.get(team.id)
                const activeSubmissions = team.seasonSubmissions.filter(
                  (s) => s.status !== "WITHDRAWN" && s.status !== "REJECTED"
                )
                const isArchived = !!team.archivedAt

                return (
                  <div
                    key={team.id}
                    style={{ animationDelay: `${Math.min(i * 50, 400)}ms` }}
                    className={`reveal card-lift border-ink-100 shadow-soft hover:shadow-panel relative rounded-2xl border bg-white p-6 hover:border-[color:var(--brand-line)] ${
                      isArchived ? "opacity-60 transition-opacity hover:opacity-100" : ""
                    }`}
                  >
                    {/* Stretched link — whole card opens the dashboard; action
                        buttons below sit above it (relative) */}
                    <Link
                      href={`/clubs/${params.id}/teams/${team.id}/dashboard`}
                      className="absolute inset-0 rounded-2xl"
                      aria-label={`Open ${team.name}`}
                    />

                    <div className="mb-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-ink-900 text-xl font-bold">{team.name}</h3>
                        <span className="flex shrink-0 gap-1.5">
                          {isArchived && <Badge tone="neutral">Archived</Badge>}
                          {!headCoach && !isArchived && <Badge tone="hoop">No coach</Badge>}
                        </span>
                      </div>
                      <p className="text-ink-600 text-sm">
                        {team.ageGroup}
                        {team.gender ? ` • ${team.gender}` : ""}
                        {team.season ? ` • ${team.season}` : ""}
                      </p>
                      {headCoach?.user && (
                        <p className="text-ink-500 text-xs">
                          Coach: {headCoach.user.firstName} {headCoach.user.lastName}
                        </p>
                      )}
                    </div>

                    {/* League membership */}
                    {activeSubmissions.length > 0 ? (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {activeSubmissions.map((s) => (
                          <span
                            key={s.id}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${SUBMISSION_CHIP[s.status] ?? "bg-court-100 text-ink-600"}`}
                            title={`${s.season.league.name} ${s.season.label} — ${s.status.toLowerCase()}`}
                          >
                            {s.season.league.name}
                            {s.status === "PENDING" ? " · pending" : ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="mb-3">
                        <Badge tone="neutral">Not in a league yet</Badge>
                      </div>
                    )}

                    {team.description && (
                      <p className="text-ink-700 mb-3 line-clamp-2 text-sm">{team.description}</p>
                    )}

                    {/* Status indicators */}
                    {(pendingOffers > 0 || acceptedOffers > 0) && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {pendingOffers > 0 && (
                          <Badge tone="hoop">
                            {pendingOffers} pending offer{pendingOffers !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        {acceptedOffers > 0 && <Badge tone="court">{acceptedOffers} accepted</Badge>}
                      </div>
                    )}

                    <div className="border-ink-100 grid grid-cols-2 gap-2 border-t pt-3 text-center sm:grid-cols-4">
                      <div>
                        <div className="font-condensed text-2xl font-bold leading-none text-[color:var(--brand-ink)]">
                          <AnimatedNumber value={team._count.players} />
                        </div>
                        <div className="text-ink-500 mt-1 text-xs">Players</div>
                      </div>
                      <div>
                        <div className="font-condensed text-ink-900 text-2xl font-bold leading-none">
                          {record ? `${record.w}–${record.l}` : "—"}
                        </div>
                        <div className="text-ink-500 mt-1 text-xs">Record</div>
                      </div>
                      <div>
                        <div className="font-condensed text-hoop-600 text-2xl font-bold leading-none">
                          <AnimatedNumber value={team._count.tryouts} />
                        </div>
                        <div className="text-ink-500 mt-1 text-xs">Tryouts</div>
                      </div>
                      <div>
                        <div className="font-condensed text-play-700 text-2xl font-bold leading-none">
                          <AnimatedNumber value={team._count.offers} />
                        </div>
                        <div className="text-ink-500 mt-1 text-xs">Offers</div>
                      </div>
                    </div>

                    {/* Season rollover actions — above the stretched link */}
                    <div className="relative mt-4 flex justify-end">
                      {isArchived ? (
                        <Button
                          href={`/clubs/${params.id}/teams/${team.id}/next-season`}
                          size="sm"
                          icon={ROLLOVER_ICON}
                        >
                          Start next season
                        </Button>
                      ) : (
                        <Button
                          href={`/clubs/${params.id}/teams/${team.id}/next-season`}
                          variant="subtle"
                          size="sm"
                          icon={ROLLOVER_ICON}
                        >
                          Next season
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
