import { notFound, redirect } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { getCurrentUser } from "@/lib/auth-helpers"
import { canManageClubPolls } from "@/lib/polls/authz"
import { ClubPolls } from "./club-polls"
import { SmartBack } from "@/components/ui"

export const dynamic = "force-dynamic"

/**
 * Club-wide polls (three-tier polls ruling, owner 2026-07-24): ClubOwner/
 * ClubManager author a poll for the whole club — everyone with a role at
 * the tenant plus parents of an active rostered player on any of its teams.
 * Optionally relays into selected teams' chats ("Also post to team chats",
 * default OFF).
 */
export default async function ClubPollsPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  })
  if (!tenant) notFound()

  const isPlatformAdmin = user.roles.some((r: { role: string }) => r.role === "PlatformAdmin")
  if (!isPlatformAdmin && !(await canManageClubPolls(user.id, params.id))) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <SmartBack fallback={`/clubs/${params.id}`} fallbackLabel={tenant.name} className="-ml-1" />
        <h1 className="mt-1 text-xl font-bold text-ink-900 md:text-2xl">Polls</h1>
        <p className="mt-1 text-sm text-ink-500">
          Ask the whole club something. Everyone with a role at the club, plus every rostered
          family, can see and vote.
        </p>
      </div>

      <ClubPolls clubId={params.id} />
    </div>
  )
}
