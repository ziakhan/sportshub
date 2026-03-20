import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

const staffEntrySchema = z.object({
  type: z.enum(["assign", "invite"]),
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  role: z.enum(["Staff", "TeamManager"]),
  designation: z.enum(["HeadCoach", "AssistantCoach"]).nullable().optional(),
}).refine(
  (data) => (data.type === "assign" && data.userId) || (data.type === "invite" && data.email),
  { message: "assign requires userId, invite requires email" }
)

const createTeamSchema = z.object({
  name: z.string().min(3).max(100),
  ageGroup: z.string(),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  season: z.string().optional(),
  description: z.string().optional(),
  tenantId: z.string().uuid(),
  staff: z.array(staffEntrySchema).optional(),
})

/**
 * Create a new team
 * POST /api/teams
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const body = await request.json()
    const validatedData = createTeamSchema.parse(body)

    // Verify user has ClubOwner, ClubManager, or PlatformAdmin role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          where: {
            OR: [
              { tenantId: validatedData.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
              { role: "PlatformAdmin" },
            ],
          },
        },
      },
    })

    if (!user || user.roles.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const staffEntries = validatedData.staff || []

    // Validate: at most 1 HeadCoach
    const headCoaches = staffEntries.filter((s) => s.designation === "HeadCoach")
    if (headCoaches.length > 1) {
      return NextResponse.json(
        { error: "A team can have at most one Head Coach" },
        { status: 400 }
      )
    }

    // Run team creation + staff assignments in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create the team
      const team = await tx.team.create({
        data: {
          name: validatedData.name,
          ageGroup: validatedData.ageGroup,
          gender: validatedData.gender,
          season: validatedData.season,
          description: validatedData.description,
          tenantId: validatedData.tenantId,
        },
      })

      // 2. Process staff entries
      for (const entry of staffEntries) {
        if (entry.type === "assign" && entry.userId) {
          // Verify user has a tenant-level role for this club
          const existingRole = await tx.userRole.findFirst({
            where: {
              userId: entry.userId,
              tenantId: validatedData.tenantId,
              role: entry.role,
            },
          })

          if (!existingRole) {
            throw new Error(
              `User ${entry.userId} does not have ${entry.role} role for this club`
            )
          }

          // Create team-scoped role
          await tx.userRole.create({
            data: {
              userId: entry.userId,
              role: entry.role,
              tenantId: validatedData.tenantId,
              teamId: team.id,
              designation: entry.designation || null,
            },
          })
        } else if (entry.type === "invite" && entry.email) {
          // Look up user by email
          const invitedUser = await tx.user.findUnique({
            where: { email: entry.email },
            select: { id: true },
          })

          // Create staff invitation
          const invitation = await tx.staffInvitation.create({
            data: {
              tenantId: validatedData.tenantId,
              invitedById: userId,
              invitedUserId: invitedUser?.id || null,
              invitedEmail: entry.email,
              role: entry.role,
              teamId: team.id,
              designation: entry.designation || null,
              type: "INVITE",
            },
          })

          // Send notification if user exists
          if (invitedUser) {
            const tenant = await tx.tenant.findUnique({
              where: { id: validatedData.tenantId },
              select: { name: true },
            })
            const roleLabel = entry.designation === "HeadCoach"
              ? "Head Coach"
              : entry.designation === "AssistantCoach"
              ? "Assistant Coach"
              : entry.role === "TeamManager"
              ? "Team Manager"
              : entry.role

            await tx.notification.create({
              data: {
                userId: invitedUser.id,
                type: "staff_invite",
                title: "Team Staff Invitation",
                message: `${tenant?.name || "A club"} has invited you to join team "${team.name}" as ${roleLabel}.`,
                link: `/notifications`,
                referenceId: invitation.id,
                referenceType: "StaffInvitation",
              },
            })
          }
        }
      }

      return team
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Team creation error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes("does not have")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Get teams for a tenant
 * GET /api/teams?tenantId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const searchParams = request.nextUrl.searchParams
    const tenantId = searchParams.get("tenantId")

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId parameter is required" },
        { status: 400 }
      )
    }

    // Verify user has access to this tenant (or is PlatformAdmin)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          where: {
            OR: [
              { tenantId },
              { role: "PlatformAdmin" },
            ],
          },
        },
      },
    })

    if (!user || user.roles.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const teams = await prisma.team.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: {
            players: true,
            homeGames: true,
            awayGames: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ teams })
  } catch (error) {
    console.error("Get teams error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
