import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getUnreadChatCounts } from "@/lib/teams/chat-access"
import { getTeamRoster } from "@/lib/teams/roster"
import { getActiveSeasonInvolvement, lifecycleLockReason } from "@/lib/teams/lifecycle"
import { Badge, Button, PanelHeader, SmartBack, StatTile, toneForStatus } from "@/components/ui"
import { ArchivedTeamBanner, TeamSeasonActions } from "./team-season-actions"

interface StaffMember {
  id: string
  role: string
  teamId: string | null
  designation: string | null
  user: { firstName: string | null; lastName: string | null } | null
}

interface TeamPlayer {
  id: string
  playerId: string
  jerseyNumber: number | null
  player: { id: string; firstName: string; lastName: string; position: string | null } | null
}

interface TeamOffer {
  id: string
  status: string
  player: { firstName: string; lastName: string } | null
}

interface TeamTryout {
  id: string
  title: string
  scheduledAt: Date
  isPublished: boolean
  _count: { signups: number } | null
}

async function getTeamDashboardData(teamId: string, tenantId: string) {
  const teamRaw = await prisma.team.findFirst({
    where: { id: teamId, tenantId },
    include: {
      staff: {
        where: { teamId },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  if (!teamRaw) return null

  const team = teamRaw as any as {
    id: string
    name: string
    ageGroup: string
    gender: string | null
    season: string | null
    description: string | null
    seasonFee: any
    archivedAt: Date | null
    staff: StaffMember[]
  }

  // Shared roster source (lib/teams/roster.ts) — same helper as the coach
  // team home, so roster changes land in one place.
  const players: TeamPlayer[] = await getTeamRoster(teamId, { orderBy: "joined" })

  const tryouts: TeamTryout[] = (await prisma.tryout.findMany({
    where: { tenantId, teamId },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      isPublished: true,
      _count: { select: { signups: true } },
    },
    orderBy: { scheduledAt: "desc" },
  })) as any

  const offers: TeamOffer[] = (await prisma.offer.findMany({
    where: { teamId },
    select: {
      id: true,
      status: true,
      player: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  })) as any

  const submissions = (await prisma.teamSubmission.findMany({
    where: { teamId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      division: { select: { name: true } },
      season: {
        select: { id: true, label: true, status: true, league: { select: { name: true } } },
      },
      roster: {
        select: { id: true, isLocked: true, submittedAt: true, _count: { select: { players: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })) as any[]

  return {
    team: {
      ...team,
      // Convert any Decimal fields
      seasonFee: team.seasonFee ? Number(team.seasonFee) : null,
    },
    players,
    tryouts,
    offers,
    submissions,
  }
}

export default async function TeamDashboardPage({
  params,
}: {
  params: { id: string; teamId: string }
}) {
  const data = await getTeamDashboardData(params.teamId, params.id)
  if (!data) notFound()

  const auth = await getSessionUserId()
  const chatUnread = auth
    ? ((await getUnreadChatCounts(auth.userId, [params.teamId])).get(params.teamId) ?? 0)
    : 0

  const { team, players, tryouts, offers, submissions } = data
  const clubId = params.id
  const teamId = params.teamId

  // Lifecycle actions are club-operator-only, and locked mid-season
  // (owner 2026-07-15) — same rule the APIs enforce.
  const operatorRole = auth
    ? await prisma.userRole.findFirst({
        where: {
          userId: auth.userId,
          OR: [
            { tenantId: clubId, role: { in: ["ClubOwner", "ClubManager"] } },
            { role: "PlatformAdmin" },
          ],
        },
        select: { id: true },
      })
    : null
  const canLifecycle = !!operatorRole || !!auth?.isPlatformAdmin
  const lifecycleLock = canLifecycle
    ? lifecycleLockReason(await getActiveSeasonInvolvement(teamId))
    : null
  const isArchived = !!team.archivedAt
  const teamStaff = team.staff.filter((s) => s.teamId === teamId)
  const pendingOffers = offers.filter((o) => o.status === "PENDING")
  const acceptedOffers = offers.filter((o) => o.status === "ACCEPTED")
  const declinedOffers = offers.filter((o) => o.status === "DECLINED")

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <SmartBack fallback={`/clubs/${clubId}/teams`} fallbackLabel="Teams" className="-ml-1" />
        <Button href={`/team/${teamId}`} variant="subtle" size="sm">
          View public page &rarr;
        </Button>
      </div>

      {/* Archived — read-only history + Unarchive / Start next season */}
      {isArchived && <ArchivedTeamBanner clubId={clubId} teamId={teamId} />}

      {/* Team Header */}
      <div className="reveal mb-6 flex items-start justify-between">
        <div>
          <h2 className="font-condensed text-ink-950 text-3xl font-bold uppercase leading-none tracking-wide">
            {team.name}
          </h2>
          <p className="text-ink-500 mt-1.5 text-sm font-medium">
            {team.ageGroup}
            {team.gender ? ` • ${team.gender}` : ""}
            {team.season ? ` • ${team.season}` : ""}
          </p>
          {/* Staff / Coaches */}
          {teamStaff.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {teamStaff.map((s) => (
                <span
                  key={s.id}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    s.designation === "HeadCoach"
                      ? "bg-play-100 text-play-700"
                      : s.designation === "AssistantCoach"
                        ? "bg-court-100 text-court-700"
                        : s.role === "TeamManager"
                          ? "bg-play-100 text-play-700"
                          : "bg-court-100 text-ink-700"
                  }`}
                >
                  {s.user?.firstName} {s.user?.lastName}
                  {" • "}
                  {s.designation === "HeadCoach"
                    ? "Head Coach"
                    : s.designation === "AssistantCoach"
                      ? "Asst. Coach"
                      : s.role === "TeamManager"
                        ? "Manager"
                        : s.role}
                </span>
              ))}
            </div>
          )}
          {teamStaff.length === 0 && (
            <div className="mt-2">
              <Link
                href={`/clubs/${clubId}/teams/${teamId}/edit`}
                className="bg-play-100 text-play-700 hover:bg-play-200 rounded-full px-2.5 py-0.5 text-xs font-medium"
              >
                No staff assigned — add now
              </Link>
            </div>
          )}
          {team.description && <p className="text-ink-600 mt-2 text-sm">{team.description}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {!isArchived && canLifecycle && (
            <TeamSeasonActions
              clubId={clubId}
              teamId={teamId}
              teamName={team.name}
              lockedReason={lifecycleLock}
            />
          )}
          <Button href={`/clubs/${clubId}/teams/${teamId}/edit`} variant="subtle" size="sm">
            Edit Team
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          value={players.length}
          label="Players"
          tone="court"
          icon={TILE_ICONS.players}
          delay={0}
        />
        <StatTile
          value={tryouts.length}
          label="Tryouts"
          tone="hoop"
          icon={TILE_ICONS.tryouts}
          delay={70}
        />
        <StatTile
          value={offers.length}
          label="Offers"
          tone="play"
          icon={TILE_ICONS.offers}
          delay={140}
          sub={pendingOffers.length > 0 ? `${pendingOffers.length} pending` : null}
          subTone="hoop"
        />
      </div>

      {/* Leagues — where this team plays */}
      <section
        className="reveal border-ink-100 shadow-soft mb-6 rounded-[28px] border bg-white p-6"
        style={{ animationDelay: "210ms" }}
      >
        <PanelHeader
          title={`Leagues (${submissions.filter((s: any) => s.status !== "WITHDRAWN").length})`}
          action={
            <Button href={`/browse-leagues?team=${teamId}`} tone="play" size="sm">
              Add this team to a league
            </Button>
          }
        />
        {submissions.length === 0 ? (
          <p className="text-ink-500 text-sm">
            This team isn&apos;t registered in any league yet. Browse open leagues and submit the
            roster in a couple of clicks.
          </p>
        ) : (
          <div className="space-y-2">
            {submissions.map((s: any) => (
              <div
                key={s.id}
                className="border-ink-100 bg-ink-50 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-ink-900 flex items-center gap-2 text-sm font-semibold">
                    {s.season.league.name}
                    <span className="text-ink-400 font-normal">· {s.season.label}</span>
                    {s.division && (
                      <span className="text-ink-400 font-normal">· {s.division.name}</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={toneForStatus(s.status)}>{s.status.toLowerCase()}</Badge>
                    {s.paymentStatus && (
                      <Badge tone={toneForStatus(s.paymentStatus)}>
                        fee {s.paymentStatus.toLowerCase()}
                      </Badge>
                    )}
                    {s.roster && (
                      <Badge tone={s.roster.isLocked ? "neutral" : "play"}>
                        {s.roster.isLocked ? "🔒 roster locked" : "roster open"} ·{" "}
                        {s.roster._count.players} players
                      </Badge>
                    )}
                  </div>
                </div>
                {s.roster && (
                  <Button
                    href={`/clubs/${clubId}/teams/${teamId}/league-rosters?submission=${s.id}`}
                    variant="subtle"
                    size="sm"
                    className="shrink-0"
                  >
                    View league roster
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Roster */}
        <section
          className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
          style={{ animationDelay: "260ms" }}
        >
          <PanelHeader
            title={`Roster (${players.length})`}
            action={
              <Link
                href={`/clubs/${clubId}/teams/${teamId}/roster`}
                className="text-play-700 text-xs font-semibold hover:underline"
              >
                View Full Roster
              </Link>
            }
          />
          {players.length === 0 ? (
            <p className="text-ink-500 text-sm">
              No players on roster yet. Send offers from tryout signups.
            </p>
          ) : (
            <div className="space-y-2">
              {players.slice(0, 8).map((tp) => (
                <div
                  key={tp.id}
                  className="bg-ink-50 flex items-center justify-between rounded-xl px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    {tp.jerseyNumber !== null && (
                      <span className="bg-play-100 text-play-700 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                        {tp.jerseyNumber}
                      </span>
                    )}
                    <span className="text-ink-900 text-sm font-medium">
                      {tp.player?.firstName} {tp.player?.lastName}
                    </span>
                  </div>
                  <span className="text-ink-500 text-xs">{tp.player?.position || ""}</span>
                </div>
              ))}
              {players.length > 8 && (
                <p className="text-ink-400 text-center text-xs">+{players.length - 8} more</p>
              )}
            </div>
          )}
        </section>

        {/* Tryouts */}
        <section
          className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
          style={{ animationDelay: "320ms" }}
        >
          <PanelHeader
            title={`Tryouts (${tryouts.length})`}
            action={
              <Link
                href={`/clubs/${clubId}/tryouts/create?teamId=${teamId}`}
                className="text-play-700 text-xs font-semibold hover:underline"
              >
                Create Tryout
              </Link>
            }
          />
          {tryouts.length === 0 ? (
            <p className="text-ink-500 text-sm">No tryouts linked to this team.</p>
          ) : (
            <div className="space-y-2">
              {tryouts.map((tryout) => {
                const isPast = new Date(tryout.scheduledAt) < new Date()
                return (
                  <Link
                    key={tryout.id}
                    href={`/clubs/${clubId}/tryouts/${tryout.id}/signups`}
                    className="border-ink-100 block rounded-xl border bg-white px-3 py-2 transition-all duration-200 hover:translate-x-0.5 hover:border-[color:var(--brand-line)] hover:shadow-[0_10px_30px_-22px_rgba(15,23,42,0.45)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-ink-900 text-sm font-medium">{tryout.title}</span>
                      <Badge
                        tone={
                          isPast
                            ? "neutral"
                            : toneForStatus(tryout.isPublished ? "PUBLISHED" : "DRAFT")
                        }
                      >
                        {isPast ? "Past" : tryout.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <div className="text-ink-500 mt-0.5 text-xs">
                      {format(new Date(tryout.scheduledAt), "MMM d, yyyy")}
                      {" • "}
                      {tryout._count?.signups || 0} signups
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Offers */}
        <section
          className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
          style={{ animationDelay: "380ms" }}
        >
          <PanelHeader
            title={`Offers (${offers.length})`}
            action={
              <span className="flex items-center gap-3">
                {acceptedOffers.length > 0 && (
                  <Link
                    href={`/clubs/${clubId}/offers/summary?team=${teamId}`}
                    className="text-play-700 text-xs font-semibold hover:underline"
                  >
                    Order Sheet
                  </Link>
                )}
                <Link
                  href={`/clubs/${clubId}/offers?team=${teamId}`}
                  className="text-play-700 text-xs font-semibold hover:underline"
                >
                  View All Offers
                </Link>
              </span>
            }
          />
          {offers.length === 0 ? (
            <p className="text-ink-500 text-sm">No offers sent for this team yet.</p>
          ) : (
            <div className="space-y-1">
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge tone={toneForStatus("PENDING")}>{pendingOffers.length} pending</Badge>
                <Badge tone={toneForStatus("ACCEPTED")}>{acceptedOffers.length} accepted</Badge>
                <Badge tone={toneForStatus("DECLINED")}>{declinedOffers.length} declined</Badge>
              </div>
              {offers.slice(0, 6).map((offer) => (
                <div
                  key={offer.id}
                  className="bg-ink-50 flex items-center justify-between rounded-xl px-3 py-2"
                >
                  <span className="text-ink-900 text-sm">
                    {offer.player?.firstName} {offer.player?.lastName}
                  </span>
                  <Badge tone={toneForStatus(offer.status)}>{offer.status.toLowerCase()}</Badge>
                </div>
              ))}
              {offers.length > 6 && (
                <p className="text-ink-400 text-center text-xs">+{offers.length - 6} more</p>
              )}
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section
          className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6"
          style={{ animationDelay: "440ms" }}
        >
          <PanelHeader title="Quick Actions" />
          <div className="grid grid-cols-2 gap-2">
            <Button href={`/clubs/${clubId}/teams/${teamId}/roster`} variant="subtle" block>
              Roster
            </Button>
            <Button href={`/clubs/${clubId}/offer-templates`} variant="subtle" block>
              Offer Templates
            </Button>
            <Button href={`/clubs/${clubId}/offers/summary?team=${teamId}`} variant="subtle" block>
              Order Sheet
            </Button>
            <Button href={`/teams/${teamId}/chat`} variant="subtle" block className="relative">
              Team Chat
              {chatUnread > 0 && (
                <span className="bg-hoop-500 absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
                  {chatUnread}
                </span>
              )}
            </Button>
            <Button href={`/teams/${teamId}/polls`} variant="subtle" block>
              Polls
            </Button>
            <Button href={`/teams/${teamId}/calendar`} variant="subtle" block>
              Calendar
            </Button>
            <Button href={`/clubs/${clubId}/teams/${teamId}/edit`} variant="subtle" block>
              Edit Team
            </Button>
            <Button href={`/clubs/${clubId}/tryouts/create?teamId=${teamId}`} variant="subtle" block>
              New Tryout
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

/** Full SVG icons for the stat tiles (20×20). */
const TILE_ICONS: Record<string, ReactNode> = {
  players: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
    </svg>
  ),
  tryouts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" strokeLinejoin="round" />
      <path d="M9 13l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  offers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}
