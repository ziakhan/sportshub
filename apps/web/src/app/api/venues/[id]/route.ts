import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

/**
 * GET /api/venues/[id] — Venue detail + courts + venueHours
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const venue = await (prisma as any).venue.findUnique({
      where: { id: params.id },
      include: {
        courtList: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] },
        venueHours: { orderBy: { dayOfWeek: "asc" } },
      },
    })
    if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(venue)
  } catch (error) {
    console.error("Get venue error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const updateVenueSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  address: z.string().min(3).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  zipCode: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  capacity: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
})

/**
 * PATCH /api/venues/[id] — Update venue metadata
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const data = updateVenueSchema.parse(body)

    const updated = await (prisma as any).venue.update({
      where: { id: params.id },
      data,
    })
    return NextResponse.json({ success: true, ...updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Update venue error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
