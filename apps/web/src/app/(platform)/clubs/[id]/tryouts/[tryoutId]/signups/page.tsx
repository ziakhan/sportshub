import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import Link from "next/link"
import { MakeOfferButton } from "./make-offer-button"

interface TryoutSignup {
  id: string
  userId: string
  playerName: string
  playerAge: number | null
  playerGender: string | null
  status: string
  notes: string | null
  createdAt: Date
  user: { id: string; email: string; firstName: string | null; lastName: string | null }
  offers: { id: string; status: string }[]
}

interface TryoutWithSignups {
  id: string
  title: string
  scheduledAt: Date
  location: string
  ageGroup: string
  team: { id: string; name: string } | null
  signups: TryoutSignup[]
}

async function getTryoutWithSignups(tryoutId: string, tenantId: string): Promise<TryoutWithSignups | null> {
  const tryout = await prisma.tryout.findFirst({
    where: { id: tryoutId, tenantId },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      location: true,
      ageGroup: true,
      team: { select: { id: true, name: true } },
      signups: {
        where: { status: { not: "CANCELLED" } },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          offers: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  return tryout
}

async function getPlayersForParents(parentIds: string[]): Promise<{ id: string; firstName: string; lastName: string; parentId: string }[]> {
  if (parentIds.length === 0) return []
  return await prisma.player.findMany({
    where: { parentId: { in: parentIds } },
    select: { id: true, firstName: true, lastName: true, parentId: true },
  })
}

export default async function TryoutSignupsPage({
  params,
}: {
  params: { id: string; tryoutId: string }
}) {
  const tryout = await getTryoutWithSignups(params.tryoutId, params.id)

  if (!tryout) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">Tryout not found.</p>
      </div>
    )
  }

  // Batch fetch all players for all parents in one query
  const parentIds = [...new Set(tryout.signups.map((s) => s.userId))]
  const allPlayers = await getPlayersForParents(parentIds)

  const signupsWithPlayers = tryout.signups.map((signup) => {
    const parentPlayers = allPlayers.filter((p) => p.parentId === signup.userId)
    const matchedPlayer = parentPlayers.find(
      (p) => `${p.firstName} ${p.lastName}` === signup.playerName
    )
    return { ...signup, matchedPlayer, allPlayers: parentPlayers }
  })

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/clubs/${params.id}/tryouts`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Tryouts
        </Link>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{tryout.title} - Signups</h2>
        <div className="mt-1 flex gap-4 text-sm text-gray-500">
          <span>{format(new Date(tryout.scheduledAt), "MMM d, yyyy 'at' h:mm a")}</span>
          <span>{tryout.location}</span>
          {tryout.team && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {tryout.team.name}
            </span>
          )}
        </div>
      </div>

      {signupsWithPlayers.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No signups yet</h3>
          <p className="text-gray-600">
            Once parents sign up their children, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Player
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Parent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Age / Gender
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Signed Up
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {signupsWithPlayers.map((signup) => {
                const hasOffer = signup.offers.length > 0
                const latestOffer = signup.offers[signup.offers.length - 1]

                return (
                  <tr key={signup.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-medium text-gray-900">{signup.playerName}</div>
                      {signup.notes && (
                        <div className="text-xs text-gray-500 mt-0.5">{signup.notes}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      <div>{signup.user.firstName} {signup.user.lastName}</div>
                      <div className="text-xs text-gray-400">{signup.user.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {signup.playerAge} / {signup.playerGender}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={signup.status} offerStatus={latestOffer?.status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {format(new Date(signup.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {tryout.team && signup.matchedPlayer && !hasOffer && (
                        <MakeOfferButton
                          teamId={tryout.team.id}
                          teamName={tryout.team.name}
                          playerId={signup.matchedPlayer.id}
                          playerName={signup.playerName}
                          tryoutSignupId={signup.id}
                          clubId={params.id}
                        />
                      )}
                      {hasOffer && latestOffer && (
                        <span className="text-xs text-gray-500">
                          Offer {latestOffer.status.toLowerCase()}
                        </span>
                      )}
                      {tryout.team && !signup.matchedPlayer && (
                        <span className="text-xs text-gray-400">No player profile matched</span>
                      )}
                      {!tryout.team && (
                        <span className="text-xs text-gray-400">No team linked</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, offerStatus }: { status: string; offerStatus?: string }) {
  if (offerStatus) {
    const colors: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-700",
      ACCEPTED: "bg-green-100 text-green-700",
      DECLINED: "bg-red-100 text-red-700",
      EXPIRED: "bg-gray-100 text-gray-600",
    }
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[offerStatus] || "bg-gray-100 text-gray-600"}`}>
        Offer {offerStatus.toLowerCase()}
      </span>
    )
  }

  const colors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    CONFIRMED: "bg-green-100 text-green-700",
    PAID: "bg-blue-100 text-blue-700",
    OFFERED: "bg-purple-100 text-purple-700",
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-600"}`}>
      {status.toLowerCase()}
    </span>
  )
}
