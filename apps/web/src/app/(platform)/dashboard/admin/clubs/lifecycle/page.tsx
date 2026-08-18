import { redirect } from "next/navigation"
import { getSessionUserId } from "@/lib/auth-helpers"
import { ClubLifecycleConsole } from "./console"

export const dynamic = "force-dynamic"

/**
 * Club review console.
 *
 * The census import put ~1,700 clubs in the database, most never seen by a
 * human. This is where they get worked through: found by what is wrong with
 * them, corrected, published, and de-duplicated.
 *
 * Guarded server-side rather than relying on the API 403ing, which is what
 * several older admin pages do — those briefly render before erroring.
 */
export default async function ClubLifecyclePage() {
  const auth = await getSessionUserId()
  if (!auth?.isPlatformAdmin) redirect("/dashboard")
  return <ClubLifecycleConsole />
}
