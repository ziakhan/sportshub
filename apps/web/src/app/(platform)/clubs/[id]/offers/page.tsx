import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import Link from "next/link"
import { formatCurrency } from "@/lib/countries"
import { OffersFilter } from "./offers-filter"

interface ClubOffer {
  id: string
  status: string
  seasonFee: number
  installments: number
  uniformSize: string | null
  shoeSize: string | null
  tracksuitSize: string | null
  jerseyPref1: number | null
  jerseyPref2: number | null
  jerseyPref3: number | null
  includesUniform: boolean
  includesTracksuit: boolean
  includesShoes: boolean
  includesBall: boolean
  includesBag: boolean
  practiceSessions: number
  createdAt: Date
  team: { id: string; name: string }
  player: {
    id: string
    firstName: string
    lastName: string
    dateOfBirth: Date | null
    gender: string | null
  }
}

async function getClubOffers(tenantId: string): Promise<ClubOffer[]> {
  const raw = await prisma.offer.findMany({
    where: { team: { tenantId } },
    select: {
      id: true,
      status: true,
      seasonFee: true,
      installments: true,
      uniformSize: true,
      shoeSize: true,
      tracksuitSize: true,
      jerseyPref1: true,
      jerseyPref2: true,
      jerseyPref3: true,
      includesUniform: true,
      includesTracksuit: true,
      includesShoes: true,
      includesBall: true,
      includesBag: true,
      practiceSessions: true,
      createdAt: true,
      team: { select: { id: true, name: true } },
      player: {
        select: { id: true, firstName: true, lastName: true, dateOfBirth: true, gender: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })
  // Convert Decimal to Number for serialization
  return raw.map((o: (typeof raw)[number]) => ({ ...o, seasonFee: Number(o.seasonFee) }))
}

async function getClubTeams(tenantId: string): Promise<{ id: string; name: string }[]> {
  return await prisma.team.findMany({
    where: { tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

async function getTenantCurrency(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { currency: true },
  })
  return tenant?.currency || "USD"
}

export default async function ClubOffersPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { status?: string; team?: string }
}) {
  const [offers, teams, currency] = await Promise.all([
    getClubOffers(params.id),
    getClubTeams(params.id),
    getTenantCurrency(params.id),
  ])

  const statusColors: Record<string, string> = {
    PENDING: "bg-hoop-100 text-hoop-700",
    ACCEPTED: "bg-court-100 text-court-700",
    DECLINED: "bg-hoop-100 text-hoop-700",
    EXPIRED: "bg-court-100 text-ink-600",
  }

  const pendingCount = offers.filter((o) => o.status === "PENDING").length
  const acceptedCount = offers.filter((o) => o.status === "ACCEPTED").length
  const declinedCount = offers.filter((o) => o.status === "DECLINED").length
  const expiredCount = offers.filter((o) => o.status === "EXPIRED").length

  // Apply filters
  const statusFilter = searchParams.status?.toUpperCase()
  const teamFilter = searchParams.team
  const validStatuses = ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"]

  const filteredOffers = offers.filter((o) => {
    if (statusFilter && validStatuses.includes(statusFilter) && o.status !== statusFilter)
      return false
    if (teamFilter && o.team.id !== teamFilter) return false
    return true
  })

  const activeFilterTeam = teams.find((t) => t.id === teamFilter)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-ink-900 text-xl font-bold">Offers</h2>
          <p className="text-ink-500 mt-1 text-sm">Manage offers sent to players from tryouts</p>
        </div>
        {acceptedCount > 0 && (
          <Link
            href={`/clubs/${params.id}/offers/summary`}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          >
            Accepted Summary
          </Link>
        )}
      </div>

      {/* Stats — clickable to filter */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link
          href={
            statusFilter === "PENDING"
              ? `/clubs/${params.id}/offers`
              : `/clubs/${params.id}/offers?status=pending${teamFilter ? `&team=${teamFilter}` : ""}`
          }
          className={`rounded-2xl border p-4 transition ${statusFilter === "PENDING" ? "border-hoop-400 ring-hoop-200 ring-2" : "border-hoop-200"} bg-hoop-50`}
        >
          <div className="text-hoop-700 text-2xl font-bold">{pendingCount}</div>
          <div className="text-hoop-600 text-sm">Pending</div>
        </Link>
        <Link
          href={
            statusFilter === "ACCEPTED"
              ? `/clubs/${params.id}/offers`
              : `/clubs/${params.id}/offers?status=accepted${teamFilter ? `&team=${teamFilter}` : ""}`
          }
          className={`rounded-2xl border p-4 transition ${statusFilter === "ACCEPTED" ? "border-court-400 ring-court-200 ring-2" : "border-court-200"} bg-court-50`}
        >
          <div className="text-court-700 text-2xl font-bold">{acceptedCount}</div>
          <div className="text-court-600 text-sm">Accepted</div>
        </Link>
        <Link
          href={
            statusFilter === "DECLINED"
              ? `/clubs/${params.id}/offers`
              : `/clubs/${params.id}/offers?status=declined${teamFilter ? `&team=${teamFilter}` : ""}`
          }
          className={`rounded-2xl border p-4 transition ${statusFilter === "DECLINED" ? "border-hoop-400 ring-hoop-200 ring-2" : "border-hoop-200"} bg-hoop-50`}
        >
          <div className="text-hoop-700 text-2xl font-bold">{declinedCount}</div>
          <div className="text-hoop-600 text-sm">Declined</div>
        </Link>
        <Link
          href={
            statusFilter === "EXPIRED"
              ? `/clubs/${params.id}/offers`
              : `/clubs/${params.id}/offers?status=expired${teamFilter ? `&team=${teamFilter}` : ""}`
          }
          className={`rounded-2xl border p-4 transition ${statusFilter === "EXPIRED" ? "border-ink-400 ring-court-200 ring-2" : "border-ink-200"} bg-court-50`}
        >
          <div className="text-ink-600 text-2xl font-bold">{expiredCount}</div>
          <div className="text-ink-500 text-sm">Expired</div>
        </Link>
      </div>

      {/* Team filter */}
      <OffersFilter
        teams={teams}
        clubId={params.id}
        activeTeamId={teamFilter}
        activeStatus={statusFilter?.toLowerCase()}
      />

      {/* Active filter indicator */}
      {(statusFilter || teamFilter) && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-ink-500 text-sm">Filtered by:</span>
          {statusFilter && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[statusFilter] || "bg-court-100 text-ink-600"}`}
            >
              {statusFilter.toLowerCase()}
            </span>
          )}
          {activeFilterTeam && (
            <span className="bg-play-100 text-play-700 rounded-full px-2 py-0.5 text-xs font-medium">
              {activeFilterTeam.name}
            </span>
          )}
          <Link
            href={`/clubs/${params.id}/offers`}
            className="text-play-700 text-xs hover:underline"
          >
            Clear all
          </Link>
        </div>
      )}

      {filteredOffers.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          {offers.length === 0 ? (
            <>
              <h3 className="text-ink-900 mb-2 text-lg font-semibold">No offers yet</h3>
              <p className="text-ink-600 mb-4">
                Go to a tryout&apos;s signups page to make offers to players.
              </p>
              <Link
                href={`/clubs/${params.id}/tryouts`}
                className="bg-play-600 hover:bg-play-700 inline-block rounded-xl px-6 py-2 font-semibold text-white"
              >
                View Tryouts
              </Link>
            </>
          ) : (
            <>
              <h3 className="text-ink-900 mb-2 text-lg font-semibold">No matching offers</h3>
              <p className="text-ink-600 mb-4">No offers match the current filters.</p>
              <Link
                href={`/clubs/${params.id}/offers`}
                className="text-play-700 text-sm hover:underline"
              >
                Clear filters
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group by team */}
          {teams.map((team) => {
            const teamOffers = filteredOffers.filter((o) => o.team.id === team.id)
            if (teamOffers.length === 0) return null

            const teamAccepted = teamOffers.filter((o) => o.status === "ACCEPTED").length

            return (
              <div key={team.id} className="border-ink-100 shadow-soft rounded-2xl border bg-white">
                <div className="border-ink-100 flex items-center justify-between border-b px-6 py-4">
                  <div>
                    <h3 className="text-ink-900 font-semibold">{team.name}</h3>
                    <p className="text-ink-500 text-xs">
                      {teamOffers.length} offer{teamOffers.length !== 1 ? "s" : ""} &middot;{" "}
                      {teamAccepted} accepted
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/clubs/${params.id}/teams/${team.id}/dashboard`}
                      className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
                    >
                      Team Dashboard
                    </Link>
                    {teamAccepted > 0 && (
                      <Link
                        href={`/clubs/${params.id}/teams/${team.id}/roster`}
                        className="bg-play-600 hover:bg-play-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        View Roster
                      </Link>
                    )}
                  </div>
                </div>

                <div className="divide-court-100 divide-y">
                  {teamOffers.map((offer) => (
                    <div key={offer.id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <span className="text-ink-900 font-medium">
                          {offer.player.firstName} {offer.player.lastName}
                        </span>
                        <span className="text-ink-500 ml-2 text-xs">
                          {formatCurrency(Number(offer.seasonFee), currency)}
                          {offer.installments > 1 ? ` (${offer.installments} installments)` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {offer.status === "ACCEPTED" && offer.uniformSize && (
                          <span className="text-ink-500 text-xs">
                            Size: {offer.uniformSize}
                            {offer.jerseyPref1 !== null ? ` | Pref: #${offer.jerseyPref1}` : ""}
                            {offer.jerseyPref2 !== null ? `, #${offer.jerseyPref2}` : ""}
                            {offer.jerseyPref3 !== null ? `, #${offer.jerseyPref3}` : ""}
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[offer.status]}`}
                        >
                          {offer.status.toLowerCase()}
                        </span>
                        <span className="text-ink-400 text-xs">
                          {format(new Date(offer.createdAt), "MMM d")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
