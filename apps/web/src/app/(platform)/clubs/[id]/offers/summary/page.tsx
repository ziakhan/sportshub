import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { formatCurrency } from "@/lib/countries"

interface AcceptedOffer {
  id: string
  seasonFee: number
  installments: number
  practiceSessions: number
  includesBall: boolean
  includesBag: boolean
  includesShoes: boolean
  includesUniform: boolean
  includesTracksuit: boolean
  uniformSize: string | null
  shoeSize: string | null
  tracksuitSize: string | null
  jerseyPref1: number | null
  jerseyPref2: number | null
  jerseyPref3: number | null
  respondedAt: Date | null
  message: string | null
  team: { id: string; name: string }
  player: {
    id: string
    firstName: string
    lastName: string
    dateOfBirth: Date | null
    gender: string | null
    position: string | null
    height: string | null
    weight: number | null
  }
}

async function getAcceptedOffers(tenantId: string): Promise<AcceptedOffer[]> {
  const raw = await prisma.offer.findMany({
    where: {
      team: { tenantId },
      status: "ACCEPTED",
    },
    select: {
      id: true,
      seasonFee: true,
      installments: true,
      practiceSessions: true,
      includesBall: true,
      includesBag: true,
      includesShoes: true,
      includesUniform: true,
      includesTracksuit: true,
      uniformSize: true,
      shoeSize: true,
      tracksuitSize: true,
      jerseyPref1: true,
      jerseyPref2: true,
      jerseyPref3: true,
      respondedAt: true,
      message: true,
      team: { select: { id: true, name: true } },
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          position: true,
          height: true,
          weight: true,
        },
      },
    },
    orderBy: [{ team: { name: "asc" } }, { respondedAt: "asc" }],
  })
  return raw.map((o: (typeof raw)[number]) => ({ ...o, seasonFee: Number(o.seasonFee) }))
}

export default async function OfferSummaryPage({
  params,
}: {
  params: { id: string }
}) {
  const [offers, tenantData] = await Promise.all([
    getAcceptedOffers(params.id),
    prisma.tenant.findUnique({ where: { id: params.id }, select: { currency: true } }),
  ])
  const currency = tenantData?.currency || "USD"

  // Group by team
  const teamMap = new Map<string, { name: string; offers: typeof offers }>()
  for (const offer of offers) {
    const existing = teamMap.get(offer.team.id)
    if (existing) {
      existing.offers.push(offer)
    } else {
      teamMap.set(offer.team.id, { name: offer.team.name, offers: [offer] })
    }
  }

  // Aggregate sizes across all offers for ordering summary
  const uniformSizes: Record<string, number> = {}
  const shoeSizes: Record<string, number> = {}
  const tracksuitSizes: Record<string, number> = {}
  let totalBalls = 0
  let totalBags = 0

  for (const offer of offers) {
    if (offer.uniformSize) {
      uniformSizes[offer.uniformSize] = (uniformSizes[offer.uniformSize] || 0) + 1
    }
    if (offer.shoeSize) {
      shoeSizes[offer.shoeSize] = (shoeSizes[offer.shoeSize] || 0) + 1
    }
    if (offer.tracksuitSize) {
      tracksuitSizes[offer.tracksuitSize] = (tracksuitSizes[offer.tracksuitSize] || 0) + 1
    }
    if (offer.includesBall) totalBalls++
    if (offer.includesBag) totalBags++
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/clubs/${params.id}/offers`}
          className="text-sm text-orange-600 hover:underline"
        >
          &larr; Back to Offers
        </Link>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Accepted Offers Summary</h2>
        <p className="text-sm text-gray-500 mt-1">
          All selections made by players/parents when accepting offers
        </p>
      </div>

      {offers.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No accepted offers yet</h3>
          <p className="text-gray-600">
            Once players accept their offers, their selections will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Order Summary */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Equipment Order Summary</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Object.keys(uniformSizes).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Uniform Sizes</h4>
                  <div className="space-y-1">
                    {Object.entries(uniformSizes).sort().map(([size, count]) => (
                      <div key={size} className="flex justify-between text-sm">
                        <span className="text-gray-600">{size}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(tracksuitSizes).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Tracksuit Sizes</h4>
                  <div className="space-y-1">
                    {Object.entries(tracksuitSizes).sort().map(([size, count]) => (
                      <div key={size} className="flex justify-between text-sm">
                        <span className="text-gray-600">{size}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(shoeSizes).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Shoe Sizes</h4>
                  <div className="space-y-1">
                    {Object.entries(shoeSizes).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([size, count]) => (
                      <div key={size} className="flex justify-between text-sm">
                        <span className="text-gray-600">Size {size}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(totalBalls > 0 || totalBags > 0) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Other Items</h4>
                  <div className="space-y-1">
                    {totalBalls > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Basketballs</span>
                        <span className="font-medium text-gray-900">{totalBalls}</span>
                      </div>
                    )}
                    {totalBags > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Bags</span>
                        <span className="font-medium text-gray-900">{totalBags}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Per-team detail */}
          {Array.from(teamMap.entries()).map(([teamId, { name: teamName, offers: teamOffers }]) => (
            <div key={teamId} className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h3 className="font-semibold text-gray-900">{teamName}</h3>
                <p className="text-xs text-gray-500">{teamOffers.length} accepted offer{teamOffers.length !== 1 ? "s" : ""}</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Player</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Position</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Uniform</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tracksuit</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Shoes</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Items</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Jersey Prefs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {teamOffers.map((offer) => {
                      const items = [
                        offer.includesBall && "Ball",
                        offer.includesBag && "Bag",
                      ].filter(Boolean)

                      return (
                        <tr key={offer.id}>
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {offer.player.firstName} {offer.player.lastName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {offer.player.gender}
                              {offer.player.height ? ` | ${offer.player.height}` : ""}
                              {offer.player.weight ? ` | ${offer.player.weight}lbs` : ""}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                            {offer.player.position || "-"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                            {formatCurrency(offer.seasonFee, currency)}
                            {offer.installments > 1 ? ` (${offer.installments}x)` : ""}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            {offer.uniformSize ? (
                              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                                {offer.uniformSize}
                              </span>
                            ) : offer.includesUniform ? (
                              <span className="text-xs text-gray-400">pending</span>
                            ) : (
                              <span className="text-xs text-gray-300">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            {offer.tracksuitSize ? (
                              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                                {offer.tracksuitSize}
                              </span>
                            ) : offer.includesTracksuit ? (
                              <span className="text-xs text-gray-400">pending</span>
                            ) : (
                              <span className="text-xs text-gray-300">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            {offer.shoeSize ? (
                              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                                {offer.shoeSize}
                              </span>
                            ) : offer.includesShoes ? (
                              <span className="text-xs text-gray-400">pending</span>
                            ) : (
                              <span className="text-xs text-gray-300">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                            {items.length > 0 ? items.join(", ") : "-"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                            {[offer.jerseyPref1, offer.jerseyPref2, offer.jerseyPref3]
                              .filter((n) => n !== null)
                              .map((n) => `#${n}`)
                              .join(", ") || "-"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
