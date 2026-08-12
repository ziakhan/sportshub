import type { ReactNode } from "react"
import { requireOnboarded } from "./guard"

/**
 * K-005 coverage: the drop-in section layout that closes a top-level area of
 * the signed-in platform to accounts that never finished onboarding.
 *
 * The guard cannot live in the (platform) layout — that layout also wraps
 * /onboarding itself, so guarding there redirect-loops. Instead each
 * top-level section re-exports this as its layout, which covers every route
 * beneath it with one call site per section:
 *
 *   // apps/web/src/app/(platform)/<section>/layout.tsx
 *   export { default } from "@/lib/onboarding/section-guard"
 *
 * Signed-out visitors are untouched (the guard returns early and the page or
 * middleware keeps its own sign-in redirect); platform admins stay exempt.
 *
 * Two sections stay deliberately unguarded: /onboarding (the flow itself) and
 * /family/accept/[token], the emailed invite landing a brand-new account is
 * SUPPOSED to reach before it has any role — bouncing it to /onboarding would
 * throw away the token.
 */
export default async function OnboardedSectionLayout({ children }: { children: ReactNode }) {
  await requireOnboarded()
  return <>{children}</>
}
