import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * SESSION ROUNDS (owner 2026-08-07): the month-anchored rounds a league
 * ANNOUNCES — "Session 1 · October", "the January session" — whose concrete
 * weekends are the per-grade materialization (SeasonSession.roundId).
 * Optional structure: a season with no rounds behaves exactly as before.
 */

const createSchema = z.object({
  /** Omitted = next free ordinal. */
  ordinal: z.number().int().min(1).max(50).optional(),
  label: z.string().trim().max(60).nullable().optional(),
  /** "2026-10" — the month the league anchors this round to. */
  monthAnchor: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .optional(),
})

async function authorize(seasonId: string) {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { status: true, league: { select: { ownerId: true } } },
  })
  if (!season || (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { season }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rounds = await (prisma as any).sessionRound.findMany({
      where: { seasonId: params.id },
      orderBy: { ordinal: "asc" },
      include: { sessions: { select: { id: true, label: true, phase: true } } },
    })
    return NextResponse.json({ rounds })
  } catch (error) {
    console.error("List rounds error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await authorize(params.id)
    if (auth.error) return auth.error

    const data = createSchema.parse(await request.json().catch(() => ({})))
    const ordinal =
      data.ordinal ??
      (((
        await (prisma as any).sessionRound.aggregate({
          where: { seasonId: params.id },
          _max: { ordinal: true },
        })
      )._max.ordinal ?? 0) +
        1)

    const round = await (prisma as any).sessionRound.create({
      data: {
        seasonId: params.id,
        ordinal,
        label: data.label ?? null,
        monthAnchor: data.monthAnchor ?? null,
      },
    })
    return NextResponse.json({ round }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "That round number is taken." }, { status: 409 })
    }
    console.error("Create round error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
