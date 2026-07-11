import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notifyStaffOfLateNotGoing, resolveRsvpItem } from "@/lib/rsvp"

export const dynamic = "force-dynamic"

// Seed/demo ids aren't UUIDs — plain strings, validated by lookup
const putSchema = z.object({
  playerId: z.string().min(1),
  itemType: z.enum(["PRACTICE", "GAME", "TEAM_EVENT"]),
  itemId: z.string().min(1),
  status: z.enum(["GOING", "NOT_GOING", "MAYBE"]),
  note: z.string().trim().max(300).optional().nullable(),
})

/**
 * PUT /api/rsvp — a parent (or 13+ self-player: they're their own parent)
 * sets a player's Going / Not going / Maybe for one calendar item. Upserts,
 * so changing your answer is the same call. Staff see the roll-up on the
 * team calendar; a late flip to Not going pings them (bell + push).
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = putSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid RSVP" },
        { status: 400 }
      )
    }
    const { playerId, itemType, itemId, status, note } = parsed.data

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, firstName: true, lastName: true, parentId: true, deletedAt: true },
    })
    if (!player || player.deletedAt) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }
    if (player.parentId !== auth.userId && !auth.isPlatformAdmin) {
      return NextResponse.json({ error: "You can only RSVP for your own family" }, { status: 403 })
    }

    const item = await resolveRsvpItem(itemType, itemId)
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    if (item.cancelled) {
      return NextResponse.json({ error: "This item was cancelled" }, { status: 400 })
    }
    if (item.startAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "This item has already started" }, { status: 400 })
    }

    // The player must be on an ACTIVE roster of one of the item's teams
    const rosterEntry = await prisma.teamPlayer.findFirst({
      where: { playerId, teamId: { in: item.teamIds }, status: "ACTIVE" },
      select: { teamId: true },
    })
    if (!rosterEntry) {
      return NextResponse.json({ error: "Player is not on this team" }, { status: 403 })
    }

    const previous = await (prisma as any).eventRsvp.findUnique({
      where: { playerId_itemType_itemId: { playerId, itemType, itemId } },
      select: { status: true },
    })
    const rsvp = await (prisma as any).eventRsvp.upsert({
      where: { playerId_itemType_itemId: { playerId, itemType, itemId } },
      create: {
        playerId,
        itemType,
        itemId,
        status,
        note: note || null,
        respondedById: auth.userId,
      },
      update: { status, note: note || null, respondedById: auth.userId },
      select: { playerId: true, itemType: true, itemId: true, status: true, note: true },
    })

    if (status === "NOT_GOING" && previous?.status !== "NOT_GOING") {
      await notifyStaffOfLateNotGoing({
        item,
        playerTeamId: rosterEntry.teamId,
        playerName: `${player.firstName} ${player.lastName}`.trim(),
        respondedById: auth.userId,
        note: note || null,
      })
    }

    return NextResponse.json({ rsvp })
  } catch (error) {
    console.error("RSVP error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
