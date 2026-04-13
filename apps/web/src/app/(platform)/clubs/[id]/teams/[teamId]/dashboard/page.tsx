import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import Link from "next/link"
import { notFound } from "next/navigation"

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
      players: {
        include: {
          player: {
            select: { id: true, firstName: true, lastName: true, position: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
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
    players: TeamPlayer[]
    staff: StaffMember[]
  }

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

  return {
    team: {
      ...team,
      // Convert any Decimal fields
      seasonFee: team.seasonFee ? Number(team.seasonFee) : null,
    },
    tryouts,
    offers,
  }
}

export default async function TeamDashboardPage({
  params,
}: {
  params: { id: string; teamId: string }
}) {
  const data = await getTeamDashboardData(params.teamId, params.id)
  if (!data) notFound()

  const { team, tryouts, offers } = data
  const clubId = params.id
  const teamId = params.teamId

  const players = team.players || []
  const teamStaff = team.staff.filter((s) => s.teamId === teamId)
  const pendingOffers = offers.filter((o) => o.status === "PENDING")
  const acceptedOffers = offers.filter((o) => o.status === "ACCEPTED")
  const declinedOffers = offers.filter((o) => o.status === "DECLINED")

  return (
    <div>
      <div className="mb-6">
        <Link href={`/clubs/${clubId}/teams`} className="text-play-700 text-sm hover:underline">
          &larr; Back to Teams
        </Link>
      </div>

      {/* Team Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-ink-900 text-2xl font-bold">{team.name}</h2>
          <p className="text-ink-500 text-sm">
            {team.ageGroup}
            {team.gender ? ` \u2022 ${team.gender}` : ""}
            {team.season ? ` \u2022 ${team.season}` : ""}
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
                  {" \u2022 "}
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
        <Link
          href={`/clubs/${clubId}/teams/${teamId}/edit`}
          className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
        >
          Edit Team
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-4 text-center">
          <div className="text-court-700 text-2xl font-bold">{players.length}</div>
          <div className="text-ink-500 text-xs">Players</div>
        </div>
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-4 text-center">
          <div className="text-hoop-600 text-2xl font-bold">{tryouts.length}</div>
          <div className="text-ink-500 text-xs">Tryouts</div>
        </div>
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-4 text-center">
          <div className="text-play-700 text-2xl font-bold">{offers.length}</div>
          <div className="text-ink-500 text-xs">Offers</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Roster */}
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-ink-900 font-semibold">Roster ({players.length})</h3>
            <Link
              href={`/clubs/${clubId}/teams/${teamId}/roster`}
              className="text-play-700 text-xs hover:underline"
            >
              View Full Roster
            </Link>
          </div>
          {players.length === 0 ? (
            <p className="text-ink-500 text-sm">
              No players on roster yet. Send offers from tryout signups.
            </p>
          ) : (
            <div className="space-y-2">
              {players.slice(0, 8).map((tp) => (
                <div
                  key={tp.id}
                  className="bg-court-50 flex items-center justify-between rounded-xl px-3 py-2"
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
        </div>

        {/* Tryouts */}
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-ink-900 font-semibold">Tryouts ({tryouts.length})</h3>
            <Link
              href={`/clubs/${clubId}/tryouts/create?teamId=${teamId}`}
              className="text-play-700 text-xs hover:underline"
            >
              Create Tryout
            </Link>
          </div>
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
                    className="bg-court-50 hover:bg-court-100 block rounded-xl px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-ink-900 text-sm font-medium">{tryout.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          isPast
                            ? "bg-court-100 text-ink-600"
                            : tryout.isPublished
                              ? "bg-court-100 text-court-700"
                              : "bg-hoop-100 text-hoop-700"
                        }`}
                      >
                        {isPast ? "Past" : tryout.isPublished ? "Published" : "Draft"}
                      </span>
                    </div>
                    <div className="text-ink-500 text-xs">
                      {format(new Date(tryout.scheduledAt), "MMM d, yyyy")}
                      {" \u2022 "}
                      {tryout._count?.signups || 0} signups
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Offers */}
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-ink-900 font-semibold">Offers ({offers.length})</h3>
            <Link
              href={`/clubs/${clubId}/offers?team=${teamId}`}
              className="text-play-700 text-xs hover:underline"
            >
              View All Offers
            </Link>
          </div>
          {offers.length === 0 ? (
            <p className="text-ink-500 text-sm">No offers sent for this team yet.</p>
          ) : (
            <div className="space-y-1">
              <div className="mb-3 flex gap-3">
                <span className="bg-hoop-100 text-hoop-700 rounded-full px-2 py-0.5 text-xs font-medium">
                  {pendingOffers.length} pending
                </span>
                <span className="bg-court-100 text-court-700 rounded-full px-2 py-0.5 text-xs font-medium">
                  {acceptedOffers.length} accepted
                </span>
                <span className="bg-hoop-100 text-hoop-700 rounded-full px-2 py-0.5 text-xs font-medium">
                  {declinedOffers.length} declined
                </span>
              </div>
              {offers.slice(0, 6).map((offer) => (
                <div
                  key={offer.id}
                  className="bg-court-50 flex items-center justify-between rounded-xl px-3 py-2"
                >
                  <span className="text-ink-900 text-sm">
                    {offer.player?.firstName} {offer.player?.lastName}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      offer.status === "ACCEPTED"
                        ? "bg-court-100 text-court-700"
                        : offer.status === "DECLINED"
                          ? "bg-hoop-100 text-hoop-700"
                          : offer.status === "EXPIRED"
                            ? "bg-court-100 text-ink-600"
                            : "bg-hoop-100 text-hoop-700"
                    }`}
                  >
                    {offer.status.toLowerCase()}
                  </span>
                </div>
              ))}
              {offers.length > 6 && (
                <p className="text-ink-400 text-center text-xs">+{offers.length - 6} more</p>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <h3 className="text-ink-900 mb-4 font-semibold">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/clubs/${clubId}/teams/${teamId}/roster`}
              className="border-ink-200 hover:bg-court-50 rounded-xl border p-3 text-center text-sm"
            >
              Roster
            </Link>
            <Link
              href={`/clubs/${clubId}/offer-templates`}
              className="border-ink-200 hover:bg-court-50 rounded-xl border p-3 text-center text-sm"
            >
              Offer Templates
            </Link>
            <Link
              href={`/clubs/${clubId}/teams/${teamId}/edit`}
              className="border-ink-200 hover:bg-court-50 rounded-xl border p-3 text-center text-sm"
            >
              Edit Team
            </Link>
            <Link
              href={`/clubs/${clubId}/tryouts/create?teamId=${teamId}`}
              className="border-ink-200 hover:bg-court-50 rounded-xl border p-3 text-center text-sm"
            >
              New Tryout
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
