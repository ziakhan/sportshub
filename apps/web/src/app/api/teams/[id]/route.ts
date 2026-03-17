import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
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

const updateTeamSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  ageGroup: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "COED"]).nullable().optional(),
  season: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  staffToAdd: z.array(staffEntrySchema).optional(),
  staffToRemove: z.array(z.string().uuid()).optional(), // UserRole IDs to remove
})

/**
 * Get single team
 * GET /api/teams/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        staff: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        tryouts: {
          select: {
            id: true,
            title: true,
            scheduledAt: true,
            isPublished: true,
            ageGroup: true,
          },
          orderBy: { scheduledAt: "desc" },
        },
        _count: {
          select: {
            players: true,
            homeGames: true,
            awayGames: true,
          },
        },
      },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Verify user has access to this tenant
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: session.user.id,
        tenantId: team.tenantId,
      },
    })

    if (!userRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(team)
  } catch (error) {
    console.error("Get team error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Update team (details + staff changes)
 * PATCH /api/teams/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      select: { id: true, tenantId: true, name: true },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Verify ClubOwner or ClubManager
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: session.user.id,
        tenantId: team.tenantId,
        role: { in: ["ClubOwner", "ClubManager"] },
      },
    })

    if (!userRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateTeamSchema.parse(body)

    const { staffToAdd, staffToRemove, ...teamData } = validatedData

    // Run everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update team details (if any fields provided)
      const hasTeamData = Object.keys(teamData).length > 0
      if (hasTeamData) {
        await tx.team.update({
          where: { id: params.id },
          data: teamData,
        })
      }

      // 2. Remove staff
      if (staffToRemove && staffToRemove.length > 0) {
        // Verify each role belongs to this team
        await tx.userRole.deleteMany({
          where: {
            id: { in: staffToRemove },
            teamId: params.id,
          },
        })
      }

      // 3. Add staff
      if (staffToAdd && staffToAdd.length > 0) {
        // Count existing head coaches + new ones to validate limit
        const existingHeadCoaches = await tx.userRole.count({
          where: {
            teamId: params.id,
            designation: "HeadCoach",
            id: { notIn: staffToRemove || [] },
          },
        })
        const newHeadCoaches = staffToAdd.filter((s) => s.designation === "HeadCoach").length
        if (existingHeadCoaches + newHeadCoaches > 1) {
          throw new Error("A team can have at most one Head Coach")
        }

        for (const entry of staffToAdd) {
          if (entry.type === "assign" && entry.userId) {
            // Verify user has a tenant-level role for this club
            const existingRole = await tx.userRole.findFirst({
              where: {
                userId: entry.userId,
                tenantId: team.tenantId,
                role: entry.role,
              },
            })

            if (!existingRole) {
              throw new Error(
                `User ${entry.userId} does not have ${entry.role} role for this club`
              )
            }

            // Check if already assigned to this team with same role
            const alreadyAssigned = await tx.userRole.findFirst({
              where: {
                userId: entry.userId,
                teamId: params.id,
                role: entry.role,
              },
            })

            if (!alreadyAssigned) {
              await tx.userRole.create({
                data: {
                  userId: entry.userId,
                  role: entry.role,
                  tenantId: team.tenantId,
                  teamId: params.id,
                  designation: entry.designation || null,
                },
              })
            }
          } else if (entry.type === "invite" && entry.email) {
            const invitedUser = await tx.user.findUnique({
              where: { email: entry.email },
              select: { id: true },
            })

            const invitation = await tx.staffInvitation.create({
              data: {
                tenantId: team.tenantId,
                invitedById: userId,
                invitedUserId: invitedUser?.id || null,
                invitedEmail: entry.email,
                role: entry.role,
                teamId: params.id,
                designation: entry.designation || null,
                type: "INVITE",
              },
            })

            if (invitedUser) {
              const tenant = await tx.tenant.findUnique({
                where: { id: team.tenantId },
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
      }

      // Return updated team
      return tx.team.findUnique({
        where: { id: params.id },
        include: {
          staff: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      })
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Update team error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message.includes("does not have") || error.message.includes("at most one")) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
