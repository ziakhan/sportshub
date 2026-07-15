import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership } from "@/lib/teams/chat-access"
import { TeamPolls } from "./team-polls"

/**
 * Team polls & surveys — same membership as team chat. Staff create and
 * manage; families vote and watch results fill in.
 */
export default async function TeamPollsPage({ params }: { params: { teamId: string } }) {
  const auth = await getSessionUserId()
  if (!auth) redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/teams/${params.teamId}/polls`)}`)

  const membership = await getChatMembership(params.teamId, auth.userId, auth.isPlatformAdmin)
  if (!membership) notFound()

  const isStaffSide = membership.role !== "family"

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-ink-900 truncate text-xl font-bold">{membership.teamName}</h2>
          <p className="text-ink-500 truncate text-sm">{membership.clubName} • Polls & surveys</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/teams/${membership.teamId}/chat`}
            className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
          >
            Team Chat
          </Link>
          <Link
            href={isStaffSide ? `/teams/${membership.teamId}` : `/team/${membership.teamId}`}
            className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
          >
            {isStaffSide ? "Team Home" : "Team Page"}
          </Link>
        </div>
      </div>

      <TeamPolls teamId={membership.teamId} isStaff={isStaffSide} />
    </div>
  )
}
