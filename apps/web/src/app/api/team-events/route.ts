import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import {
  authorizeEventTeams,
  eventInclude,
  formatEventDate,
  notifyEventTeams,
  serializeEvent,
} from "@/lib/teams/events"

export const dynamic = "force-dynamic"

const createSchema = z.object({
  teamIds: z.array(z.string().min(1)).min(1, "Pick at least one team").max(50),
  title: z.string().trim().min(1, "Title is required").max(150),
  description: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(200).optional(),
  startAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(720).default(60),
  // Typed events (2026-07-15): workout/lift, training, scrimmage…
  eventType: z.enum(["WORKOUT", "TRAINING", "SCRIMMAGE", "MEETING", "OTHER"]).default("OTHER"),
})

/**
 * POST /api/team-events — create an event on one or several team calendars.
 * Editor circle: club owners/managers, team-scoped Staff/TeamManager, or a
 * league owner whose league the team plays in (approved submission). Every
 * attached team's members get one bell + email (deduped across teams).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid event" },
        { status: 400 }
      )
    }

    const authz = await authorizeEventTeams(auth.userId, parsed.data.teamIds, auth.isPlatformAdmin)
    if (!authz.ok) {
      return NextResponse.json(
        { error: "You don't manage some of the selected teams", deniedTeamIds: authz.deniedTeamIds },
        { status: 403 }
      )
    }

    const event = await (prisma as any).teamEvent.create({
      data: {
        createdById: auth.userId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        location: parsed.data.location || null,
        startAt: new Date(parsed.data.startAt),
        durationMinutes: parsed.data.durationMinutes,
        eventType: parsed.data.eventType,
        teams: { create: authz.teams.map((t) => ({ teamId: t.id })) },
      },
      include: eventInclude,
    })

    const when = formatEventDate(event.startAt)
    await notifyEventTeams({
      teams: authz.teams,
      excludeUserId: auth.userId,
      title: `New team event: ${event.title}`,
      message: `${when}${event.location ? ` at ${event.location}` : ""}`,
      emailSubject: `New team event — ${event.title} (${when})`,
      emailHtml: (calendarLink) =>
        `<p><strong>${event.title}</strong> was added to your team calendar.</p><p><strong>${when}</strong>${event.location ? ` at ${event.location}` : ""}</p>${event.description ? `<p>${event.description}</p>` : ""}<p>See it with the rest of the schedule: <a href="${calendarLink}">team calendar</a></p>`,
      referenceId: event.id,
    })

    return NextResponse.json({ event: serializeEvent(event) }, { status: 201 })
  } catch (error) {
    console.error("Team event create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
