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

  const teams: OverviewTeam[] = (await prisma.team.findMany({
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
  })) as any

  const tryoutsWithSignups: OverviewTryout[] = (await prisma.tryout.findMany({
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
  })) as any

  const offers: { status: string }[] = (await prisma.offer.findMany({
    where: { team: { tenantId: clubId } },
    select: { status: true },
  })) as any

  const teamsWithoutCoach = teams.filter((t) => t.staff.length === 0)
  const teamsWithNoPlayers = teams.filter((t) => t._count.players === 0)

  const activeTryouts = tryoutsWithSignups.filter(
    (t) => new Date(t.scheduledAt) >= new Date() && t.isPublished
  )
  const draftTryouts = tryoutsWithSignups.filter(
    (t) => new Date(t.scheduledAt) >= new Date() && !t.isPublished
  )

  const tryoutsNeedingOffers = tryoutsWithSignups
    .filter((t) => {
      const needsOffer = t.signups.filter((s) => s.offers.length === 0).length
      return needsOffer > 0
    })
    .map((t) => ({
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

export default async function ClubOverviewPage({ params }: { params: { id: string } }) {
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
          className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_-34px_rgba(15,23,42,0.5)]"
        >
          <div className="text-court-700 text-3xl font-bold">{data.teamCount}</div>
          <div className="text-ink-500 text-sm">Teams</div>
          {data.teamsWithNoPlayers.length > 0 && (
            <div className="text-play-700 mt-1 text-xs">
              {data.teamsWithNoPlayers.length} with no players
            </div>
          )}
        </Link>
        <Link
          href={`/clubs/${params.id}/tryouts`}
          className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_-34px_rgba(15,23,42,0.5)]"
        >
          <div className="text-play-700 text-3xl font-bold">{data.tryoutCount}</div>
          <div className="text-ink-500 text-sm">Tryouts</div>
          <div className="text-ink-500 mt-1 text-xs">
            {data.activeTryouts} active &middot; {data.draftTryouts} draft
          </div>
        </Link>
        <Link
          href={`/clubs/${params.id}/offers`}
          className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_-34px_rgba(15,23,42,0.5)]"
        >
          <div className="text-hoop-600 text-3xl font-bold">{data.totalOffers}</div>
          <div className="text-ink-500 text-sm">Offers</div>
          {data.pendingOffers > 0 && (
            <div className="text-hoop-700 mt-1 text-xs">{data.pendingOffers} awaiting response</div>
          )}
        </Link>
        <Link
          href={`/clubs/${params.id}/staff`}
          className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_-34px_rgba(15,23,42,0.5)]"
        >
          <div className="text-play-700 text-3xl font-bold">{data.staffCount}</div>
          <div className="text-ink-500 text-sm">Staff</div>
          {data.pendingInvites > 0 && (
            <div className="text-hoop-700 mt-1 text-xs">
              {data.pendingInvites} pending invite{data.pendingInvites !== 1 ? "s" : ""}
            </div>
          )}
        </Link>
      </div>

      {/* Needs Attention */}
      {hasAttentionItems && (
        <div className="border-play-200 bg-play-50 mb-6 rounded-3xl border p-6">
          <h2 className="text-play-800 mb-3 text-sm font-semibold uppercase tracking-wider">
            Needs Attention
          </h2>
          <div className="space-y-2">
            {data.tryoutsNeedingOffers.map((t) => (
              <Link
                key={t.id}
                href={`/clubs/${params.id}/tryouts/${t.id}/signups`}
                className="border-play-100 hover:bg-play-100 flex items-center justify-between rounded-xl border bg-white px-4 py-2 text-sm transition"
              >
                <span className="text-ink-900">
                  <span className="font-medium">{t.title}</span>
                  {t.teamName && <span className="text-ink-500 ml-2 text-xs">{t.teamName}</span>}
                </span>
                <span className="bg-play-100 text-play-700 rounded-full px-2 py-0.5 text-xs font-medium">
                  {t.needsOffer} of {t.total} need offers
                </span>
              </Link>
            ))}

            {data.pendingOffers > 0 && (
              <Link
                href={`/clubs/${params.id}/offers?status=pending`}
                className="border-play-100 hover:bg-play-100 flex items-center justify-between rounded-xl border bg-white px-4 py-2 text-sm transition"
              >
                <span className="text-ink-900">Offers awaiting parent response</span>
                <span className="bg-hoop-100 text-hoop-700 rounded-full px-2 py-0.5 text-xs font-medium">
                  {data.pendingOffers} pending
                </span>
              </Link>
            )}

            {data.expiredOffers > 0 && (
              <Link
                href={`/clubs/${params.id}/offers?status=expired`}
                className="border-play-100 hover:bg-play-100 flex items-center justify-between rounded-xl border bg-white px-4 py-2 text-sm transition"
              >
                <span className="text-ink-900">Expired offers that may need re-sending</span>
                <span className="bg-court-100 text-ink-600 rounded-full px-2 py-0.5 text-xs font-medium">
                  {data.expiredOffers} expired
                </span>
              </Link>
            )}

            {data.teamsWithoutCoach.map((t) => (
              <Link
                key={t.id}
                href={`/clubs/${params.id}/teams/${t.id}/edit`}
                className="border-play-100 hover:bg-play-100 flex items-center justify-between rounded-xl border bg-white px-4 py-2 text-sm transition"
              >
                <span className="text-ink-900">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-ink-500 ml-2 text-xs">{t.ageGroup}</span>
                </span>
                <span className="bg-play-100 text-play-700 rounded-full px-2 py-0.5 text-xs font-medium">
                  No head coach
                </span>
              </Link>
            ))}

            {data.draftTryouts > 0 && (
              <Link
                href={`/clubs/${params.id}/tryouts?status=draft`}
                className="border-play-100 hover:bg-play-100 flex items-center justify-between rounded-xl border bg-white px-4 py-2 text-sm transition"
              >
                <span className="text-ink-900">Unpublished draft tryouts</span>
                <span className="bg-hoop-100 text-hoop-700 rounded-full px-2 py-0.5 text-xs font-medium">
                  {data.draftTryouts} draft{data.draftTryouts !== 1 ? "s" : ""}
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Offer Pipeline */}
      {data.totalOffers > 0 && (
        <div className="border-ink-100 mb-6 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
          <h2 className="text-ink-500 mb-3 text-sm font-semibold uppercase tracking-wider">
            Offer Pipeline
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href={`/clubs/${params.id}/offers?status=pending`}
              className="text-center transition hover:opacity-80"
            >
              <div className="text-hoop-700 text-2xl font-bold">{data.pendingOffers}</div>
              <div className="text-ink-500 text-xs">Pending</div>
            </Link>
            <Link
              href={`/clubs/${params.id}/offers?status=accepted`}
              className="text-center transition hover:opacity-80"
            >
              <div className="text-court-700 text-2xl font-bold">{data.acceptedOffers}</div>
              <div className="text-ink-500 text-xs">Accepted</div>
            </Link>
            <Link
              href={`/clubs/${params.id}/offers?status=declined`}
              className="text-center transition hover:opacity-80"
            >
              <div className="text-hoop-700 text-2xl font-bold">{data.declinedOffers}</div>
              <div className="text-ink-500 text-xs">Declined</div>
            </Link>
            <Link
              href={`/clubs/${params.id}/offers?status=expired`}
              className="text-center transition hover:opacity-80"
            >
              <div className="text-ink-500 text-2xl font-bold">{data.expiredOffers}</div>
              <div className="text-ink-500 text-xs">Expired</div>
            </Link>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
        <h2 className="text-ink-500 mb-4 text-sm font-semibold uppercase tracking-wider">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/clubs/${params.id}/teams/create`}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white transition"
          >
            Create Team
          </Link>
          <Link
            href={`/clubs/${params.id}/tryouts/create`}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white transition"
          >
            Create Tryout
          </Link>
          <Link
            href={`/clubs/${params.id}/staff`}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white transition"
          >
            Manage Staff
          </Link>
          {data.acceptedOffers > 0 && (
            <Link
              href={`/clubs/${params.id}/offers/summary`}
              className="bg-court-600 hover:bg-court-700 rounded-xl px-4 py-2 text-sm font-semibold text-white transition"
            >
              Accepted Summary
            </Link>
          )}
          <Link
            href={`/clubs/${params.id}/settings`}
            className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border bg-white px-4 py-2 text-sm font-semibold transition"
          >
            Settings
          </Link>
        </div>
      </div>
    </div>
  )
}
