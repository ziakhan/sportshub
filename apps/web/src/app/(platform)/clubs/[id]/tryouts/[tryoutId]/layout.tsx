import { prisma } from "@youthbasketballhub/db"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { isClubAdmin, canActOnTeam } from "@/lib/authz/team-scope"

/**
 * Tryout-detail access gate (security fix 2026-07-20). A coach may open a
 * tryout ONLY if it belongs to a team they coach; club admins open any of the
 * club's tryouts. Blocks URL-hacking to another team's tryout signups/check-in.
 */
export default async function TryoutScopeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string; tryoutId: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const tryout = await prisma.tryout.findFirst({
    where: { id: params.tryoutId, tenantId: params.id },
    select: { id: true, teamId: true },
  })
  if (!tryout) notFound()

  if (await isClubAdmin(user.id, params.id)) return <>{children}</>
  // Coach: the tryout must be tied to one of their teams.
  if (!tryout.teamId || !(await canActOnTeam(user.id, params.id, tryout.teamId))) {
    notFound()
  }
  return <>{children}</>
}
