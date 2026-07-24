import { getSessionUserId } from "@/lib/auth-helpers"
import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

// QA-208: same capped data-URL shape as ClubClaim.proofDocumentUrl, plus a
// PDF alternative (certifications are commonly PDFs, not just photos).
const certificationDocUrl = z
  .string()
  .regex(/^data:(image\/(webp|jpeg|png)|application\/pdf);base64,[A-Za-z0-9+/=]+$/)
  .max(2_000_000)
  .nullable()
  .optional()

const updateRefereeSchema = z.object({
  certificationLevel: z.enum(["Level 1", "Level 2", "Level 3"]).optional(),
  standardFee: z.number().min(0).optional(),
  availableRegions: z.array(z.string()).optional(),
  certificationDocUrl,
})

const createRefereeSchema = z.object({
  certificationLevel: z.enum(["Level 1", "Level 2", "Level 3"]),
  standardFee: z.number().min(0),
  availableRegions: z.array(z.string()).min(1),
  certificationDocUrl,
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
          certificationDocUrl: data.certificationDocUrl ?? null,
        },
        select: {
          certificationLevel: true,
          standardFee: true,
          availableRegions: true,
          certificationDocUrl: true,
          certificationVerifiedAt: true,
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
      certificationDocUrl: true,
      certificationVerifiedAt: true,
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

    const existing = await prisma.refereeProfile.findUnique({
      where: { userId: user.id },
      select: { certificationDocUrl: true },
    })

    const updateData: typeof data & {
      certificationVerifiedAt?: null
      certificationVerifiedById?: null
    } = { ...data }
    // A new or removed document invalidates any prior verification — it was
    // stamped against the old file, not this one.
    if (
      data.certificationDocUrl !== undefined &&
      data.certificationDocUrl !== existing?.certificationDocUrl
    ) {
      updateData.certificationVerifiedAt = null
      updateData.certificationVerifiedById = null
    }

    const profile = await prisma.refereeProfile.update({
      where: { userId: user.id },
      data: updateData,
      select: {
        certificationLevel: true,
        standardFee: true,
        availableRegions: true,
        certificationDocUrl: true,
        certificationVerifiedAt: true,
      },
    })

    return NextResponse.json(profile)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    console.error("Referee profile update error:", error)
    return NextResponse.json({ error: "Failed to update referee profile" }, { status: 500 })
  }
}
