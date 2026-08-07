import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

const patchSchema = z
  .object({
    ordinal: z.number().int().min(1).max(50).optional(),
    label: z.string().trim().max(60).nullable().optional(),
    monthAnchor: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .nullable()
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" })

async function authorize(seasonId: string, roundId: string) {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { league: { select: { ownerId: true } } },
  })
  if (!season || (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  const round = await (prisma as any).sessionRound.findFirst({
    where: { id: roundId, seasonId },
    select: { id: true },
  })
  if (!round) return { error: NextResponse.json({ error: "Round not found" }, { status: 404 }) }
  return {}
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; roundId: string } }
) {
  try {
    const auth = await authorize(params.id, params.roundId)
    if (auth.error) return auth.error
    const data = patchSchema.parse(await request.json().catch(() => null))
    const round = await (prisma as any).sessionRound.update({
      where: { id: params.roundId },
      data: {
        ...(data.ordinal !== undefined ? { ordinal: data.ordinal } : {}),
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.monthAnchor !== undefined ? { monthAnchor: data.monthAnchor } : {}),
      },
    })
    return NextResponse.json({ round })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "That round number is taken." }, { status: 409 })
    }
    console.error("Update round error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** Deleting a round never deletes a weekend: sessions fall back to
 *  round-less (SetNull), which is the exact pre-rounds behavior. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; roundId: string } }
) {
  try {
    const auth = await authorize(params.id, params.roundId)
    if (auth.error) return auth.error
    await (prisma as any).sessionRound.delete({ where: { id: params.roundId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete round error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
