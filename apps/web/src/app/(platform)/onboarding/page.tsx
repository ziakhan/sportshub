import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getCurrentUser } from "@/lib/auth-helpers"
import { asOnboardingRole } from "@/lib/demo/persona-role"
import { CourtBackdrop } from "@/components/ui"
import { OnboardingFlow } from "./onboarding-flow"

export const dynamic = "force-dynamic"

/** Only same-origin relative paths are ever followed. */
function safeCallback(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string") return null
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : null
}

/** The demo landing, with or without its ?persona= query. */
function isDemoStart(path: string): boolean {
  return path === "/demo/start" || path.startsWith("/demo/start?") || path.startsWith("/demo/start/")
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string | string[]; role?: string | string[] }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/sign-in")
  }

  const dbUser = await getCurrentUser()

  if (!dbUser) {
    redirect("/sign-in")
  }

  const callbackUrl = safeCallback(searchParams?.callbackUrl)

  /**
   * Demo skip, the server choke point (owner 2026-08-13). Someone who picked
   * a role in the welcome pop-up and signed up is on their way INTO the demo,
   * not into account setup — and both the credentials and the Google/Apple
   * paths funnel through /onboarding?callbackUrl=/demo/start. Catching it here
   * means one hop from signup to the demo, whichever way they came in, and no
   * form flashes on the way past. Setup waits for them on the way out.
   */
  if (callbackUrl && isDemoStart(callbackUrl)) {
    redirect(callbackUrl)
  }

  // If already onboarded, role-aware landing (site-ia-plan §8)
  if (dbUser.onboardedAt) {
    redirect("/post-login")
  }

  // ?role= carries an answer the visitor already gave (the demo exit, a role
  // link). Anything that isn't one of ours is ignored and they pick normally.
  const initialRole = asOnboardingRole(
    typeof searchParams?.role === "string" ? searchParams.role : null
  )

  return (
    <CourtBackdrop variant="navy" fullPage contentClassName="px-4 py-6">
      <div className="mx-auto w-full max-w-3xl">
        <OnboardingFlow userName={dbUser.firstName || "there"} initialRole={initialRole} />
      </div>
    </CourtBackdrop>
  )
}
