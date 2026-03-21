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

  const tryouts: TeamTryout[] = await prisma.tryout.findMany({
    where: { tenantId, teamId },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      isPublished: true,
      _count: { select: { signups: true } },
    },
    orderBy: { scheduledAt: "desc" },
  }) as any

  const offers: TeamOffer[] = await prisma.offer.findMany({
    where: { teamId },
    select: {
      id: true,
      status: true,
      player: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  }) as any

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
        <Link href={`/clubs/${clubId}/teams`} className="text-sm text-orange-600 hover:underline">
          &larr; Back to Teams
        </Link>
      </div>

      {/* Team Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{team.name}</h2>
          <p className="text-sm text-gray-500">
            {team.ageGroup}
            {team.gender ? ` \u2022 ${team.gender}` : ""}
            {team.season ? ` \u2022 ${team.season}` : ""}
          </p>
          {/* Staff / Coaches */}
          {teamStaff.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {teamStaff.map((s) => (
                <span key={s.id} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  s.designation === "HeadCoach" ? "bg-orange-100 text-orange-700" :
                  s.designation === "AssistantCoach" ? "bg-green-100 text-green-700" :
                  s.role === "TeamManager" ? "bg-purple-100 text-purple-700" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {s.user?.firstName} {s.user?.lastName}
                  {" \u2022 "}
                  {s.designation === "HeadCoach" ? "Head Coach" :
                   s.designation === "AssistantCoach" ? "Asst. Coach" :
                   s.role === "TeamManager" ? "Manager" : s.role}
                </span>
              ))}
            </div>
          )}
          {teamStaff.length === 0 && (
            <div className="mt-2">
              <Link
                href={`/clubs/${clubId}/teams/${teamId}/edit`}
                className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700 hover:bg-orange-200"
              >
                No staff assigned — add now
              </Link>
            </div>
          )}
          {team.description && <p className="text-sm text-gray-600 mt-2">{team.description}</p>}
        </div>
        <Link href={`/clubs/${clubId}/teams/${teamId}/edit`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          Edit Team
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 mb-6 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{players.length}</div>
          <div className="text-xs text-gray-500">Players</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{tryouts.length}</div>
          <div className="text-xs text-gray-500">Tryouts</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{offers.length}</div>
          <div className="text-xs text-gray-500">Offers</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Roster */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Roster ({players.length})</h3>
            <Link href={`/clubs/${clubId}/teams/${teamId}/roster`}
              className="text-xs text-orange-600 hover:underline">View Full Roster</Link>
          </div>
          {players.length === 0 ? (
            <p className="text-sm text-gray-500">No players on roster yet. Send offers from tryout signups.</p>
          ) : (
            <div className="space-y-2">
              {players.slice(0, 8).map((tp) => (
                <div key={tp.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {tp.jerseyNumber !== null && (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                        {tp.jerseyNumber}
                      </span>
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {tp.player?.firstName} {tp.player?.lastName}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{tp.player?.position || ""}</span>
                </div>
              ))}
              {players.length > 8 && (
                <p className="text-xs text-gray-400 text-center">+{players.length - 8} more</p>
              )}
            </div>
          )}
        </div>

        {/* Tryouts */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Tryouts ({tryouts.length})</h3>
            <Link href={`/clubs/${clubId}/tryouts/create?teamId=${teamId}`}
              className="text-xs text-orange-600 hover:underline">Create Tryout</Link>
          </div>
          {tryouts.length === 0 ? (
            <p className="text-sm text-gray-500">No tryouts linked to this team.</p>
          ) : (
            <div className="space-y-2">
              {tryouts.map((tryout) => {
                const isPast = new Date(tryout.scheduledAt) < new Date()
                return (
                  <Link key={tryout.id} href={`/clubs/${clubId}/tryouts/${tryout.id}/signups`}
                    className="block rounded-md bg-gray-50 px-3 py-2 hover:bg-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{tryout.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        isPast ? "bg-gray-100 text-gray-600" :
                        tryout.isPublished ? "bg-green-100 text-green-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>
                        {isPast ? "Past" : tryout.isPublished ? "Published" : "Draft"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(tryout.scheduledAt), "MMM d, yyyy")}
                      {" \u2022 "}{tryout._count?.signups || 0} signups
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Offers */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Offers ({offers.length})</h3>
            <Link href={`/clubs/${clubId}/offers?team=${teamId}`}
              className="text-xs text-orange-600 hover:underline">View All Offers</Link>
          </div>
          {offers.length === 0 ? (
            <p className="text-sm text-gray-500">No offers sent for this team yet.</p>
          ) : (
            <div className="space-y-1">
              <div className="flex gap-3 mb-3">
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                  {pendingOffers.length} pending
                </span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  {acceptedOffers.length} accepted
                </span>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {declinedOffers.length} declined
                </span>
              </div>
              {offers.slice(0, 6).map((offer) => (
                <div key={offer.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                  <span className="text-sm text-gray-900">
                    {offer.player?.firstName} {offer.player?.lastName}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    offer.status === "ACCEPTED" ? "bg-green-100 text-green-700" :
                    offer.status === "DECLINED" ? "bg-red-100 text-red-700" :
                    offer.status === "EXPIRED" ? "bg-gray-100 text-gray-600" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    {offer.status.toLowerCase()}
                  </span>
                </div>
              ))}
              {offers.length > 6 && (
                <p className="text-xs text-gray-400 text-center">+{offers.length - 6} more</p>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/clubs/${clubId}/teams/${teamId}/roster`}
              className="rounded-md border border-gray-200 p-3 text-center text-sm hover:bg-gray-50">
              Roster
            </Link>
            <Link href={`/clubs/${clubId}/offer-templates`}
              className="rounded-md border border-gray-200 p-3 text-center text-sm hover:bg-gray-50">
              Offer Templates
            </Link>
            <Link href={`/clubs/${clubId}/teams/${teamId}/edit`}
              className="rounded-md border border-gray-200 p-3 text-center text-sm hover:bg-gray-50">
              Edit Team
            </Link>
            <Link href={`/clubs/${clubId}/tryouts/create?teamId=${teamId}`}
              className="rounded-md border border-gray-200 p-3 text-center text-sm hover:bg-gray-50">
              New Tryout
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
