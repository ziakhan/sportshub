import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership } from "@/lib/teams/chat-access"
import { formatSlotSummary, generateOccurrences, notifyTeam } from "@/lib/teams/practices"

export const dynamic = "force-dynamic"

const announceSchema = z.object({
  weeks: z.number().int().min(1).max(26).default(10),
})

/**
 * POST /api/teams/[id]/practices/announce — staff. Expands the team's
 * recurring slots into dated Practice rows for the next N weeks (skipping
 * datetimes that already have one, so re-announcing extends the horizon
 * instead of duplicating), stamps practiceScheduleAnnouncedAt, and
 * notifies every member (bell + email).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership || membership.role === "family") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const parsed = announceSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const slots = await (prisma as any).practiceSlot.findMany({
      where: { teamId: params.id },
    })
    if (slots.length === 0) {
      return NextResponse.json(
        { error: "Set practice days first — the schedule is still TBD" },
        { status: 400 }
      )
    }

    const occurrences = generateOccurrences(slots, parsed.data.weeks, new Date())
    const existing = await (prisma as any).practice.findMany({
      where: {
        teamId: params.id,
        scheduledAt: { in: occurrences.map((o) => o.scheduledAt) },
      },
      select: { scheduledAt: true },
    })
    const taken = new Set(existing.map((e: any) => new Date(e.scheduledAt).getTime()))
    const fresh = occurrences.filter((o) => !taken.has(o.scheduledAt.getTime()))

    if (fresh.length > 0) {
      await (prisma as any).practice.createMany({
        data: fresh.map((o) => ({
          teamId: params.id,
          tenantId: membership.tenantId,
          scheduledAt: o.scheduledAt,
          duration: o.durationMinutes,
          venueId: o.venueId ?? null,
          location: o.location,
          slotId: o.slotId ?? null,
        })),
      })
    }

    const team = await (prisma as any).team.update({
      where: { id: params.id },
      data: { practiceScheduleAnnouncedAt: new Date() },
      select: { practiceScheduleAnnouncedAt: true },
    })

    const summary = formatSlotSummary(slots)
    const notified = await notifyTeam({
      teamId: membership.teamId,
      tenantId: membership.tenantId,
      excludeUserId: auth.userId,
      type: "practice_schedule",
      title: `Practice schedule — ${membership.teamName}`,
      message: summary,
      link: `/teams/${membership.teamId}/calendar`,
      referenceId: membership.teamId,
      emailSubject: `Practice schedule announced — ${membership.teamName}`,
      emailHtml: `<p>The practice schedule for <strong>${membership.teamName}</strong> (${membership.clubName}) is out:</p><p><strong>${summary}</strong></p><p>See dates, get changes live, and add the schedule to your phone's calendar: <a href="${process.env.NEXTAUTH_URL || ""}/teams/${membership.teamId}/calendar">team calendar</a></p>`,
    })

    return NextResponse.json({
      created: fresh.length,
      skippedExisting: occurrences.length - fresh.length,
      notified,
      announcedAt: team.practiceScheduleAnnouncedAt,
    })
  } catch (error) {
    console.error("Practice announce error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
