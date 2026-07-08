import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { getCompletionChecklist } from "@/lib/onboarding/checklist"
import { OPERATOR_ROLES } from "@/lib/queries/nav"
import { WelcomeScreen } from "./welcome-screen"

export const dynamic = "force-dynamic"

/**
 * First-run onboarding soft gate (reached via /post-login). Renders the
 * data-driven checklist full-screen; a fully-set-up member is bounced straight
 * to their normal landing so the page can't dead-end anyone.
 */
export default async function WelcomePage() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const isOperator = user.roles.some((r: any) => OPERATOR_ROLES.has(r.role))
  const landingHref = isOperator ? "/dashboard" : "/"

  const checklist = await getCompletionChecklist(user as any)
  if (!checklist.applicable || checklist.complete) redirect(landingHref)

  return (
    <WelcomeScreen
      firstName={user.firstName ?? null}
      percent={checklist.percent}
      steps={checklist.steps}
      landingHref={landingHref}
    />
  )
}
