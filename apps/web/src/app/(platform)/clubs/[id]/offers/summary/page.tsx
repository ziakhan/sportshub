import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { formatCurrency } from "@/lib/countries"
import {
  formatSizeBreakdown,
  rollUpOrders,
  type SizedItemRollup,
} from "@/lib/offers/order-rollup"
import { DownloadOrderCsv } from "./download-order-csv"
import { SummaryTeamFilter } from "./summary-team-filter"
import { SmartBack } from "@/components/ui"

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

/** playerId+teamId -> assigned jersey number, from the roster (assigned at finalize). */
async function getJerseyNumbers(tenantId: string): Promise<Map<string, number>> {
  const rows = await prisma.teamPlayer.findMany({
    where: { team: { tenantId }, jerseyNumber: { not: null } },
    select: { teamId: true, playerId: true, jerseyNumber: true },
  })
  return new Map(
    rows.map((r: (typeof rows)[number]) => [`${r.teamId}:${r.playerId}`, r.jerseyNumber as number])
  )
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function SizedItemBlock({ label, item }: { label: string; item: SizedItemRollup }) {
  if (item.total === 0) return null
  return (
    <div>
      <div className="border-court-100 mb-2 flex items-baseline justify-between border-b pb-1">
        <h4 className="text-ink-700 text-sm font-medium">{label}</h4>
        <span className="text-ink-900 text-lg font-bold">{item.total}</span>
      </div>
      <div className="space-y-1">
        {item.bySize.map(([size, count]) => (
          <div key={size} className="flex justify-between text-sm">
            <span className="text-ink-600">{size}</span>
            <span className="text-ink-900 font-medium">{count}</span>
          </div>
        ))}
        {item.missing > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-hoop-600">Size TBD</span>
            <span className="text-hoop-700 font-medium">{item.missing}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function CountItemBlock({ label, count }: { label: string; count: number }) {
  if (count === 0) return null
  return (
    <div>
      <div className="border-court-100 mb-2 flex items-baseline justify-between border-b pb-1">
        <h4 className="text-ink-700 text-sm font-medium">{label}</h4>
        <span className="text-ink-900 text-lg font-bold">{count}</span>
      </div>
      <p className="text-ink-400 text-xs">One size</p>
    </div>
  )
}

export default async function OrderSheetPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { team?: string }
}) {
  const [allOffers, tenant, teams, jerseyNumbers] = await Promise.all([
    getAcceptedOffers(params.id),
    prisma.tenant.findUnique({
      where: { id: params.id },
      select: { name: true, currency: true },
    }),
    prisma.team.findMany({
      where: { tenantId: params.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getJerseyNumbers(params.id),
  ])
  const currency = tenant?.currency || "CAD"

  const teamFilter = searchParams.team
  const activeFilterTeam = teams.find((t: { id: string; name: string }) => t.id === teamFilter)
  const offers = activeFilterTeam
    ? allOffers.filter((o) => o.team.id === teamFilter)
    : allOffers

  // Group by team (already sorted by team name from the query)
  const teamMap = new Map<string, { name: string; offers: AcceptedOffer[] }>()
  for (const offer of offers) {
    const existing = teamMap.get(offer.team.id)
    if (existing) {
      existing.offers.push(offer)
    } else {
      teamMap.set(offer.team.id, { name: offer.team.name, offers: [offer] })
    }
  }

  const totals = rollUpOrders(offers)

  const jersey = (o: AcceptedOffer) => jerseyNumbers.get(`${o.team.id}:${o.player.id}`) ?? null

  // Supplier-ready detail rows: what to order, per player
  const csvRows = offers.map((o) => [
    o.team.name,
    `${o.player.firstName} ${o.player.lastName}`,
    jersey(o),
    o.includesUniform ? o.uniformSize || "TBD" : "",
    o.includesTracksuit ? o.tracksuitSize || "TBD" : "",
    o.includesShoes ? o.shoeSize || "TBD" : "",
    o.includesBall ? "Yes" : "",
    o.includesBag ? "Yes" : "",
  ])
  const csvFilename = `order-sheet-${slugify(activeFilterTeam?.name || tenant?.name || "club")}.csv`

  return (
    <div>
      <div className="mb-6">
        <SmartBack fallback={`/clubs/${params.id}/offers`} fallbackLabel="Offers" className="-ml-1" />
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-ink-900 text-xl font-bold">Order Sheet</h2>
          <p className="text-ink-500 mt-1 text-sm">
            Equipment to order from accepted offers — totals by size, per team. No forms, no
            spreadsheets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SummaryTeamFilter teams={teams} clubId={params.id} activeTeamId={teamFilter} />
          {offers.length > 0 && (
            <DownloadOrderCsv
              filename={csvFilename}
              header={[
                "Team",
                "Player",
                "Jersey #",
                "Uniform",
                "Tracksuit",
                "Shoes",
                "Ball",
                "Bag",
              ]}
              rows={csvRows}
            />
          )}
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="text-ink-900 mb-2 text-lg font-semibold">
            {activeFilterTeam ? `No accepted offers for ${activeFilterTeam.name}` : "No accepted offers yet"}
          </h3>
          <p className="text-ink-600">
            Once players accept their offers, sizes and totals will appear here automatically.
          </p>
          {activeFilterTeam && (
            <Link
              href={`/clubs/${params.id}/offers/summary`}
              className="text-play-700 mt-4 inline-block text-sm hover:underline"
            >
              Show all teams
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Order totals */}
          <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="text-ink-900 font-semibold">
                {activeFilterTeam ? `${activeFilterTeam.name} — Order Totals` : "Club Order Totals"}
              </h3>
              <span className="text-ink-500 text-xs">
                {offers.length} accepted offer{offers.length !== 1 ? "s" : ""}
                {!activeFilterTeam && teamMap.size > 1 ? ` across ${teamMap.size} teams` : ""}
              </span>
            </div>
            {totals.isEmpty ? (
              <p className="text-ink-500 text-sm">
                No equipment is included in these offers — nothing to order.
              </p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
                <SizedItemBlock label="Uniforms" item={totals.uniforms} />
                <SizedItemBlock label="Tracksuits" item={totals.tracksuits} />
                <SizedItemBlock label="Shoes" item={totals.shoes} />
                <CountItemBlock label="Basketballs" count={totals.balls} />
                <CountItemBlock label="Bags" count={totals.bags} />
              </div>
            )}
            {(totals.uniforms.missing > 0 ||
              totals.tracksuits.missing > 0 ||
              totals.shoes.missing > 0) && (
              <p className="text-hoop-700 bg-hoop-50 mt-4 rounded-xl px-3 py-2 text-xs">
                Some accepted offers are missing sizes (&ldquo;Size TBD&rdquo;) — check the player
                rows below before placing the order.
              </p>
            )}
          </div>

          {/* Per-team order sheets */}
          {Array.from(teamMap.entries()).map(
            ([teamId, { name: teamName, offers: teamOffers }]) => {
              const teamRollup = rollUpOrders(teamOffers)
              const rollupChips = [
                teamRollup.uniforms.total > 0 &&
                  `${teamRollup.uniforms.total} uniform${teamRollup.uniforms.total !== 1 ? "s" : ""} (${formatSizeBreakdown(teamRollup.uniforms)})`,
                teamRollup.tracksuits.total > 0 &&
                  `${teamRollup.tracksuits.total} tracksuit${teamRollup.tracksuits.total !== 1 ? "s" : ""} (${formatSizeBreakdown(teamRollup.tracksuits)})`,
                teamRollup.shoes.total > 0 &&
                  `${teamRollup.shoes.total} shoes (${formatSizeBreakdown(teamRollup.shoes)})`,
                teamRollup.balls > 0 && `${teamRollup.balls} ball${teamRollup.balls !== 1 ? "s" : ""}`,
                teamRollup.bags > 0 && `${teamRollup.bags} bag${teamRollup.bags !== 1 ? "s" : ""}`,
              ].filter(Boolean) as string[]

              return (
                <div
                  key={teamId}
                  className="border-ink-100 shadow-soft rounded-2xl border bg-white"
                >
                  <div className="border-ink-100 border-b px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-ink-900 font-semibold">{teamName}</h3>
                        <p className="text-ink-500 text-xs">
                          {teamOffers.length} accepted offer{teamOffers.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <Link
                        href={`/clubs/${params.id}/teams/${teamId}/dashboard`}
                        className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
                      >
                        Team Dashboard
                      </Link>
                    </div>
                    {rollupChips.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {rollupChips.map((chip) => (
                          <span
                            key={chip}
                            className="bg-court-50 text-ink-700 rounded-full px-2.5 py-1 text-xs font-medium"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="divide-court-200 min-w-full divide-y">
                      <thead className="bg-court-50">
                        <tr>
                          <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Player</th>
                          <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Jersey #</th>
                          <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Fee</th>
                          <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Uniform</th>
                          <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Tracksuit</th>
                          <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Shoes</th>
                          <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Items</th>
                          <th className="text-ink-500 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Jersey Prefs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-court-200 divide-y">
                        {teamOffers.map((offer) => {
                          const items = [
                            offer.includesBall && "Ball",
                            offer.includesBag && "Bag",
                          ].filter(Boolean)
                          const assignedJersey = jersey(offer)

                          return (
                            <tr key={offer.id}>
                              <td className="whitespace-nowrap px-4 py-3">
                                <div className="text-ink-900 font-medium">
                                  {offer.player.firstName} {offer.player.lastName}
                                </div>
                                <div className="text-ink-500 text-xs">
                                  {offer.player.gender}
                                  {offer.player.height ? ` | ${offer.player.height}` : ""}
                                  {offer.player.weight ? ` | ${offer.player.weight}lbs` : ""}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm">
                                {assignedJersey !== null ? (
                                  <span className="bg-play-100 text-play-700 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                                    {assignedJersey}
                                  </span>
                                ) : (
                                  <span className="text-ink-300 text-xs">-</span>
                                )}
                              </td>
                              <td className="text-ink-600 whitespace-nowrap px-4 py-3 text-sm">
                                {formatCurrency(offer.seasonFee, currency)}
                                {offer.installments > 1 ? ` (${offer.installments}x)` : ""}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm">
                                {offer.uniformSize ? (
                                  <span className="bg-play-100 text-play-700 rounded px-1.5 py-0.5 text-xs font-medium">
                                    {offer.uniformSize}
                                  </span>
                                ) : offer.includesUniform ? (
                                  <span className="text-hoop-600 text-xs">TBD</span>
                                ) : (
                                  <span className="text-ink-300 text-xs">-</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm">
                                {offer.tracksuitSize ? (
                                  <span className="bg-play-100 text-play-700 rounded px-1.5 py-0.5 text-xs font-medium">
                                    {offer.tracksuitSize}
                                  </span>
                                ) : offer.includesTracksuit ? (
                                  <span className="text-hoop-600 text-xs">TBD</span>
                                ) : (
                                  <span className="text-ink-300 text-xs">-</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm">
                                {offer.shoeSize ? (
                                  <span className="bg-play-100 text-play-700 rounded px-1.5 py-0.5 text-xs font-medium">
                                    {offer.shoeSize}
                                  </span>
                                ) : offer.includesShoes ? (
                                  <span className="text-hoop-600 text-xs">TBD</span>
                                ) : (
                                  <span className="text-ink-300 text-xs">-</span>
                                )}
                              </td>
                              <td className="text-ink-600 whitespace-nowrap px-4 py-3 text-sm">
                                {items.length > 0 ? items.join(", ") : "-"}
                              </td>
                              <td className="text-ink-600 whitespace-nowrap px-4 py-3 text-sm">
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
              )
            }
          )}
        </div>
      )}
    </div>
  )
}
