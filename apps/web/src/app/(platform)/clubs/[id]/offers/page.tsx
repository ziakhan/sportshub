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
  player: { id: string; firstName: string; lastName: string; dateOfBirth: Date | null; gender: string | null }
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
  return raw.map((o: typeof raw[number]) => ({ ...o, seasonFee: Number(o.seasonFee) }))
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
    PENDING: "bg-yellow-100 text-yellow-700",
    ACCEPTED: "bg-green-100 text-green-700",
    DECLINED: "bg-red-100 text-red-700",
    EXPIRED: "bg-gray-100 text-gray-600",
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
    if (statusFilter && validStatuses.includes(statusFilter) && o.status !== statusFilter) return false
    if (teamFilter && o.team.id !== teamFilter) return false
    return true
  })

  const activeFilterTeam = teams.find((t) => t.id === teamFilter)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Offers</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage offers sent to players from tryouts
          </p>
        </div>
        {acceptedCount > 0 && (
          <Link
            href={`/clubs/${params.id}/offers/summary`}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Accepted Summary
          </Link>
        )}
      </div>

      {/* Stats — clickable to filter */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link
          href={statusFilter === "PENDING" ? `/clubs/${params.id}/offers` : `/clubs/${params.id}/offers?status=pending${teamFilter ? `&team=${teamFilter}` : ""}`}
          className={`rounded-lg border p-4 transition ${statusFilter === "PENDING" ? "border-yellow-400 ring-2 ring-yellow-200" : "border-yellow-200"} bg-yellow-50`}
        >
          <div className="text-2xl font-bold text-yellow-700">{pendingCount}</div>
          <div className="text-sm text-yellow-600">Pending</div>
        </Link>
        <Link
          href={statusFilter === "ACCEPTED" ? `/clubs/${params.id}/offers` : `/clubs/${params.id}/offers?status=accepted${teamFilter ? `&team=${teamFilter}` : ""}`}
          className={`rounded-lg border p-4 transition ${statusFilter === "ACCEPTED" ? "border-green-400 ring-2 ring-green-200" : "border-green-200"} bg-green-50`}
        >
          <div className="text-2xl font-bold text-green-700">{acceptedCount}</div>
          <div className="text-sm text-green-600">Accepted</div>
        </Link>
        <Link
          href={statusFilter === "DECLINED" ? `/clubs/${params.id}/offers` : `/clubs/${params.id}/offers?status=declined${teamFilter ? `&team=${teamFilter}` : ""}`}
          className={`rounded-lg border p-4 transition ${statusFilter === "DECLINED" ? "border-red-400 ring-2 ring-red-200" : "border-red-200"} bg-red-50`}
        >
          <div className="text-2xl font-bold text-red-700">{declinedCount}</div>
          <div className="text-sm text-red-600">Declined</div>
        </Link>
        <Link
          href={statusFilter === "EXPIRED" ? `/clubs/${params.id}/offers` : `/clubs/${params.id}/offers?status=expired${teamFilter ? `&team=${teamFilter}` : ""}`}
          className={`rounded-lg border p-4 transition ${statusFilter === "EXPIRED" ? "border-gray-400 ring-2 ring-gray-200" : "border-gray-200"} bg-gray-50`}
        >
          <div className="text-2xl font-bold text-gray-600">{expiredCount}</div>
          <div className="text-sm text-gray-500">Expired</div>
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
          <span className="text-sm text-gray-500">Filtered by:</span>
          {statusFilter && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[statusFilter] || "bg-gray-100 text-gray-600"}`}>
              {statusFilter.toLowerCase()}
            </span>
          )}
          {activeFilterTeam && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              {activeFilterTeam.name}
            </span>
          )}
          <Link
            href={`/clubs/${params.id}/offers`}
            className="text-xs text-orange-600 hover:underline"
          >
            Clear all
          </Link>
        </div>
      )}

      {filteredOffers.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          {offers.length === 0 ? (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No offers yet</h3>
              <p className="text-gray-600 mb-4">
                Go to a tryout&apos;s signups page to make offers to players.
              </p>
              <Link
                href={`/clubs/${params.id}/tryouts`}
                className="inline-block rounded-md bg-orange-500 px-6 py-2 text-white font-semibold hover:bg-orange-600"
              >
                View Tryouts
              </Link>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No matching offers</h3>
              <p className="text-gray-600 mb-4">
                No offers match the current filters.
              </p>
              <Link
                href={`/clubs/${params.id}/offers`}
                className="text-sm text-orange-600 hover:underline"
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
              <div key={team.id} className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{team.name}</h3>
                    <p className="text-xs text-gray-500">
                      {teamOffers.length} offer{teamOffers.length !== 1 ? "s" : ""} &middot; {teamAccepted} accepted
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/clubs/${params.id}/teams/${team.id}/dashboard`}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Team Dashboard
                    </Link>
                    {teamAccepted > 0 && (
                      <Link
                        href={`/clubs/${params.id}/teams/${team.id}/roster`}
                        className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        View Roster
                      </Link>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {teamOffers.map((offer) => (
                    <div key={offer.id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <span className="font-medium text-gray-900">
                          {offer.player.firstName} {offer.player.lastName}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          {formatCurrency(Number(offer.seasonFee), currency)}
                          {offer.installments > 1 ? ` (${offer.installments} installments)` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {offer.status === "ACCEPTED" && offer.uniformSize && (
                          <span className="text-xs text-gray-500">
                            Size: {offer.uniformSize}
                            {offer.jerseyPref1 !== null ? ` | Pref: #${offer.jerseyPref1}` : ""}
                            {offer.jerseyPref2 !== null ? `, #${offer.jerseyPref2}` : ""}
                            {offer.jerseyPref3 !== null ? `, #${offer.jerseyPref3}` : ""}
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[offer.status]}`}>
                          {offer.status.toLowerCase()}
                        </span>
                        <span className="text-xs text-gray-400">
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
