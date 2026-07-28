import { prisma } from "@youthbasketballhub/db"
import { notifyMany } from "@/lib/notifications"
import { getChatMembers } from "@/lib/teams/chat-access"
import { publishRealtime, rooms as rt } from "@/lib/realtime/publish"

/**
 * Post an existing poll into a team's chat as a message bubble — the exact
 * TeamMessage mechanism chat quick-polls already use (QA-207 /
 * `api/teams/[id]/messages/route.ts:258-283`). Used by:
 *  - team-hub poll creation, relaying into the poll's own team (requirement 1
 *    of the three-tier polls ruling, owner 2026-07-24)
 *  - the club "Also post to team chats" relay, which can target several
 *    teams at once (requirement 2) — a Poll's `chatMessages` is a list for
 *    exactly this reason.
 *
 * Best-effort by design (mirrors the announcement bell fanout): callers
 * wrap this in try/catch so a chat-post hiccup never blocks poll creation.
 */
export async function relayPollToTeamChat(opts: {
  pollId: string
  teamId: string
  teamName: string
  tenantId: string
  senderId: string
  body: string
}): Promise<void> {
  const message = await prisma.teamMessage.create({
    data: {
      teamId: opts.teamId,
      senderId: opts.senderId,
      body: opts.body,
      pollId: opts.pollId,
    },
    select: { id: true },
  })

  await publishRealtime({
    rooms: [rt.team(opts.teamId)],
    event: "chat.message",
    payload: { teamId: opts.teamId, messageId: message.id },
  })

  // Debounced bell: only members with no unread team_chat notification for
  // this team yet get one (same rule as a normal chat message).
  const members = await getChatMembers(opts.teamId, opts.tenantId)
  const mutes = await (prisma as any).chatMute.findMany({
    where: { teamId: opts.teamId },
    select: { userId: true },
  })
  const mutedSet = new Set(mutes.map((m: { userId: string }) => m.userId))
  const candidates = members.userIds.filter((id) => id !== opts.senderId && !mutedSet.has(id))
  if (candidates.length === 0) return

  const alreadyBelled = await prisma.notification.findMany({
    where: {
      userId: { in: candidates },
      type: "team_chat",
      referenceId: opts.teamId,
      isRead: false,
    },
    select: { userId: true },
  })
  const belledSet = new Set(alreadyBelled.map((n: { userId: string }) => n.userId))
  const toNotify = candidates.filter((id) => !belledSet.has(id))
  if (toNotify.length === 0) return

  const preview = opts.body.length > 80 ? `${opts.body.slice(0, 77)}…` : opts.body
  await notifyMany(prisma, toNotify, {
    type: "team_chat",
    title: `New message in ${opts.teamName} chat`,
    message: `📊 ${preview}`,
    link: `/teams/${opts.teamId}/chat`,
    referenceId: opts.teamId,
    referenceType: "Team",
  })
}
