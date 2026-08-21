import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { isClubAdmin, isClubStaff } from "@/lib/authz/team-scope"
import { listPublishedTryoutEvents } from "@/lib/queries/tryout-events"
import {
  MANAGEMENT_SESSION_SELECT,
  sessionInputSchema,
  sessionRowData,
  shapeManagementSession,
  TryoutEventError,
} from "@/lib/tryouts/events"

export const dynamic = "force-dynamic"

const createEventSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional(),
  seasonLabel: z.string().trim().min(1).max(60),
  publish: z.boolean().optional(),
  /** Opt in to showing the crowd publicly; off means the count is not shown. */
  showSignupCount: z.boolean().optional(),
  sessions: z.array(sessionInputSchema).min(1).max(50),
})

/**
 * GET /api/clubs/[id]/tryout-events
 *   ?view=public — the published event list, served from the shared query
 *   module so the club page, the native app and this endpoint cannot drift.
 *   Otherwise: the club console list, drafts included, staff only.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (request.nextUrl.searchParams.get("view") === "public") {
      return NextResponse.json({ events: await listPublishedTryoutEvents(params.id) })
    }

    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await isClubStaff(auth.userId, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const events = await (prisma as any).tryoutEvent.findMany({
      where: { tenantId: params.id },
      select: {
        id: true,
        title: true,
        description: true,
        seasonLabel: true,
        isPublished: true,
        showSignupCount: true,
        createdAt: true,
        sessions: {
          select: MANAGEMENT_SESSION_SELECT,
          orderBy: [{ scheduledAt: "asc" }, { ageGroup: "asc" }],
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      events: events.map((event: any) => {
        const sessions = event.sessions.map(shapeManagementSession)
        return {
          id: event.id,
          title: event.title,
          description: event.description,
          seasonLabel: event.seasonLabel,
          isPublished: event.isPublished,
          showSignupCount: event.showSignupCount,
          createdAt: event.createdAt,
          sessionCount: sessions.length,
          signupCount: sessions.reduce((sum: number, s: any) => sum + s.signupCount, 0),
          ageGroups: [...new Set(sessions.map((s: any) => s.ageGroup))],
          startsAt: sessions[0]?.scheduledAt ?? null,
        }
      }),
    })
  } catch (error) {
    console.error("List tryout events error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/clubs/[id]/tryout-events — create the event and its sessions.
 * Access: ClubOwner / ClubManager. Team count is decided late, so this runs
 * long before any team exists.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await isClubAdmin(auth.userId, params.id))) {
      return NextResponse.json(
        { error: "Only club owners and managers can create tryout events" },
        { status: 403 }
      )
    }

    const data = createEventSchema.parse(await request.json())

    const event = await (prisma as any).tryoutEvent.create({
      data: {
        tenantId: params.id,
        title: data.title,
        description: data.description ?? null,
        seasonLabel: data.seasonLabel,
        isPublished: data.publish === true,
        showSignupCount: data.showSignupCount === true,
      },
      select: { id: true, tenantId: true, title: true, isPublished: true },
    })

    const rows = []
    for (const input of data.sessions) {
      rows.push(await sessionRowData(input, event))
    }
    await prisma.tryout.createMany({ data: rows as any })

    return NextResponse.json(
      { success: true, id: event.id, title: event.title, sessions: rows.length },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof TryoutEventError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Create tryout event error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
