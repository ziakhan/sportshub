import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getCurrentUser } from "@/lib/auth-helpers"
import { getCompletionChecklist } from "@/lib/onboarding/checklist"
import { ONBOARDING_DISMISS_COOKIE } from "@/lib/onboarding/constants"
import { OPERATOR_ROLES } from "@/lib/queries/nav"
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

  const isOperator = user.roles.some((r: any) => OPERATOR_ROLES.has(r.role))
  const landing = isOperator ? "/dashboard" : "/"

  const dismissed = cookies().get(ONBOARDING_DISMISS_COOKIE)?.value
  if (!dismissed) {
    const checklist = await getCompletionChecklist(user as any)
    if (checklist.applicable && !checklist.complete) {
      return NextResponse.redirect(new URL("/welcome", siteUrl()))
    }
  }

  return NextResponse.redirect(new URL(landing, siteUrl()))
}
