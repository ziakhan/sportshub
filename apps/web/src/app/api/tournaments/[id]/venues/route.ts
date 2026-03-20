import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const addVenueSchema = z.object({
  venueId: z.string().optional(), // Existing venue
  // Or create new venue
  name: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  capacity: z.number().optional(),
  isPrimary: z.boolean().default(false),
})

/**
 * POST /api/tournaments/[id]/venues — Add a venue to the tournament
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tournament = await (prisma as any).tournament.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!tournament || (tournament.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const data = addVenueSchema.parse(body)

    let venueId = data.venueId

    // Create new venue if not linking existing
    if (!venueId && data.name && data.address && data.city) {
      // Check for duplicate by name + city
      const existing = await prisma.venue.findFirst({
        where: {
          name: { equals: data.name, mode: "insensitive" },
          city: { equals: data.city, mode: "insensitive" },
        } as any,
      })

      if (existing) {
        venueId = existing.id
      } else {
        const venue = await prisma.venue.create({
          data: {
            name: data.name,
            address: data.address,
            city: data.city,
            state: data.state || "ON",
            zipCode: data.zipCode || null,
            capacity: data.capacity || null,
          } as any,
        })
        venueId = venue.id
      }
    }

    if (!venueId) {
      return NextResponse.json({ error: "Provide venueId or venue details" }, { status: 400 })
    }

    const tournamentVenue = await (prisma as any).tournamentVenue.create({
      data: {
        tournamentId: params.id,
        venueId,
        isPrimary: data.isPrimary,
      },
    })

    return NextResponse.json({ success: true, id: tournamentVenue.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Add tournament venue error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET /api/tournaments/[id]/venues — List tournament venues
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const venues = await (prisma as any).tournamentVenue.findMany({
      where: { tournamentId: params.id },
      include: {
        venue: { select: { id: true, name: true, address: true, city: true, state: true, capacity: true } },
      },
    })
    return NextResponse.json({ venues })
  } catch (error) {
    console.error("Get tournament venues error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/tournaments/[id]/venues?tournamentVenueId=xxx — Remove a venue
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tournament = await (prisma as any).tournament.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!tournament || (tournament.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tournamentVenueId = request.nextUrl.searchParams.get("tournamentVenueId")
    if (!tournamentVenueId) {
      return NextResponse.json({ error: "tournamentVenueId required" }, { status: 400 })
    }

    await (prisma as any).tournamentVenue.delete({ where: { id: tournamentVenueId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete tournament venue error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
