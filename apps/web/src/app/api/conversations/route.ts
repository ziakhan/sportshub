import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { dmPairAllowed, dmPairKey, dmRoleOnTeam } from "@/lib/messages/dm"

export const dynamic = "force-dynamic"

/**
 * GET /api/conversations — my DM threads: the other person, team context,
 * last message preview, unread count. Newest activity first.
 */
export async function GET() {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rows = await (prisma as any).conversation.findMany({
      where: { participants: { some: { userId: auth.userId } } },
      select: {
        id: true,
        updatedAt: true,
        team: { select: { id: true, name: true } },
        participants: {
          select: {
            userId: true,
            lastReadAt: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, createdAt: true, senderId: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    })

    const conversations = await Promise.all(
      rows.map(async (c: any) => {
        const me = c.participants.find((p: any) => p.userId === auth.userId)
        const other = c.participants.find((p: any) => p.userId !== auth.userId)
        const unread = await (prisma as any).directMessage.count({
          where: {
            conversationId: c.id,
            deletedAt: null,
            senderId: { not: auth.userId },
            ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
          },
        })
        return {
          id: c.id,
          teamId: c.team?.id ?? null,
          teamName: c.team?.name ?? null,
          otherUserId: other?.userId ?? null,
          otherName:
            [other?.user?.firstName, other?.user?.lastName].filter(Boolean).join(" ") ||
            other?.user?.email ||
            "Member",
          lastMessage: c.messages[0]?.body ?? null,
          lastMessageAt: c.messages[0]?.createdAt ?? c.updatedAt,
          lastMessageMine: c.messages[0]?.senderId === auth.userId,
          unread,
        }
      })
    )

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error("Conversations list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const createSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
})

/**
 * POST /api/conversations { teamId, userId } — open (find or create) the 1:1
 * thread with another adult member of that team. Safeguarding rules in
 * lib/messages/dm.ts.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "teamId and userId are required" }, { status: 400 })
    }
    const { teamId, userId: otherId } = parsed.data
    if (otherId === auth.userId) {
      return NextResponse.json({ error: "That's you" }, { status: 400 })
    }

    const [myRole, theirRole] = await Promise.all([
      dmRoleOnTeam(teamId, auth.userId),
      dmRoleOnTeam(teamId, otherId),
    ])
    if (!myRole || !theirRole) {
      return NextResponse.json(
        { error: "Both people must be members of this team" },
        { status: 403 }
      )
    }
    if (!dmPairAllowed(myRole, theirRole)) {
      return NextResponse.json(
        { error: "Players can only message team staff directly" },
        { status: 403 }
      )
    }

    const pairKey = dmPairKey(auth.userId, otherId, teamId)
    const existing = await (prisma as any).conversation.findUnique({
      where: { pairKey },
      select: { id: true },
    })
    if (existing) return NextResponse.json({ conversationId: existing.id })

    const created = await (prisma as any).conversation.create({
      data: {
        teamId,
        pairKey,
        participants: { create: [{ userId: auth.userId }, { userId: otherId }] },
      },
      select: { id: true },
    })
    return NextResponse.json({ conversationId: created.id }, { status: 201 })
  } catch (error) {
    console.error("Conversation create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
