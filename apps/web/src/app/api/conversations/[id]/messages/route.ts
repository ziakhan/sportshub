import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notifyMany } from "@/lib/notifications"
import { publishRealtime, rooms as rt } from "@/lib/realtime/publish"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

async function loadParticipant(conversationId: string, userId: string) {
  const convo = await (prisma as any).conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      teamId: true,
      team: { select: { name: true, archivedAt: true } },
      participants: {
        select: {
          userId: true,
          lastReadAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })
  if (!convo) return null
  const me = convo.participants.find((p: any) => p.userId === userId)
  if (!me) return null
  return { convo, me, other: convo.participants.find((p: any) => p.userId !== userId) }
}

function serialize(m: any) {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt,
    editedAt: m.editedAt,
    sender: {
      id: m.sender.id,
      name: [m.sender.firstName, m.sender.lastName].filter(Boolean).join(" "),
    },
  }
}

/** GET /api/conversations/[id]/messages(?after=ISO) — thread; reading marks read. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const loaded = await loadParticipant(params.id, auth.userId)
    if (!loaded) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const after = new URL(request.url).searchParams.get("after")
    const rows = await (prisma as any).directMessage.findMany({
      where: {
        conversationId: params.id,
        deletedAt: null,
        ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        editedAt: true,
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: after ? "asc" : "desc" },
      take: PAGE_SIZE,
    })
    const ordered = after ? rows : [...rows].reverse()

    if (!after || rows.length > 0) {
      await (prisma as any).conversationParticipant.updateMany({
        where: { conversationId: params.id, userId: auth.userId },
        data: { lastReadAt: new Date() },
      })
    }

    const otherName =
      [loaded.other?.user?.firstName, loaded.other?.user?.lastName].filter(Boolean).join(" ") ||
      "Member"
    return NextResponse.json({
      messages: ordered.map(serialize),
      conversation: {
        id: loaded.convo.id,
        teamId: loaded.convo.teamId,
        teamName: loaded.convo.team?.name ?? null,
        otherName,
        otherUserId: loaded.other?.userId ?? null,
      },
    })
  } catch (error) {
    console.error("DM list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const sendSchema = z.object({ body: z.string().trim().min(1).max(2000) })

/** POST /api/conversations/[id]/messages { body } */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const loaded = await loadParticipant(params.id, auth.userId)
    if (!loaded) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (loaded.convo.team?.archivedAt) {
      return NextResponse.json({ error: "This team is archived" }, { status: 409 })
    }

    const parsed = sendSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Message can't be empty" }, { status: 400 })
    }

    const message = await (prisma as any).directMessage.create({
      data: { conversationId: params.id, senderId: auth.userId, body: parsed.data.body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        editedAt: true,
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
    })
    await Promise.all([
      (prisma as any).conversation.update({
        where: { id: params.id },
        data: { updatedAt: new Date() },
      }),
      (prisma as any).conversationParticipant.updateMany({
        where: { conversationId: params.id, userId: auth.userId },
        data: { lastReadAt: new Date() },
      }),
    ])

    const recipientId: string | undefined = loaded.other?.userId
    if (recipientId) {
      // Debounced bell/push: one per unread thread, like team chat
      const alreadyBelled = await prisma.notification.findFirst({
        where: {
          userId: recipientId,
          type: "direct_message",
          referenceId: params.id,
          isRead: false,
        },
        select: { id: true },
      })
      if (!alreadyBelled) {
        const senderName = [message.sender.firstName, message.sender.lastName]
          .filter(Boolean)
          .join(" ")
        const preview =
          message.body.length > 80 ? `${message.body.slice(0, 77)}…` : message.body
        await notifyMany(prisma, [recipientId], {
          type: "direct_message",
          title: `Message from ${senderName}${loaded.convo.team?.name ? ` (${loaded.convo.team.name})` : ""}`,
          message: preview,
          link: `/messages/dm/${params.id}`,
          referenceId: params.id,
          referenceType: "Conversation",
        }).catch(() => {})
      }
      await publishRealtime({
        rooms: [rt.user(recipientId), rt.user(auth.userId)],
        event: "dm.message",
        payload: { conversationId: params.id },
      }).catch(() => {})
    }

    return NextResponse.json({ message: serialize(message) }, { status: 201 })
  } catch (error) {
    console.error("DM send error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
