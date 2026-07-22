import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { isClubAdmin } from "@/lib/authz/team-scope"

export const dynamic = "force-dynamic"

const putSchema = z.object({
  bio: z.string().trim().max(2000).nullable().optional(),
  oneOnOneEnabled: z.boolean().optional(),
  oneOnOneFee: z.number().min(0).nullable().optional(),
  slotMinutes: z.number().int().min(15).max(240).optional(),
})

/** GET /api/trainers/[tenantId]/profile — operator reads their 1-on-1 setup */
export async function GET(_request: NextRequest, { params }: { params: { tenantId: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await isClubAdmin(auth.userId, params.tenantId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const profile = await (prisma as any).trainerProfile.findUnique({
      where: { tenantId: params.tenantId },
    })
    return NextResponse.json({
      profile: profile
        ? { ...profile, oneOnOneFee: profile.oneOnOneFee != null ? Number(profile.oneOnOneFee) : null }
        : null,
    })
  } catch (error) {
    console.error("Trainer profile get error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** PUT /api/trainers/[tenantId]/profile — upsert 1-on-1 settings */
export async function PUT(request: NextRequest, { params }: { params: { tenantId: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await isClubAdmin(auth.userId, params.tenantId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const data = putSchema.parse(body)

    // Enabling 1-on-1 requires a fee to be set (0 = free is allowed but must
    // be explicit).
    if (data.oneOnOneEnabled === true && data.oneOnOneFee == null) {
      const existing = await (prisma as any).trainerProfile.findUnique({
        where: { tenantId: params.tenantId },
        select: { oneOnOneFee: true },
      })
      if (existing?.oneOnOneFee == null) {
        return NextResponse.json(
          { error: "Set a session fee before enabling 1-on-1 booking" },
          { status: 400 }
        )
      }
    }

    const profile = await (prisma as any).trainerProfile.upsert({
      where: { tenantId: params.tenantId },
      create: {
        tenantId: params.tenantId,
        bio: data.bio ?? null,
        oneOnOneEnabled: data.oneOnOneEnabled ?? false,
        oneOnOneFee: data.oneOnOneFee ?? null,
        slotMinutes: data.slotMinutes ?? 60,
      },
      update: {
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.oneOnOneEnabled !== undefined ? { oneOnOneEnabled: data.oneOnOneEnabled } : {}),
        ...(data.oneOnOneFee !== undefined ? { oneOnOneFee: data.oneOnOneFee } : {}),
        ...(data.slotMinutes !== undefined ? { slotMinutes: data.slotMinutes } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        oneOnOneFee: profile.oneOnOneFee != null ? Number(profile.oneOnOneFee) : null,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Validation error" },
        { status: 400 }
      )
    }
    console.error("Trainer profile update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
