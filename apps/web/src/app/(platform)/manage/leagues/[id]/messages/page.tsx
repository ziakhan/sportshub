// League Messages — re-engagement composer for league operators. Audience:
// ClubOwners/Managers of clubs from past seasons (owner decision 2026-07-09:
// no team staff). Authz mirrors the customize page: league owner, league-
// scoped LeagueOwner/LeagueManager, or PlatformAdmin.

import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { MessageComposer } from "@/components/comms/message-composer"
import { SmartBack } from "@/components/ui"

export const dynamic = "force-dynamic"

export default async function LeagueMessagesPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) notFound()

  const league = await prisma.league.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, ownerId: true },
  })
  if (!league) notFound()

  const roles = user.roles.map((r: any) => r.role)
  const isAdmin =
    roles.includes("PlatformAdmin") ||
    league.ownerId === user.id ||
    user.roles.some(
      (r: any) =>
        r.leagueId === params.id && (r.role === "LeagueOwner" || r.role === "LeagueManager")
    )
  if (!isAdmin) notFound()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <SmartBack fallback={`/manage/leagues/${params.id}`} fallbackLabel="League" className="-ml-1 mb-1" />
        <h1 className="text-ink-950 mt-1 text-xl font-bold">Messages</h1>
        <p className="text-ink-500 text-sm">
          Remind clubs from past seasons of {league.name} that registration is open. Recipients
          without marketing consent are skipped automatically.
        </p>
      </div>
      <MessageComposer scope="LEAGUE" orgId={params.id} orgName={league.name} />
    </div>
  )
}
