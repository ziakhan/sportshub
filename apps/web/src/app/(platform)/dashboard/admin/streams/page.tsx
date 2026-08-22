import { redirect } from "next/navigation"
import { getSessionUserId } from "@/lib/auth-helpers"
import { StreamsConsole } from "./console"

export const dynamic = "force-dynamic"

/**
 * Streams ops dashboard (docs/roadmap/live-streaming-plan.md, "Surfaces" 5).
 *
 * The office half of the streaming system. The scorekeeper's job at the table
 * is one tap on a picture; everything else about the camera fleet lives here:
 * which rigs exist, which are pushing a signal, where each one is standing,
 * what it is showing now and next, and who moved it there.
 *
 * The game-day runbook ends with one sentence about this page — "a red channel
 * with a game in window is the only thing needing a human" — so the whole
 * layout is arranged to make that one case findable at a glance.
 *
 * Guarded server-side, the same way the club review console is, rather than
 * letting the API 403 after the page has already painted. This page shows the
 * cameras' ingest credentials; it must never render for anyone else, even for
 * the moment it takes a fetch to fail.
 */
export default async function AdminStreamsPage() {
  const auth = await getSessionUserId()
  if (!auth?.isPlatformAdmin) redirect("/dashboard")
  return <StreamsConsole />
}
