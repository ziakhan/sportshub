import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { WaiverStatusView } from "@/components/waivers/waiver-status-view"
import { SmartBack } from "@/components/ui"

export const dynamic = "force-dynamic"

/**
 * Season signing status: every approved team's roster against the league's
 * required waivers — signed / outstanding, with re-send.
 */
export default async function SeasonWaiverStatusPage({
  params,
}: {
  params: { id: string; seasonId: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const season = await prisma.season.findFirst({
    where: { id: params.seasonId, leagueId: params.id },
    select: {
      id: true,
      label: true,
      league: { select: { id: true, name: true, ownerId: true } },
    },
  })
  if (!season) notFound()

  const isOwner = season.league.ownerId === user.id
  const role = isOwner
    ? null
    : await prisma.userRole.findFirst({
        where: {
          userId: user.id,
          OR: [
            { leagueId: params.id, role: { in: ["LeagueOwner", "LeagueManager"] } },
            { role: "PlatformAdmin" },
          ],
        },
      })
  if (!isOwner && !role) notFound()

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <SmartBack
          fallback={`/manage/leagues/${params.id}/seasons/${params.seasonId}/manage`}
          fallbackLabel={`${season.league.name} · ${season.label}`}
          className="-ml-1"
        />
        <h1 className="mt-1 text-xl font-bold text-ink-900 md:text-2xl">Signing status</h1>
        <p className="mt-1 text-sm text-ink-500">
          Who has signed the league&apos;s required waivers, team by team. Waiver emails
          go out automatically when a team is approved; re-send covers new roster
          additions and lost emails.
        </p>
      </div>
      <WaiverStatusView seasonId={params.seasonId} leagueId={params.id} />
    </div>
  )
}
