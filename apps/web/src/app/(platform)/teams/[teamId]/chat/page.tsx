import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembers, getChatMembership } from "@/lib/teams/chat-access"
import { TeamChat } from "./team-chat"

/**
 * Team ↔ family chat — one page for both sides. Staff arrive from the club
 * team dashboard, families from their dashboard or the public team hub.
 */
export default async function TeamChatPage({ params }: { params: { teamId: string } }) {
  const auth = await getSessionUserId()
  if (!auth) redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/teams/${params.teamId}/chat`)}`)

  const membership = await getChatMembership(params.teamId, auth.userId, auth.isPlatformAdmin)
  if (!membership) notFound()

  const members = await getChatMembers(membership.teamId, membership.tenantId)
  const isStaffSide = membership.role !== "family"

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-ink-900 truncate text-xl font-bold">{membership.teamName}</h2>
          <p className="text-ink-500 truncate text-sm">
            {membership.clubName} • Team chat
          </p>
        </div>
        <Link
          href={
            isStaffSide
              ? `/clubs/${membership.tenantId}/teams/${membership.teamId}/dashboard`
              : `/team/${membership.teamId}`
          }
          className="border-ink-200 text-ink-700 hover:bg-court-50 shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold"
        >
          {isStaffSide ? "Team Dashboard" : "Team Page"}
        </Link>
      </div>

      <TeamChat
        teamId={membership.teamId}
        currentUserId={auth.userId}
        canModerate={isStaffSide}
        members={members}
      />
    </div>
  )
}
