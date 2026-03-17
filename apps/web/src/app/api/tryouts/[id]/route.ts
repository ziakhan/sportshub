import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

const updateTryoutSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().nullable().optional(),
  ageGroup: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "COED"]).nullable().optional(),
  location: z.string().min(3).optional(),
  scheduledAt: z.string().datetime().optional(),
  duration: z.number().nullable().optional(),
  fee: z.number().min(0).optional(),
  maxParticipants: z.number().nullable().optional(),
  isPublic: z.boolean().optional(),
  teamId: z.string().uuid().nullable().optional(),
})

/**
 * Get tryout detail
 * GET /api/tryouts/[id]
 * Public for published tryouts; includes user's signup if authenticated
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tryout = await prisma.tryout.findUnique({
      where: { id: params.id },
      include: {
        tenant: {
          include: {
            branding: true,
          },
        },
        team: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            signups: {
              where: { status: { not: "CANCELLED" } },
            },
          },
        },
      },
    })

    if (!tryout) {
      return NextResponse.json({ error: "Tryout not found" }, { status: 404 })
    }

    // Allow club staff or PlatformAdmin to see unpublished tryouts
    const session = await getServerSession(authOptions)
    if (!tryout.isPublished) {
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Tryout not found" }, { status: 404 })
      }
      const hasAccess = await prisma.userRole.findFirst({
        where: {
          userId: session.user.id,
          OR: [
            { tenantId: tryout.tenantId },
            { role: "PlatformAdmin" },
          ],
        },
      })
      if (!hasAccess) {
        return NextResponse.json({ error: "Tryout not found" }, { status: 404 })
      }
    }

    // Check if authenticated user has existing signups
    let userSignups: Array<{
      id: string
      playerName: string
      status: string
    }> = []

    if (session?.user?.id) {
      const userId = session.user.id

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      })

      if (user) {
        userSignups = await prisma.tryoutSignup.findMany({
          where: {
            tryoutId: params.id,
            userId: user.id,
            status: { not: "CANCELLED" },
          },
          select: {
            id: true,
            playerName: true,
            status: true,
          },
        })
      }
    }

    return NextResponse.json({
      ...tryout,
      signupCount: tryout._count.signups,
      userSignups,
    })
  } catch (error) {
    console.error("Get tryout error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * Update tryout
 * PATCH /api/tryouts/[id]
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

    const tryout = await prisma.tryout.findUnique({
      where: { id: params.id },
      select: { id: true, tenantId: true },
    })

    if (!tryout) {
      return NextResponse.json({ error: "Tryout not found" }, { status: 404 })
    }

    // Verify ClubOwner, ClubManager, or PlatformAdmin
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: session.user.id,
        OR: [
          { tenantId: tryout.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
          { role: "PlatformAdmin" },
        ],
      },
    })

    if (!userRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateTryoutSchema.parse(body)

    const data: Record<string, unknown> = { ...validatedData }
    if (validatedData.scheduledAt) {
      data.scheduledAt = new Date(validatedData.scheduledAt)
    }

    const updated = await prisma.tryout.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Update tryout error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
