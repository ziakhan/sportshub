// Platform Messages — PlatformAdmin-only composer over the PLATFORM consent
// scope (owner decision 2026-07-09: ships alongside the club/league
// composers, same consent rail).

import { redirect } from "next/navigation"
import { getSessionUserId } from "@/lib/auth-helpers"
import { MessageComposer } from "@/components/comms/message-composer"
import { SmartBack } from "@/components/ui"

export const dynamic = "force-dynamic"

export default async function AdminMessagesPage() {
  const auth = await getSessionUserId()
  if (!auth?.isPlatformAdmin) redirect("/dashboard")

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <SmartBack fallback="/dashboard" fallbackLabel="Dashboard" className="-ml-1 mb-1" />
        <h1 className="text-ink-950 mt-1 text-xl font-bold">Platform messages</h1>
        <p className="text-ink-500 text-sm">
          Email all platform users. Only users with platform-scope marketing consent receive it —
          everyone else is skipped automatically at send time.
        </p>
      </div>
      <MessageComposer scope="PLATFORM" orgId={null} orgName="SportsHub" />
    </div>
  )
}
