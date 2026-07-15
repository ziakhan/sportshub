import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getCurrentUser } from "@/lib/auth-helpers"
import { getCompletionChecklist } from "@/lib/onboarding/checklist"
import { ONBOARDING_DISMISS_COOKIE } from "@/lib/onboarding/constants"
import { siteUrl } from "@/lib/site"

export const dynamic = "force-dynamic"

/**
 * Role-aware post-login landing (site-ia-plan §8): operators (club/league
 * staff, referees, admins) land in the MANAGE world; parents, players and
 * role-less accounts land on the personalized PUBLIC homepage. Sign-in only
 * defaults here — an explicit callbackUrl (deep link) always wins upstream.
 *
 * Onboarding soft gate: the first time a member lands here with setup still
 * incomplete, route them through the dismissible /welcome checklist. Skipping
 * or finishing sets ONBOARDING_DISMISS_COOKIE so we never auto-interrupt again
 * — the top-nav pill + dashboard card carry ongoing guidance from there.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(new URL("/sign-in", siteUrl()))

  // First-ever sign-in via Google (or any future OAuth) lands here without
  // role selection — adapter-less NextAuth never fires its newUser redirect,
  // and only the password sign-up form routes to /onboarding itself. This is
  // the funnel for everyone else; /onboarding self-guards once complete.
  if (!(user as any).onboardedAt) {
    return NextResponse.redirect(new URL("/onboarding", siteUrl()))
  }

  // site-ia-plan §5.6.10: owners/managers → dashboard; coaches → their team
  // (the thing they opened the app for; picker when they coach several);
  // parents, players and referees → the personalized Home.
  const roleSet = new Set(user.roles.map((r: any) => r.role as string))
  const isOwnerOperator =
    roleSet.has("ClubOwner") ||
    roleSet.has("ClubManager") ||
    roleSet.has("LeagueOwner") ||
    roleSet.has("PlatformAdmin")
  const coachPairs = new Map<string, string>() // teamId -> tenantId
  for (const r of user.roles as any[]) {
    if ((r.role === "Staff" || r.role === "TeamManager") && r.teamId && r.tenantId) {
      coachPairs.set(r.teamId, r.tenantId)
    }
  }
  const [firstTeam] = coachPairs.entries()
  const landing = isOwnerOperator
    ? "/dashboard"
    : coachPairs.size === 1
      ? `/clubs/${firstTeam[1]}/teams/${firstTeam[0]}/dashboard`
      : coachPairs.size > 1
        ? "/teams"
        : "/"

  const dismissed = cookies().get(ONBOARDING_DISMISS_COOKIE)?.value
  if (!dismissed) {
    const checklist = await getCompletionChecklist(user as any)
    if (checklist.applicable && !checklist.complete) {
      return NextResponse.redirect(new URL("/welcome", siteUrl()))
    }
  }

  return NextResponse.redirect(new URL(landing, siteUrl()))
}
