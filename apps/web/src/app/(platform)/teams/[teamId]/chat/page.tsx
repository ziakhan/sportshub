import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
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

  const [members, teamRow] = await Promise.all([
    getChatMembers(membership.teamId, membership.tenantId),
    prisma.team.findUnique({
      where: { id: membership.teamId },
      select: { archivedAt: true },
    }),
  ])
  const isStaffSide = membership.role !== "family"
  const archived = !!teamRow?.archivedAt

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <Link
            href={isStaffSide ? `/teams/${membership.teamId}` : `/team/${membership.teamId}`}
            className="text-ink-900 hover:text-play-700 block truncate text-xl font-bold hover:underline"
          >
            {membership.teamName}
          </Link>
          <p className="text-ink-500 truncate text-sm">
            {membership.clubName} • Team chat
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/teams/${membership.teamId}/polls`}
            className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
          >
            Polls
          </Link>
        </div>
      </div>

      <TeamChat
        teamId={membership.teamId}
        currentUserId={auth.userId}
        canModerate={isStaffSide}
        members={members}
        archived={archived}
      />
    </div>
  )
}
