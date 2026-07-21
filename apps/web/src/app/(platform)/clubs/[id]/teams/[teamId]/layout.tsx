import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { canActOnTeam } from "@/lib/authz/team-scope"

/**
 * Team-page access gate (security fix 2026-07-20). Defense-in-depth beneath
 * the club layout's path gate: a coach may open ONLY their own team's pages;
 * club admins and platform admins may open any team in the club. Blocks
 * URL-hacking straight to another team's roster/dashboard.
 */
export default async function TeamScopeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string; teamId: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  if (!(await canActOnTeam(user.id, params.id, params.teamId))) notFound()
  return <>{children}</>
}
