import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"

/**
 * K-005: hard onboarding gate for app entry surfaces (dashboard, calendar,
 * feed, messages). The signup/sign-in funnel already routes new accounts to
 * /onboarding, but direct navigation (bookmarks, deep links, shared URLs)
 * skipped it — a role-less account could browse an app that assumes roles.
 * Lives in pages/sub-layouts, NOT the platform layout, which wraps
 * /onboarding itself and would redirect-loop. DB-checked (not JWT) so
 * finishing onboarding takes effect immediately. Platform admins exempt,
 * matching the platform layout's chrome rule.
 */
export async function requireOnboarded(): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return // signed-out handling belongs to the surface itself
  if (user.onboardedAt) return
  if (user.roles.some((r: any) => r.role === "PlatformAdmin")) return
  redirect("/onboarding")
}
