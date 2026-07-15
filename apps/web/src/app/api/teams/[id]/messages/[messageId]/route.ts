import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership } from "@/lib/teams/chat-access"

export const dynamic = "force-dynamic"

/** Senders can fix a message for a short window after sending it. */
const EDIT_WINDOW_MS = 15 * 60 * 1000

const editSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty").max(2000),
})

/**
 * PATCH /api/teams/[id]/messages/[messageId]
 * { body }            — sender edits their text (15-min window); persists
 *                       editedAt so every reader sees "(edited)" (2026-07-15).
 * { pinned: boolean } — staff pin/unpin the message to the top of the chat.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; messageId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Staff pin/unpin (2026-07-15) — separate branch from sender edits
    const rawBody = await request.clone().json().catch(() => null)
    if (rawBody && typeof rawBody.pinned === "boolean" && rawBody.body === undefined) {
      if (membership.role !== "staff" && membership.role !== "admin") {
        return NextResponse.json({ error: "Only staff can pin messages" }, { status: 403 })
      }
      const target = await prisma.teamMessage.findFirst({
        where: { id: params.messageId, teamId: params.id, deletedAt: null },
        select: { id: true },
      })
      if (!target) return NextResponse.json({ error: "Message not found" }, { status: 404 })
      const pinnedMsg = await prisma.teamMessage.update({
        where: { id: target.id },
        data: rawBody.pinned
          ? { pinnedAt: new Date(), pinnedById: auth.userId }
          : { pinnedAt: null, pinnedById: null },
        select: { id: true, pinnedAt: true },
      })
      return NextResponse.json({ message: pinnedMsg })
    }

    const message = await prisma.teamMessage.findFirst({
      where: { id: params.messageId, teamId: params.id, deletedAt: null },
      select: { id: true, senderId: true, pollId: true, createdAt: true },
    })
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })

    // Sender-only — unlike delete, staff cannot edit someone else's words
    if (message.senderId !== auth.userId) {
      return NextResponse.json({ error: "You can only edit your own messages" }, { status: 403 })
    }
    if (message.pollId) {
      return NextResponse.json({ error: "Poll messages can't be edited" }, { status: 409 })
    }

    // Archived teams keep their chat as read-only history (same rule as POST)
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

    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      return NextResponse.json(
        { error: "Messages can only be edited within 15 minutes of sending" },
        { status: 409 }
      )
    }

    const parsed = editSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid message" },
        { status: 400 }
      )
    }

    const updated = await prisma.teamMessage.update({
      where: { id: message.id },
      data: { body: parsed.data.body, editedAt: new Date() },
      select: { id: true, body: true, createdAt: true, editedAt: true },
    })

    return NextResponse.json({ message: updated })
  } catch (error) {
    console.error("Team chat edit error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Remove a message: senders take back their own; staff/admin moderate any.
 * Soft delete — the row stays for accountability in a kids' sports chat.
 * DELETE /api/teams/[id]/messages/[messageId]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; messageId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const message = await prisma.teamMessage.findFirst({
      where: { id: params.messageId, teamId: params.id, deletedAt: null },
      select: { id: true, senderId: true, pollId: true },
    })
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })

    const canModerate = membership.role === "staff" || membership.role === "admin"
    if (message.senderId !== auth.userId && !canModerate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.teamMessage.update({
      where: { id: message.id },
      data: { deletedAt: new Date(), deletedById: auth.userId },
    })

    // A taken-back/moderated poll message takes its poll (and votes) with it
    if (message.pollId) {
      await (prisma as any).poll.delete({ where: { id: message.pollId } }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Team chat delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
