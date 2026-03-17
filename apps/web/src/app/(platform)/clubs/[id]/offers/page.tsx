import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import Link from "next/link"

async function getClubOffers(tenantId: string) {
  const raw = await prisma.offer.findMany({
    where: { team: { tenantId } },
    include: {
      team: { select: { id: true, name: true } },
      player: {
        select: { id: true, firstName: true, lastName: true, dateOfBirth: true, gender: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })
  // Simplify Decimal fields to avoid serialization issues
  return raw.map((o) => ({ ...o, seasonFee: Number(o.seasonFee) }))
}

async function getClubTeams(tenantId: string) {
  return await prisma.team.findMany({
    where: { tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

export default async function ClubOffersPage({
  params,
}: {
  params: { id: string }
}) {
  const [offers, teams] = await Promise.all([
    getClubOffers(params.id),
    getClubTeams(params.id),
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Offers</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage offers sent to players from tryouts
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="text-2xl font-bold text-yellow-700">{pendingCount}</div>
          <div className="text-sm text-yellow-600">Pending</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="text-2xl font-bold text-green-700">{acceptedCount}</div>
          <div className="text-sm text-green-600">Accepted</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-2xl font-bold text-red-700">{declinedCount}</div>
          <div className="text-sm text-red-600">Declined</div>
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No offers yet</h3>
          <p className="text-gray-600 mb-4">
            Go to a tryout&apos;s signups page to make offers to players.
          </p>
          <Link
            href={`/clubs/${params.id}/tryouts`}
            className="inline-block rounded-md bg-blue-600 px-6 py-2 text-white font-semibold hover:bg-blue-700"
          >
            View Tryouts
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group by team */}
          {teams.map((team) => {
            const teamOffers = offers.filter((o) => o.team.id === team.id)
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
                  {teamAccepted > 0 && (
                    <Link
                      href={`/clubs/${params.id}/teams/${team.id}/roster`}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                    >
                      View Roster
                    </Link>
                  )}
                </div>

                <div className="divide-y divide-gray-100">
                  {teamOffers.map((offer) => (
                    <div key={offer.id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <span className="font-medium text-gray-900">
                          {offer.player.firstName} {offer.player.lastName}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          ${Number(offer.seasonFee).toFixed(2)}
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
