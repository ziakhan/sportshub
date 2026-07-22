import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { isClubAdmin, canActOnTeam, coachedTeamIds } from "@/lib/authz/team-scope"
import { intraOrgConflictMessage } from "@/lib/venues/conflicts"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createTryoutSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().optional(),
  ageGroup: z.string(),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  location: z.string().min(3),
  venueId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().datetime(),
  duration: z.number().optional(),
  fee: z.number().min(0),
  maxParticipants: z.number().optional(),
  isPublic: z.boolean().default(true),
  tenantId: z.string().uuid(),
  teamId: z.string().nullable().optional(),
})

/**
 * Create tryout
 * POST /api/tryouts
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const body = await request.json()
    const validatedData = createTryoutSchema.parse(body)

    // Owner ruling 2026-07-20: a coach may create tryouts FOR THEIR OWN TEAM
    // only. Club admins create anything (any team, or a club-wide tryout with
    // no team); a coach MUST name a team they hold a team-scoped role for.
    if (!(await isClubAdmin(userId, validatedData.tenantId))) {
      if (!validatedData.teamId) {
        return NextResponse.json(
          { error: "Coaches can only create a tryout for their own team — pick the team" },
          { status: 403 }
        )
      }
      if (!(await canActOnTeam(userId, validatedData.tenantId, validatedData.teamId))) {
        return NextResponse.json(
          { error: "You can only create a tryout for your own team" },
          { status: 403 }
        )
      }
    }

    const createData: Record<string, unknown> = {
      title: validatedData.title,
      ageGroup: validatedData.ageGroup,
      location: validatedData.location,
      scheduledAt: new Date(validatedData.scheduledAt),
      fee: validatedData.fee,
      isPublic: validatedData.isPublic,
      isPublished: false,
      tenantId: validatedData.tenantId,
    }
    if (validatedData.description) createData.description = validatedData.description
    if (validatedData.gender) createData.gender = validatedData.gender
    if (validatedData.duration) createData.duration = validatedData.duration
    if (validatedData.maxParticipants) createData.maxParticipants = validatedData.maxParticipants
    if (validatedData.teamId) createData.teamId = validatedData.teamId
    if (validatedData.venueId) createData.venueId = validatedData.venueId

    // Intra-org HARD block (owner ruling): the club can't double-book its own
    // venue slot. Cross-org overlaps stay a soft advisory in the form.
    if (validatedData.venueId) {
      const conflict = await intraOrgConflictMessage({
        venueId: validatedData.venueId,
        startAt: new Date(validatedData.scheduledAt),
        durationMinutes: validatedData.duration ?? 90,
        tenantId: validatedData.tenantId,
      })
      if (conflict) return NextResponse.json({ error: conflict }, { status: 409 })
    }

    const tryout = await prisma.tryout.create({
      data: createData as any,
    })

    return NextResponse.json({ success: true, id: tryout.id, title: tryout.title }, { status: 201 })
  } catch (error) {
    console.error("Tryout creation error:", error)

    if (error instanceof z.ZodError) {
      const details = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
      return NextResponse.json({ error: "Validation error: " + details }, { status: 400 })
    }

    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Get tryouts (marketplace or tenant-specific)
 * GET /api/tryouts?marketplace=true
 * GET /api/tryouts?tenantId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const marketplace = searchParams.get("marketplace") === "true"
    const tenantId = searchParams.get("tenantId")
    const ageGroup = searchParams.get("ageGroup")

    if (marketplace) {
      // Public marketplace - show published, public tryouts
      const tryouts = await prisma.tryout.findMany({
        where: {
          isPublished: true,
          isPublic: true,
          scheduledAt: { gte: new Date() }, // Future tryouts only
        },
        include: {
          tenant: {
            include: {
              branding: true,
            },
          },
          _count: {
            select: {
              signups: true,
            },
          },
        },
        orderBy: { scheduledAt: "asc" },
      })

      return NextResponse.json({ tryouts })
    }

    if (tenantId) {
      // Tenant-specific tryouts (includes drafts). Security fix 2026-07-20:
      // scoped by role — club admins see every tryout; a coach sees ONLY
      // their own team's tryouts (was: whole club to any Staff).
      const sessionInfo = await getSessionUserId()
      if (!sessionInfo) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const admin = await isClubAdmin(sessionInfo.userId, tenantId)
      let tryoutFilter: any
      if (admin) {
        tryoutFilter = { tenantId }
      } else {
        const myTeamIds = await coachedTeamIds(sessionInfo.userId, tenantId)
        if (myTeamIds.length === 0) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
        tryoutFilter = { tenantId, teamId: { in: myTeamIds } }
      }

      const tryouts = await prisma.tryout.findMany({
        where: tryoutFilter,
        include: {
          team: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              signups: true,
            },
          },
        },
        orderBy: { scheduledAt: "desc" },
      })

      return NextResponse.json({ tryouts })
    }

    return NextResponse.json(
      { error: "Either marketplace or tenantId parameter is required" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Get tryouts error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
