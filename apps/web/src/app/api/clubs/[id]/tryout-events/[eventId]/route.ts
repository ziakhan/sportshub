import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { isClubAdmin, isClubStaff } from "@/lib/authz/team-scope"
import {
  MANAGEMENT_SESSION_SELECT,
  sessionInputSchema,
  sessionRowData,
  sessionTitle,
  shapeManagementSession,
  TryoutEventError,
} from "@/lib/tryouts/events"

export const dynamic = "force-dynamic"

const patchSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  seasonLabel: z.string().trim().min(1).max(60).optional(),
  /** Flips the event AND every session: one shelf, one switch. */
  isPublished: z.boolean().optional(),
  /** Opt in to showing the crowd publicly; off means the count is not shown. */
  showSignupCount: z.boolean().optional(),
  /** Sessions to add (no id) or update (id). Omitted sessions are untouched. */
  sessions: z.array(sessionInputSchema).max(50).optional(),
  removeSessionIds: z.array(z.string().uuid()).max(50).optional(),
})

async function loadEvent(tenantId: string, eventId: string) {
  return (prisma as any).tryoutEvent.findFirst({
    where: { id: eventId, tenantId },
    select: {
      id: true,
      tenantId: true,
      title: true,
      description: true,
      seasonLabel: true,
      isPublished: true,
      showSignupCount: true,
      createdAt: true,
    },
  })
}

/**
 * GET /api/clubs/[id]/tryout-events/[eventId] — event detail with each
 * session's signup summary. Staff only; drafts included.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string; eventId: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await isClubStaff(auth.userId, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const event = await loadEvent(params.id, params.eventId)
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const sessions = await prisma.tryout.findMany({
      where: { eventId: params.eventId },
      select: MANAGEMENT_SESSION_SELECT,
      orderBy: [{ scheduledAt: "asc" }, { ageGroup: "asc" }],
    })

    // Per-session summary: how many are coming, how many turned up, how many
    // are already in the pool. Names stay on the signups endpoint.
    const byStatus = await prisma.tryoutSignup.groupBy({
      by: ["tryoutId", "status"],
      where: { tryout: { eventId: params.eventId } },
      _count: { _all: true },
    })
    const checkedIn = await prisma.tryoutSignup.groupBy({
      by: ["tryoutId"],
      where: { tryout: { eventId: params.eventId }, checkedInAt: { not: null } },
      _count: { _all: true },
    })
    const pooled = await (prisma as any).tryoutPoolMember.findMany({
      where: { tenantId: params.id, signup: { tryout: { eventId: params.eventId } } },
      select: { signup: { select: { tryoutId: true } } },
    })

    const statusBySession = new Map<string, Record<string, number>>()
    for (const row of byStatus) {
      const entry = statusBySession.get(row.tryoutId) ?? {}
      entry[row.status] = row._count._all
      statusBySession.set(row.tryoutId, entry)
    }
    const checkedInBySession = new Map(checkedIn.map((r: any) => [r.tryoutId, r._count._all]))
    const pooledBySession = new Map<string, number>()
    for (const row of pooled) {
      const tryoutId = row.signup?.tryoutId
      if (!tryoutId) continue
      pooledBySession.set(tryoutId, (pooledBySession.get(tryoutId) ?? 0) + 1)
    }

    return NextResponse.json({
      event: {
        ...event,
        ageGroups: [...new Set(sessions.map((s: any) => s.ageGroup))],
        startsAt: sessions[0]?.scheduledAt ?? null,
      },
      sessions: sessions.map((session: any) => ({
        ...shapeManagementSession(session),
        signups: {
          active: session._count?.signups ?? 0,
          byStatus: statusBySession.get(session.id) ?? {},
          checkedIn: checkedInBySession.get(session.id) ?? 0,
          inPool: pooledBySession.get(session.id) ?? 0,
        },
      })),
    })
  } catch (error) {
    console.error("Get tryout event error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/clubs/[id]/tryout-events/[eventId] — edit the event, add/update/
 * remove sessions, publish or unpublish. Access: ClubOwner / ClubManager.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string; eventId: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await isClubAdmin(auth.userId, params.id))) {
      return NextResponse.json(
        { error: "Only club owners and managers can edit tryout events" },
        { status: 403 }
      )
    }

    const event = await loadEvent(params.id, params.eventId)
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    const data = patchSchema.parse(await request.json())

    // Removals are checked before anything is written: a session families have
    // registered for is not something to delete out from under them.
    if (data.removeSessionIds?.length) {
      const doomed = await prisma.tryout.findMany({
        where: { id: { in: data.removeSessionIds }, eventId: params.eventId },
        select: {
          id: true,
          title: true,
          ageGroup: true,
          _count: { select: { signups: { where: { status: { not: "CANCELLED" } } } } },
        },
      })
      const missing = data.removeSessionIds.filter((id) => !doomed.some((d: any) => d.id === id))
      if (missing.length > 0) {
        return NextResponse.json(
          { error: "Some sessions do not belong to this event", code: "SESSION_NOT_IN_EVENT" },
          { status: 404 }
        )
      }
      const registered = doomed.filter((d: any) => d._count.signups > 0)
      if (registered.length > 0) {
        const names = registered.map((d: any) => d.ageGroup).join(", ")
        return NextResponse.json(
          {
            error: `Families are already registered for ${names}. Cancel the session from the tryout page so everyone is told, then remove it.`,
            code: "SESSION_HAS_SIGNUPS",
            sessions: registered.map((d: any) => ({
              id: d.id,
              ageGroup: d.ageGroup,
              signups: d._count.signups,
            })),
          },
          { status: 409 }
        )
      }
    }

    const nextTitle = data.title ?? event.title
    const nextPublished = data.isPublished ?? event.isPublished

    // Session rows are built outside the transaction: resolving a venue name
    // is a read, and a bad input should fail before anything is written.
    const updates: Array<{ id: string; data: Record<string, unknown> }> = []
    const creates: Record<string, unknown>[] = []
    if (data.sessions?.length) {
      const existingIds = new Set(
        (
          await prisma.tryout.findMany({
            where: { eventId: params.eventId },
            select: { id: true },
          })
        ).map((s: any) => s.id)
      )
      for (const input of data.sessions) {
        if (input.id && !existingIds.has(input.id)) {
          return NextResponse.json(
            { error: "Some sessions do not belong to this event", code: "SESSION_NOT_IN_EVENT" },
            { status: 404 }
          )
        }
        const row = await sessionRowData(input, {
          id: event.id,
          tenantId: event.tenantId,
          title: nextTitle,
          isPublished: nextPublished,
        })
        if (input.id) {
          // An edit never re-shelves a session on its own; publishing does.
          const { isPublished: _ignored, isPublic: _alsoIgnored, ...editable } = row as any
          updates.push({ id: input.id, data: editable })
        } else {
          creates.push(row)
        }
      }
    }

    await prisma.$transaction(async (tx: any) => {
      const eventData: Record<string, unknown> = {}
      if (data.title !== undefined) eventData.title = data.title
      if (data.description !== undefined) eventData.description = data.description
      if (data.seasonLabel !== undefined) eventData.seasonLabel = data.seasonLabel
      if (data.isPublished !== undefined) eventData.isPublished = data.isPublished
      if (data.showSignupCount !== undefined) eventData.showSignupCount = data.showSignupCount
      if (Object.keys(eventData).length > 0) {
        await tx.tryoutEvent.update({ where: { id: params.eventId }, data: eventData })
      }

      if (data.removeSessionIds?.length) {
        await tx.tryout.deleteMany({
          where: { id: { in: data.removeSessionIds }, eventId: params.eventId },
        })
      }
      for (const update of updates) {
        await tx.tryout.update({ where: { id: update.id }, data: update.data })
      }
      if (creates.length > 0) {
        await tx.tryout.createMany({ data: creates })
      }

      // Publishing the event is what puts every session on the shelf, and
      // unpublishing takes them all off together.
      if (data.isPublished !== undefined && data.isPublished !== event.isPublished) {
        await tx.tryout.updateMany({
          where: { eventId: params.eventId },
          data: { isPublished: data.isPublished },
        })
      }

      // Session titles are derived from the event's, so a rename carries.
      if (data.title !== undefined && data.title !== event.title) {
        const rows = await tx.tryout.findMany({
          where: { eventId: params.eventId },
          select: { id: true, ageGroup: true },
        })
        for (const row of rows) {
          await tx.tryout.update({
            where: { id: row.id },
            data: { title: sessionTitle(data.title as string, row.ageGroup) },
          })
        }
      }
    })

    return NextResponse.json({
      success: true,
      added: creates.length,
      updated: updates.length,
      removed: data.removeSessionIds?.length ?? 0,
      isPublished: nextPublished,
    })
  } catch (error) {
    if (error instanceof TryoutEventError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Update tryout event error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
