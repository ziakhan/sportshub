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
  type EventTeamRef,
} from "@/lib/teams/events"
import { intraOrgConflictMessage } from "@/lib/venues/conflicts"

export const dynamic = "force-dynamic"

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    location: z.string().trim().max(200).nullable().optional(),
    venueId: z.string().nullable().optional(),
    startAt: z.string().datetime().optional(),
    durationMinutes: z.number().int().min(15).max(720).optional(),
    eventType: z.enum(["WORKOUT", "TRAINING", "SCRIMMAGE", "MEETING", "OTHER"]).optional(),
    status: z.enum(["SCHEDULED", "CANCELLED"]).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" })

async function loadAndAuthorize(eventId: string) {
  const auth = await getSessionUserId()
  if (!auth) return { error: "Unauthorized", status: 401 as const }

  const event = await (prisma as any).teamEvent.findUnique({
    where: { id: eventId },
    include: { teams: { select: { team: { select: { id: true, name: true, tenantId: true } } } } },
  })
  if (!event) return { error: "Event not found", status: 404 as const }

  const teams: EventTeamRef[] = event.teams.map((l: any) => l.team)
  const authz = await authorizeEventTeams(
    auth.userId,
    teams.map((t) => t.id),
    auth.isPlatformAdmin
  )
  if (!authz.ok) return { error: "Forbidden", status: 403 as const }

  return { auth, event, teams }
}

/** PATCH /api/team-events/[id] — edit details, move, cancel or restore */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await loadAndAuthorize(params.id)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    const { auth, event, teams } = result

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid update" },
        { status: 400 }
      )
    }

    // Venue link: validate + denormalize location when a venue is set/changed
    let venuePatch: Record<string, unknown> = {}
    if (parsed.data.venueId !== undefined) {
      if (parsed.data.venueId) {
        const venue = await (prisma as any).venue.findUnique({
          where: { id: parsed.data.venueId },
          select: { id: true, name: true },
        })
        if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 400 })
        venuePatch = {
          venueId: venue.id,
          ...(parsed.data.location === undefined ? { location: venue.name } : {}),
        }
      } else {
        venuePatch = { venueId: null }
      }
    }

    // Intra-org HARD block: re-check when the venue or time is changing.
    const effectiveVenueId =
      parsed.data.venueId !== undefined ? parsed.data.venueId || null : event.venueId
    const touchesBooking =
      parsed.data.venueId !== undefined ||
      parsed.data.startAt !== undefined ||
      parsed.data.durationMinutes !== undefined
    if (touchesBooking && effectiveVenueId) {
      for (const tenantId of new Set(teams.map((t) => t.tenantId))) {
        const conflict = await intraOrgConflictMessage({
          venueId: effectiveVenueId,
          startAt:
            parsed.data.startAt !== undefined ? new Date(parsed.data.startAt) : event.startAt,
          durationMinutes: parsed.data.durationMinutes ?? event.durationMinutes ?? 60,
          tenantId,
          excludeTeamEventId: params.id,
        })
        if (conflict) return NextResponse.json({ error: conflict }, { status: 409 })
      }
    }

    const updated = await (prisma as any).teamEvent.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description || null }
          : {}),
        ...(parsed.data.location !== undefined ? { location: parsed.data.location || null } : {}),
        ...venuePatch,
        ...(parsed.data.startAt !== undefined ? { startAt: new Date(parsed.data.startAt) } : {}),
        ...(parsed.data.durationMinutes !== undefined
          ? { durationMinutes: parsed.data.durationMinutes }
          : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      },
      include: eventInclude,
    })

    // Members hear about the changes that affect showing up: time, place,
    // cancel/restore. Copy edits stay quiet.
    const cancelled = parsed.data.status === "CANCELLED" && event.status !== "CANCELLED"
    const restored = parsed.data.status === "SCHEDULED" && event.status === "CANCELLED"
    const moved =
      (parsed.data.startAt !== undefined &&
        new Date(parsed.data.startAt).getTime() !== new Date(event.startAt).getTime()) ||
      (parsed.data.location !== undefined && (parsed.data.location || null) !== event.location)
    if (cancelled || restored || moved) {
      const when = formatEventDate(updated.startAt)
      const verb = cancelled ? "cancelled" : restored ? "back on" : "updated"
      await notifyEventTeams({
        teams,
        excludeUserId: auth.userId,
        title: `Event ${verb}: ${updated.title}`,
        message: cancelled
          ? `${updated.title} (${when}) was cancelled.`
          : `${when}${updated.location ? ` at ${updated.location}` : ""}`,
        emailSubject: `Event ${verb} — ${updated.title}`,
        emailHtml: (calendarLink) =>
          cancelled
            ? `<p><strong>${updated.title}</strong> (${when}) was <strong>cancelled</strong>.</p><p>Team calendar: <a href="${calendarLink}">view schedule</a></p>`
            : `<p><strong>${updated.title}</strong> is ${verb}:</p><p><strong>${when}</strong>${updated.location ? ` at ${updated.location}` : ""}</p><p>Team calendar: <a href="${calendarLink}">view schedule</a></p>`,
        referenceId: updated.id,
      })
    }

    return NextResponse.json({ event: serializeEvent(updated) })
  } catch (error) {
    console.error("Team event update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE /api/team-events/[id] — remove outright (cascade unlinks teams) */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await loadAndAuthorize(params.id)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    await (prisma as any).teamEvent.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Team event delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
