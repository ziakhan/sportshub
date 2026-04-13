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

async function getTryoutWithSignups(
  tryoutId: string,
  tenantId: string
): Promise<TryoutWithSignups | null> {
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

async function getPlayersForParents(
  parentIds: string[]
): Promise<{ id: string; firstName: string; lastName: string; parentId: string }[]> {
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
      <div className="border-hoop-200 bg-hoop-50 rounded-xl border p-6 text-center">
        <p className="text-hoop-700">Tryout not found.</p>
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
          className="text-play-700 text-sm hover:underline"
        >
          &larr; Back to Tryouts
        </Link>
      </div>

      <div className="mb-6">
        <h2 className="text-ink-900 text-xl font-bold">{tryout.title} - Signups</h2>
        <div className="text-ink-500 mt-1 flex gap-4 text-sm">
          <span>{format(new Date(tryout.scheduledAt), "MMM d, yyyy 'at' h:mm a")}</span>
          <span>{tryout.location}</span>
          {tryout.team && (
            <span className="bg-play-100 text-play-700 rounded-full px-2 py-0.5 text-xs font-medium">
              {tryout.team.name}
            </span>
          )}
        </div>
      </div>

      {signupsWithPlayers.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="text-ink-900 mb-2 text-lg font-semibold">No signups yet</h3>
          <p className="text-ink-600">
            Once parents sign up their children, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="border-ink-100 shadow-soft overflow-x-auto rounded-2xl border bg-white">
          <table className="divide-court-200 min-w-full divide-y">
            <thead className="bg-court-50">
              <tr>
                <th className="text-ink-500 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Player
                </th>
                <th className="text-ink-500 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Parent
                </th>
                <th className="text-ink-500 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Age / Gender
                </th>
                <th className="text-ink-500 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Status
                </th>
                <th className="text-ink-500 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Signed Up
                </th>
                <th className="text-ink-500 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-court-200 divide-y">
              {signupsWithPlayers.map((signup) => {
                const hasOffer = signup.offers.length > 0
                const latestOffer = signup.offers[signup.offers.length - 1]

                return (
                  <tr key={signup.id}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-ink-900 font-medium">{signup.playerName}</div>
                      {signup.notes && (
                        <div className="text-ink-500 mt-0.5 text-xs">{signup.notes}</div>
                      )}
                    </td>
                    <td className="text-ink-600 whitespace-nowrap px-6 py-4 text-sm">
                      <div>
                        {signup.user.firstName} {signup.user.lastName}
                      </div>
                      <div className="text-ink-400 text-xs">{signup.user.email}</div>
                    </td>
                    <td className="text-ink-600 whitespace-nowrap px-6 py-4 text-sm">
                      {signup.playerAge} / {signup.playerGender}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={signup.status} offerStatus={latestOffer?.status} />
                    </td>
                    <td className="text-ink-500 whitespace-nowrap px-6 py-4 text-sm">
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
                        <span className="text-ink-500 text-xs">
                          Offer {latestOffer.status.toLowerCase()}
                        </span>
                      )}
                      {tryout.team && !signup.matchedPlayer && (
                        <span className="text-ink-400 text-xs">No player profile matched</span>
                      )}
                      {!tryout.team && <span className="text-ink-400 text-xs">No team linked</span>}
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
      PENDING: "bg-hoop-100 text-hoop-700",
      ACCEPTED: "bg-court-100 text-court-700",
      DECLINED: "bg-hoop-100 text-hoop-700",
      EXPIRED: "bg-court-100 text-ink-600",
    }
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[offerStatus] || "bg-court-100 text-ink-600"}`}
      >
        Offer {offerStatus.toLowerCase()}
      </span>
    )
  }

  const colors: Record<string, string> = {
    PENDING: "bg-hoop-100 text-hoop-700",
    CONFIRMED: "bg-court-100 text-court-700",
    PAID: "bg-play-100 text-play-700",
    OFFERED: "bg-play-100 text-play-700",
  }

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-court-100 text-ink-600"}`}
    >
      {status.toLowerCase()}
    </span>
  )
}
