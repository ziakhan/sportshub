import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"

interface OverviewTeam {
  id: string
  name: string
  ageGroup: string
  staff: { id: string }[]
  _count: { players: number }
}

interface OverviewTryout {
  id: string
  title: string
  scheduledAt: Date
  isPublished: boolean
  team: { name: string } | null
  signups: { id: string; offers: { status: string }[] }[]
}

async function getClubOverview(clubId: string) {
  const teamCount = await prisma.team.count({ where: { tenantId: clubId } })
  const tryoutCount = await prisma.tryout.count({ where: { tenantId: clubId } })
  const staffCount = await prisma.userRole.count({
    where: {
      tenantId: clubId,
      role: { in: ["ClubOwner", "ClubManager", "Staff"] },
    },
  })
  const pendingInvites = await prisma.staffInvitation.count({
    where: { tenantId: clubId, status: "PENDING" },
  })

  const teams: OverviewTeam[] = await prisma.team.findMany({
    where: { tenantId: clubId },
    select: {
      id: true,
      name: true,
      ageGroup: true,
      staff: {
        where: { designation: "HeadCoach" },
        select: { id: true },
      },
      _count: { select: { players: true } },
    },
  }) as any

  const tryoutsWithSignups: OverviewTryout[] = await prisma.tryout.findMany({
    where: { tenantId: clubId },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      isPublished: true,
      team: { select: { name: true } },
      signups: {
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true,
          offers: { select: { status: true }, take: 1 },
        },
      },
    },
    orderBy: { scheduledAt: "desc" },
  }) as any

  const offers: { status: string }[] = await prisma.offer.findMany({
    where: { team: { tenantId: clubId } },
    select: { status: true },
  }) as any

  const teamsWithoutCoach = teams.filter((t) => t.staff.length === 0)
  const teamsWithNoPlayers = teams.filter((t) => t._count.players === 0)

  const activeTryouts = tryoutsWithSignups.filter(
    (t) => new Date(t.scheduledAt) >= new Date() && t.isPublished
  )
  const draftTryouts = tryoutsWithSignups.filter(
    (t) => new Date(t.scheduledAt) >= new Date() && !t.isPublished
  )

  const tryoutsNeedingOffers = tryoutsWithSignups.filter((t) => {
    const needsOffer = t.signups.filter((s) => s.offers.length === 0).length
    return needsOffer > 0
  }).map((t) => ({
    id: t.id,
    title: t.title,
    teamName: t.team?.name,
    needsOffer: t.signups.filter((s) => s.offers.length === 0).length,
    total: t.signups.length,
  }))

  const pendingOffers = offers.filter((o) => o.status === "PENDING").length
  const acceptedOffers = offers.filter((o) => o.status === "ACCEPTED").length
  const declinedOffers = offers.filter((o) => o.status === "DECLINED").length
  const expiredOffers = offers.filter((o) => o.status === "EXPIRED").length

  return {
    teamCount,
    tryoutCount,
    staffCount,
    pendingInvites,
    teamsWithoutCoach,
    teamsWithNoPlayers,
    activeTryouts: activeTryouts.length,
    draftTryouts: draftTryouts.length,
    tryoutsNeedingOffers,
    pendingOffers,
    acceptedOffers,
    declinedOffers,
    expiredOffers,
    totalOffers: offers.length,
  }
}

export default async function ClubOverviewPage({
  params,
}: {
  params: { id: string }
}) {
  const data = await getClubOverview(params.id)

  const hasAttentionItems =
    data.tryoutsNeedingOffers.length > 0 ||
    data.pendingOffers > 0 ||
    data.teamsWithoutCoach.length > 0 ||
    data.draftTryouts > 0 ||
    data.expiredOffers > 0

  return (
    <div>
      {/* Top Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href={`/clubs/${params.id}/teams`}
          className="rounded-lg bg-white p-6 shadow hover:shadow-md transition"
        >
          <div className="text-3xl font-bold text-green-600">{data.teamCount}</div>
          <div className="text-sm text-gray-500">Teams</div>
          {data.teamsWithNoPlayers.length > 0 && (
            <div className="mt-1 text-xs text-orange-600">
              {data.teamsWithNoPlayers.length} with no players
            </div>
          )}
        </Link>
        <Link
          href={`/clubs/${params.id}/tryouts`}
          className="rounded-lg bg-white p-6 shadow hover:shadow-md transition"
        >
          <div className="text-3xl font-bold text-orange-600">{data.tryoutCount}</div>
          <div className="text-sm text-gray-500">Tryouts</div>
          <div className="mt-1 text-xs text-gray-500">
            {data.activeTryouts} active &middot; {data.draftTryouts} draft
          </div>
        </Link>
        <Link
          href={`/clubs/${params.id}/offers`}
          className="rounded-lg bg-white p-6 shadow hover:shadow-md transition"
        >
          <div className="text-3xl font-bold text-purple-600">{data.totalOffers}</div>
          <div className="text-sm text-gray-500">Offers</div>
          {data.pendingOffers > 0 && (
            <div className="mt-1 text-xs text-yellow-600">
              {data.pendingOffers} awaiting response
            </div>
          )}
        </Link>
        <Link
          href={`/clubs/${params.id}/staff`}
          className="rounded-lg bg-white p-6 shadow hover:shadow-md transition"
        >
          <div className="text-3xl font-bold text-orange-600">{data.staffCount}</div>
          <div className="text-sm text-gray-500">Staff</div>
          {data.pendingInvites > 0 && (
            <div className="mt-1 text-xs text-yellow-600">
              {data.pendingInvites} pending invite{data.pendingInvites !== 1 ? "s" : ""}
            </div>
          )}
        </Link>
      </div>

      {/* Needs Attention */}
      {hasAttentionItems && (
        <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-orange-800">
            Needs Attention
          </h2>
          <div className="space-y-2">
            {data.tryoutsNeedingOffers.map((t) => (
              <Link
                key={t.id}
                href={`/clubs/${params.id}/tryouts/${t.id}/signups`}
                className="flex items-center justify-between rounded-md bg-white px-4 py-2 text-sm hover:bg-orange-100 transition"
              >
                <span className="text-gray-900">
                  <span className="font-medium">{t.title}</span>
                  {t.teamName && (
                    <span className="ml-2 text-xs text-gray-500">{t.teamName}</span>
                  )}
                </span>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  {t.needsOffer} of {t.total} need offers
                </span>
              </Link>
            ))}

            {data.pendingOffers > 0 && (
              <Link
                href={`/clubs/${params.id}/offers?status=pending`}
                className="flex items-center justify-between rounded-md bg-white px-4 py-2 text-sm hover:bg-orange-100 transition"
              >
                <span className="text-gray-900">Offers awaiting parent response</span>
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                  {data.pendingOffers} pending
                </span>
              </Link>
            )}

            {data.expiredOffers > 0 && (
              <Link
                href={`/clubs/${params.id}/offers?status=expired`}
                className="flex items-center justify-between rounded-md bg-white px-4 py-2 text-sm hover:bg-orange-100 transition"
              >
                <span className="text-gray-900">Expired offers that may need re-sending</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {data.expiredOffers} expired
                </span>
              </Link>
            )}

            {data.teamsWithoutCoach.map((t) => (
              <Link
                key={t.id}
                href={`/clubs/${params.id}/teams/${t.id}/edit`}
                className="flex items-center justify-between rounded-md bg-white px-4 py-2 text-sm hover:bg-orange-100 transition"
              >
                <span className="text-gray-900">
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-2 text-xs text-gray-500">{t.ageGroup}</span>
                </span>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  No head coach
                </span>
              </Link>
            ))}

            {data.draftTryouts > 0 && (
              <Link
                href={`/clubs/${params.id}/tryouts?status=draft`}
                className="flex items-center justify-between rounded-md bg-white px-4 py-2 text-sm hover:bg-orange-100 transition"
              >
                <span className="text-gray-900">Unpublished draft tryouts</span>
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                  {data.draftTryouts} draft{data.draftTryouts !== 1 ? "s" : ""}
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Offer Pipeline */}
      {data.totalOffers > 0 && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Offer Pipeline
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Link href={`/clubs/${params.id}/offers?status=pending`} className="text-center hover:opacity-80 transition">
              <div className="text-2xl font-bold text-yellow-600">{data.pendingOffers}</div>
              <div className="text-xs text-gray-500">Pending</div>
            </Link>
            <Link href={`/clubs/${params.id}/offers?status=accepted`} className="text-center hover:opacity-80 transition">
              <div className="text-2xl font-bold text-green-600">{data.acceptedOffers}</div>
              <div className="text-xs text-gray-500">Accepted</div>
            </Link>
            <Link href={`/clubs/${params.id}/offers?status=declined`} className="text-center hover:opacity-80 transition">
              <div className="text-2xl font-bold text-red-600">{data.declinedOffers}</div>
              <div className="text-xs text-gray-500">Declined</div>
            </Link>
            <Link href={`/clubs/${params.id}/offers?status=expired`} className="text-center hover:opacity-80 transition">
              <div className="text-2xl font-bold text-gray-500">{data.expiredOffers}</div>
              <div className="text-xs text-gray-500">Expired</div>
            </Link>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/clubs/${params.id}/teams/create`}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Create Team
          </Link>
          <Link
            href={`/clubs/${params.id}/tryouts/create`}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Create Tryout
          </Link>
          <Link
            href={`/clubs/${params.id}/staff`}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            Manage Staff
          </Link>
          {data.acceptedOffers > 0 && (
            <Link
              href={`/clubs/${params.id}/offers/summary`}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              Accepted Summary
            </Link>
          )}
          <Link
            href={`/clubs/${params.id}/settings`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Settings
          </Link>
        </div>
      </div>
    </div>
  )
}
