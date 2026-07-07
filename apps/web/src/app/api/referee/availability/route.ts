import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/** Referee self-service availability: "I can work these days/hours". */

async function requireReferee(userId: string) {
  const role = await prisma.userRole.findFirst({
    where: { userId, role: "Referee" },
    select: { id: true },
  })
  return !!role
}

export async function GET() {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await requireReferee(auth.userId))) {
      return NextResponse.json({ error: "Referees only" }, { status: 403 })
    }
    const slots = await prisma.refereeAvailability.findMany({
      where: { userId: auth.userId, date: { gte: new Date(Date.now() - 86400_000) } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: { id: true, date: true, startTime: true, endTime: true, note: true },
    })
    return NextResponse.json({ slots })
  } catch (error) {
    console.error("Availability list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().trim().max(200).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await requireReferee(auth.userId))) {
      return NextResponse.json({ error: "Referees only" }, { status: 403 })
    }
    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "date, startTime and endTime are required" }, { status: 400 })
    }
    if (parsed.data.endTime <= parsed.data.startTime) {
      return NextResponse.json({ error: "End must be after start" }, { status: 400 })
    }
    const slot = await prisma.refereeAvailability.create({
      data: {
        userId: auth.userId,
        date: new Date(`${parsed.data.date}T00:00:00.000Z`),
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    })
    return NextResponse.json({ success: true, id: slot.id }, { status: 201 })
  } catch (error) {
    console.error("Availability create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const id = new URL(request.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    const removed = await prisma.refereeAvailability.deleteMany({
      where: { id, userId: auth.userId },
    })
    if (removed.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Availability delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
