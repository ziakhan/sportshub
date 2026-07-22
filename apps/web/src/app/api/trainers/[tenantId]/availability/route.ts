import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { isClubAdmin } from "@/lib/authz/team-scope"

export const dynamic = "force-dynamic"

const createSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    note: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.endTime > d.startTime, { message: "End must be after start" })

/**
 * Trainer availability windows (mirrors referee availability, scoped to the
 * trainer tenant). Bookable 1-on-1 slots are generated inside these windows.
 */
export async function GET(_request: NextRequest, { params }: { params: { tenantId: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await isClubAdmin(auth.userId, params.tenantId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const yesterday = new Date(Date.now() - 86_400_000)
    const windows = await (prisma as any).trainerAvailability.findMany({
      where: { tenantId: params.tenantId, date: { gte: yesterday } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    })
    return NextResponse.json({ windows })
  } catch (error) {
    console.error("Trainer availability list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { tenantId: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await isClubAdmin(auth.userId, params.tenantId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const data = createSchema.parse(body)

    const window = await (prisma as any).trainerAvailability.create({
      data: {
        tenantId: params.tenantId,
        date: new Date(`${data.date}T00:00:00.000Z`),
        startTime: data.startTime,
        endTime: data.endTime,
        note: data.note || null,
      },
    })
    return NextResponse.json({ success: true, window }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Validation error" },
        { status: 400 }
      )
    }
    console.error("Trainer availability create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { tenantId: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await isClubAdmin(auth.userId, params.tenantId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const id = request.nextUrl.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    // Scope to this tenant (IDOR guard)
    const target = await (prisma as any).trainerAvailability.findFirst({
      where: { id, tenantId: params.tenantId },
      select: { id: true },
    })
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await (prisma as any).trainerAvailability.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Trainer availability delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
