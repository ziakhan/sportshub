import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createCourtSchema = z.object({
  name: z.string().min(1).max(50),
  displayOrder: z.number().int().optional(),
})

/**
 * GET /api/venues/[id]/courts — List courts at a venue
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const courts = await (prisma as any).court.findMany({
      where: { venueId: params.id },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    })
    return NextResponse.json({ courts })
  } catch (error) {
    console.error("List courts error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/venues/[id]/courts — Add a court to a venue
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const data = createCourtSchema.parse(body)

    const existingCount = await (prisma as any).court.count({ where: { venueId: params.id } })

    const court = await (prisma as any).court.create({
      data: {
        venueId: params.id,
        name: data.name,
        displayOrder: data.displayOrder ?? existingCount,
      },
    })

    return NextResponse.json({ success: true, id: court.id, court }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Create court error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
