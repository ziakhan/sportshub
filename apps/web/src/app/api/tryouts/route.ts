import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { isClubAdmin } from "@/lib/authz/team-scope"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createTryoutSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().optional(),
  ageGroup: z.string(),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  location: z.string().min(3),
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

    // Owner ruling 2026-07-20: tryout creation is CLUB-ADMIN ONLY. Fees +
    // registration payments hang off a tryout, so it's owner/manager work,
    // not a coach action (superseding the 2026-07-07 coach-can-post call).
    if (!(await isClubAdmin(userId, validatedData.tenantId))) {
      return NextResponse.json(
        { error: "Only club owners or managers can create tryouts" },
        { status: 403 }
      )
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
      // Tenant-specific tryouts (includes drafts) — club staff only
      const sessionInfo = await getSessionUserId()
      if (!sessionInfo) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const hasAccess = await prisma.userRole.findFirst({
        where: {
          userId: sessionInfo.userId,
          OR: [
            { tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff", "TeamManager"] } },
            { role: "PlatformAdmin" },
          ],
        },
        select: { id: true },
      })
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const tryouts = await prisma.tryout.findMany({
        where: { tenantId },
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
