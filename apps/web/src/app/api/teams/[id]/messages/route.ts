import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership, getTeamStaffUserIds } from "@/lib/teams/chat-access"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty").max(2000),
})

function serialize(message: any, staffIds: Set<string>) {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    sender: {
      id: message.sender.id,
      name: [message.sender.firstName, message.sender.lastName].filter(Boolean).join(" "),
      isStaff: staffIds.has(message.sender.id),
    },
  }
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
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: after ? "asc" : "desc" },
      take: PAGE_SIZE,
    })
    const ordered = after ? rows : [...rows].reverse()

    const staffIds = await getTeamStaffUserIds(membership.teamId, membership.tenantId)

    return NextResponse.json({
      messages: ordered.map((m: (typeof rows)[number]) => serialize(m, staffIds)),
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

    const parsed = sendMessageSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid message" },
        { status: 400 }
      )
    }

    const message = await prisma.teamMessage.create({
      data: { teamId: params.id, senderId: auth.userId, body: parsed.data.body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    const staffIds = await getTeamStaffUserIds(membership.teamId, membership.tenantId)
    return NextResponse.json({ message: serialize(message, staffIds) }, { status: 201 })
  } catch (error) {
    console.error("Team chat send error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
