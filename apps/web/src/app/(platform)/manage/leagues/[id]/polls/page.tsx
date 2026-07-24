import { notFound, redirect } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { getCurrentUser } from "@/lib/auth-helpers"
import { canManageLeaguePolls } from "@/lib/polls/authz"
import { LeaguePolls } from "./league-polls"
import { SmartBack } from "@/components/ui"

export const dynamic = "force-dynamic"

/**
 * League-wide polls (three-tier polls ruling, owner 2026-07-24): LeagueOwner/
 * LeagueManager author a poll for the whole league — operators, staff, and
 * families of every team with an approved submission into one of its
 * seasons. No chat relay option here (owner: maybe later).
 */
export default async function LeaguePollsPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const league = await prisma.league.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, ownerId: true },
  })
  if (!league) notFound()

  const isPlatformAdmin = user.roles.some((r: { role: string }) => r.role === "PlatformAdmin")
  const isOwner = league.ownerId === user.id
  if (!isPlatformAdmin && !isOwner && !(await canManageLeaguePolls(user.id, params.id))) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <SmartBack fallback={`/manage/leagues/${params.id}`} fallbackLabel={league.name} className="-ml-1" />
        <h1 className="mt-1 text-xl font-bold text-ink-900 md:text-2xl">Polls</h1>
        <p className="mt-1 text-sm text-ink-500">
          Ask the whole league something. Every club, coach, and rostered family in a season with
          your league can see and vote.
        </p>
      </div>

      <LeaguePolls leagueId={params.id} />
    </div>
  )
}
