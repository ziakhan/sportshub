import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { FinalizeButton } from "./finalize-button"

async function getTeamRoster(teamId: string, tenantId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, tenantId },
    select: {
      id: true,
      name: true,
      ageGroup: true,
      gender: true,
      season: true,
      players: {
        include: {
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
        orderBy: { joinedAt: "asc" },
      },
    },
  })

  return team
}

async function getTeamOffers(teamId: string) {
  return await prisma.offer.findMany({
    where: { teamId, status: "ACCEPTED" },
    select: {
      id: true,
      uniformSize: true,
      jerseyPref1: true,
      jerseyPref2: true,
      jerseyPref3: true,
      respondedAt: true,
      player: { select: { id: true } },
    },
    orderBy: { respondedAt: "asc" },
  })
}

export default async function TeamRosterPage({
  params,
}: {
  params: { id: string; teamId: string }
}) {
  const [team, offers] = await Promise.all([
    getTeamRoster(params.teamId, params.id),
    getTeamOffers(params.teamId),
  ])

  if (!team) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">Team not found.</p>
      </div>
    )
  }

  // Check if there are unfinalized players (accepted offers without jersey numbers)
  const hasUnfinalized = team.players.some(
    (tp) => tp.jerseyNumber === null
  )
  const hasAcceptedOffers = offers.length > 0

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/clubs/${params.id}/offers`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Offers
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{team.name} - Roster</h2>
          <p className="text-sm text-gray-500 mt-1">
            {team.ageGroup}{team.gender ? ` ${team.gender}` : ""}
            {team.season ? ` - ${team.season}` : ""}
          </p>
        </div>
        {hasAcceptedOffers && hasUnfinalized && (
          <FinalizeButton teamId={team.id} teamName={team.name} />
        )}
      </div>

      {team.players.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No players on roster</h3>
          <p className="text-gray-600">
            Players will appear here once they accept their offers.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Player
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Height / Weight
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Uniform
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {team.players.map((tp) => {
                const offer = offers.find((o) => o.player.id === tp.playerId)

                return (
                  <tr key={tp.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      {tp.jerseyNumber !== null ? (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                          {tp.jerseyNumber}
                        </span>
                      ) : (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-400">
                          -
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {tp.player.firstName} {tp.player.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{tp.player.gender}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {tp.player.position || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {tp.player.height || "-"} / {tp.player.weight ? `${tp.player.weight} lbs` : "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {tp.uniformSize || offer?.uniformSize || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {tp.jerseyNumber !== null ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Finalized
                        </span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                          Pending finalization
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Jersey Preferences Summary */}
      {offers.length > 0 && hasUnfinalized && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Jersey Preferences (Accepted Offers)</h3>
          <div className="space-y-2">
            {offers.map((offer) => {
              const tp = team.players.find((p) => p.playerId === offer.player.id)
              const player = tp?.player
              if (!player || tp?.jerseyNumber !== null) return null

              return (
                <div key={offer.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{player.firstName} {player.lastName}</span>
                  <span className="text-gray-500">
                    Prefs: {[offer.jerseyPref1, offer.jerseyPref2, offer.jerseyPref3]
                      .filter((n) => n !== null)
                      .map((n) => `#${n}`)
                      .join(", ")}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
