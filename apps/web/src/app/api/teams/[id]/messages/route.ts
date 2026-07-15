import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notifyMany } from "@/lib/notifications"
import {
  getChatMembers,
  getChatMembership,
  getSenderContexts,
  getTeamStaffUserIds,
  markChatRead,
} from "@/lib/teams/chat-access"
import { pollInclude, serializeChatPoll } from "@/lib/teams/polls"
import { publishRealtime, rooms as rt } from "@/lib/realtime/publish"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50
/** Poll-bearing messages within this recent window get live vote refreshes */
const POLL_REFRESH_WINDOW = 20

const sendMessageSchema = z
  .object({
    body: z.string().trim().min(1, "Message can't be empty").max(2000).optional(),
    // Quick poll (staff): single question posted straight into the stream
    poll: z
      .object({
        question: z.string().trim().min(1, "Question can't be empty").max(300),
        options: z
          .array(z.string().trim().min(1, "Option can't be empty").max(100))
          .min(2, "A poll needs at least 2 options")
          .max(6),
        allowMultiple: z.boolean().optional().default(false),
      })
      .optional(),
  })
  .refine((data) => data.body || data.poll, { message: "Message can't be empty" })

function serialize(
  message: any,
  staffIds: Set<string>,
  pollById?: Map<string, any>,
  senderContexts?: Map<string, string>
) {
  const isStaff = staffIds.has(message.sender.id)
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    poll: message.pollId ? (pollById?.get(message.pollId) ?? null) : null,
    sender: {
      id: message.sender.id,
      name: [message.sender.firstName, message.sender.lastName].filter(Boolean).join(" "),
      isStaff,
      // "Miles's parent" / "player" — which family this adult belongs to
      context: isStaff ? null : (senderContexts?.get(message.sender.id) ?? null),
    },
  }
}

/**
 * Chat polls need fresher data than the message stream: votes mutate
 * existing polls, so an ?after= delta poll would never see them. Every GET
 * therefore also returns the current state of recent poll messages
 * (pollUpdates) for the client to merge over its cache.
 */
async function loadChatPolls(teamId: string, viewerId: string, rowPollIds: string[]) {
  const recent = await prisma.teamMessage.findMany({
    where: { teamId, deletedAt: null, pollId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: POLL_REFRESH_WINDOW,
    select: { id: true, pollId: true },
  })
  const pollIds = [...new Set([...rowPollIds, ...recent.map((m: any) => m.pollId as string)])]
  if (pollIds.length === 0) {
    return { pollById: new Map<string, any>(), pollUpdates: [] as any[] }
  }
  const polls = await (prisma as any).poll.findMany({
    where: { id: { in: pollIds } },
    include: pollInclude,
  })
  const pollById = new Map<string, any>(
    polls.map((p: any) => [p.id, serializeChatPoll(p, viewerId)])
  )
  const pollUpdates = recent
    .map((m: any) => ({ messageId: m.id, poll: pollById.get(m.pollId) ?? null }))
    .filter((u: any) => u.poll)
  return { pollById, pollUpdates }
}

/**
 * Team chat feed.
 * GET /api/teams/[id]/messages            — latest page (ascending order)
 * GET /api/teams/[id]/messages?after=ISO  — poll for newer than a timestamp
 * GET /api/teams/[id]/messages?before=ISO — page of older history
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const after = searchParams.get("after")
    const before = searchParams.get("before")

    const where: any = { teamId: params.id, deletedAt: null }
    if (after) where.createdAt = { gt: new Date(after) }
    if (before) where.createdAt = { lt: new Date(before) }

    // Newest-first query for latest/older pages, flipped to ascending for
    // display; polling (?after) reads ascending directly.
    const rows = await prisma.teamMessage.findMany({
      where,
      select: {
        id: true,
        body: true,
        createdAt: true,
        pollId: true,
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: after ? "asc" : "desc" },
      take: PAGE_SIZE,
    })
    const ordered = after ? rows : [...rows].reverse()

    const [staffIds, senderContexts, { pollById, pollUpdates }] = await Promise.all([
      getTeamStaffUserIds(membership.teamId, membership.tenantId),
      getSenderContexts(membership.teamId),
      loadChatPolls(
        membership.teamId,
        auth.userId,
        rows.filter((r: any) => r.pollId).map((r: any) => r.pollId as string)
      ),
    ])

    // Reading advances the cursor: on open, and whenever a poll actually
    // delivers something new (a poll that returns nothing writes nothing).
    if (!before && (!after || rows.length > 0)) {
      await markChatRead(auth.userId, membership.teamId)
    }

    return NextResponse.json({
      messages: ordered.map((m: (typeof rows)[number]) => serialize(m, staffIds, pollById, senderContexts)),
      pollUpdates,
      hasMore: !after && rows.length === PAGE_SIZE,
      membership: { role: membership.role },
    })
  } catch (error) {
    console.error("Team chat list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Send a message.
 * POST /api/teams/[id]/messages  { body }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Archived teams keep their chat as read-only history (season-continuity
    // plan §2, owner decision: read-only immediately on archive)
    const teamRow = await prisma.team.findUnique({
      where: { id: params.id },
      select: { archivedAt: true },
    })
    if (teamRow?.archivedAt) {
      return NextResponse.json(
        { error: "This team is archived — chat is read-only" },
        { status: 409 }
      )
    }

    const parsed = sendMessageSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid message" },
        { status: 400 }
      )
    }

    // Quick polls are open to every chat member (owner call 2026-07-07:
    // "keep it to adults" — membership is staff + parents, which is the
    // adult set; multi-question surveys on the polls page stay staff-only).
    const messageSelect = {
      id: true,
      body: true,
      createdAt: true,
      pollId: true,
      sender: { select: { id: true, firstName: true, lastName: true } },
    }

    let message: any
    let chatPoll: any = null
    if (parsed.data.poll) {
      const pollInput = parsed.data.poll
      const created = await (prisma as any).$transaction(async (tx: any) => {
        const poll = await tx.poll.create({
          data: {
            teamId: params.id,
            createdById: auth.userId,
            title: pollInput.question,
            questions: {
              create: [
                {
                  prompt: pollInput.question,
                  allowMultiple: pollInput.allowMultiple,
                  order: 0,
                  options: {
                    create: pollInput.options.map((label, i) => ({ label, order: i })),
                  },
                },
              ],
            },
          },
          include: pollInclude,
        })
        const msg = await tx.teamMessage.create({
          data: {
            teamId: params.id,
            senderId: auth.userId,
            body: parsed.data.body || pollInput.question,
            pollId: poll.id,
          },
          select: messageSelect,
        })
        return { poll, msg }
      })
      message = created.msg
      chatPoll = serializeChatPoll(created.poll, auth.userId)
    } else {
      message = await prisma.teamMessage.create({
        data: { teamId: params.id, senderId: auth.userId, body: parsed.data.body! },
        select: messageSelect,
      })
    }

    // Sending counts as reading your own chat
    await markChatRead(auth.userId, membership.teamId)

    // Debounced bell: only members with NO unread team_chat notification for
    // this team get one — a busy thread bells each member once until they
    // visit the chat (which clears it via markChatRead).
    const members = await getChatMembers(membership.teamId, membership.tenantId)
    const candidates = members.userIds.filter((id) => id !== auth.userId)
    if (candidates.length > 0) {
      const alreadyBelled = await prisma.notification.findMany({
        where: {
          userId: { in: candidates },
          type: "team_chat",
          referenceId: membership.teamId,
          isRead: false,
        },
        select: { userId: true },
      })
      const belledSet = new Set(alreadyBelled.map((n: { userId: string }) => n.userId))
      const toNotify = candidates.filter((id) => !belledSet.has(id))
      const senderName = [message.sender.firstName, message.sender.lastName]
        .filter(Boolean)
        .join(" ")
      const bodyText: string = message.body
      const preview = bodyText.length > 80 ? `${bodyText.slice(0, 77)}…` : bodyText
      await notifyMany(prisma, toNotify, {
        type: "team_chat",
        title: `New message in ${membership.teamName} chat`,
        message: `${senderName}: ${chatPoll ? "📊 " : ""}${preview}`,
        link: `/teams/${membership.teamId}/chat`,
        referenceId: membership.teamId,
        referenceType: "Team",
      })
    }

    // Realtime ping to the team room — members' open chats fetch the delta
    // immediately instead of waiting out their poll interval. Payload is a
    // ping (ids only): message content always comes from the API, where
    // poll state is serialized per viewer.
    await publishRealtime({
      rooms: [rt.team(membership.teamId)],
      event: "chat.message",
      payload: { teamId: membership.teamId, messageId: message.id },
    })

    const staffIds = await getTeamStaffUserIds(membership.teamId, membership.tenantId)
    const pollById = chatPoll ? new Map([[message.pollId, chatPoll]]) : undefined
    return NextResponse.json({ message: serialize(message, staffIds, pollById) }, { status: 201 })
  } catch (error) {
    console.error("Team chat send error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
