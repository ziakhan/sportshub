import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership } from "@/lib/teams/chat-access"

export const dynamic = "force-dynamic"

/**
 * Recurring practice pattern for a team ("Tue 6:30 PM · Thu 6:00 PM").
 * GET — members see the slots (staff manage them from the calendar page).
 * PUT — staff replace the whole set (empty array = schedule TBD). Editing
 * slots does NOT touch already-generated occurrences; the next announce
 * fills in dates from the new pattern.
 */

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM"),
  durationMinutes: z.number().int().min(15).max(360),
  venueId: z.string().optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
})

const putSchema = z.object({ slots: z.array(slotSchema).max(7) })

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const [slots, team] = await Promise.all([
      (prisma as any).practiceSlot.findMany({
        where: { teamId: params.id },
        include: { venue: { select: { name: true } } },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      (prisma as any).team.findUnique({
        where: { id: params.id },
        select: { practiceScheduleAnnouncedAt: true },
      }),
    ])
    return NextResponse.json({
      slots,
      announcedAt: team?.practiceScheduleAnnouncedAt ?? null,
      membership: { role: membership.role },
    })
  } catch (error) {
    console.error("Practice slots list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership || membership.role === "family") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = putSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid slots" },
        { status: 400 }
      )
    }

    // Venue links (batch-backlog §2): resolve picked venues once so location
    // stays denormalized (display keeps working for legacy free-text slots).
    const venueIds = [...new Set(parsed.data.slots.map((s) => s.venueId).filter(Boolean))] as string[]
    const venues = venueIds.length
      ? await (prisma as any).venue.findMany({
          where: { id: { in: venueIds } },
          select: { id: true, name: true },
        })
      : []
    const venueById = new Map(venues.map((v: any) => [v.id, v]))
    if (venueIds.some((id) => !venueById.has(id))) {
      return NextResponse.json({ error: "Venue not found" }, { status: 400 })
    }

    const slots = await (prisma as any).$transaction(async (tx: any) => {
      await tx.practiceSlot.deleteMany({ where: { teamId: params.id } })
      if (parsed.data.slots.length > 0) {
        await tx.practiceSlot.createMany({
          data: parsed.data.slots.map((s) => {
            const venue: any = s.venueId ? venueById.get(s.venueId) : null
            return {
              teamId: params.id,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              durationMinutes: s.durationMinutes,
              venueId: venue?.id ?? null,
              location: s.location || venue?.name || null,
            }
          }),
        })
      }
      return tx.practiceSlot.findMany({
        where: { teamId: params.id },
        include: { venue: { select: { name: true } } },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      })
    })

    return NextResponse.json({ slots })
  } catch (error) {
    console.error("Practice slots update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
