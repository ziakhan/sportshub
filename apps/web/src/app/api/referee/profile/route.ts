import { getSessionUserId } from "@/lib/auth-helpers"
import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

const updateRefereeSchema = z.object({
  certificationLevel: z.enum(["Level 1", "Level 2", "Level 3"]).optional(),
  standardFee: z.number().min(0).optional(),
  availableRegions: z.array(z.string()).optional(),
})

const createRefereeSchema = z.object({
  certificationLevel: z.enum(["Level 1", "Level 2", "Level 3"]),
  standardFee: z.number().min(0),
  availableRegions: z.array(z.string()).min(1),
})

/**
 * POST /api/referee/profile — "Become a referee".
 * Any authenticated user can opt in: this creates their RefereeProfile and
 * grants the Referee role as a side-effect. Idempotent-ish — returns 409 if
 * they already have a profile (they should PATCH instead).
 */
export async function POST(req: Request) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const data = createRefereeSchema.parse(await req.json())

    const existing = await prisma.refereeProfile.findUnique({
      where: { userId },
      select: { userId: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: "You're already a referee.", code: "ALREADY_REFEREE" },
        { status: 409 }
      )
    }

    const profile = await prisma.$transaction(async (tx) => {
      const p = await tx.refereeProfile.create({
        data: {
          userId,
          certificationLevel: data.certificationLevel,
          standardFee: data.standardFee,
          availableRegions: data.availableRegions.map((r) => r.trim()).filter(Boolean),
        },
        select: {
          certificationLevel: true,
          standardFee: true,
          availableRegions: true,
        },
      })
      const hasRole = await tx.userRole.findFirst({
        where: { userId, role: "Referee" },
        select: { id: true },
      })
      if (!hasRole) {
        await tx.userRole.create({ data: { userId, role: "Referee" } })
      }
      return p
    })

    return NextResponse.json(profile, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    console.error("Become referee error:", error)
    return NextResponse.json({ error: "Failed to create referee profile" }, { status: 500 })
  }
}

export async function GET() {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = sessionInfo.userId

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const profile = await prisma.refereeProfile.findUnique({
    where: { userId: user.id },
    select: {
      certificationLevel: true,
      standardFee: true,
      availableRegions: true,
      gamesRefereed: true,
      averageRating: true,
    },
  })

  if (!profile) {
    return NextResponse.json({ error: "Referee profile not found" }, { status: 404 })
  }

  return NextResponse.json(profile)
}

export async function PATCH(req: Request) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const body = await req.json()
    const data = updateRefereeSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const profile = await prisma.refereeProfile.update({
      where: { userId: user.id },
      data,
      select: {
        certificationLevel: true,
        standardFee: true,
        availableRegions: true,
      },
    })

    return NextResponse.json(profile)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Referee profile update error:", error)
    return NextResponse.json(
      { error: "Failed to update referee profile" },
      { status: 500 }
    )
  }
}
