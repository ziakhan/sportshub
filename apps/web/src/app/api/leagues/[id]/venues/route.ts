import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const league = await prisma.league.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    })
    if (!league || league.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const data = addVenueSchema.parse(body)

    let venueId = data.venueId

    // Create new venue if not linking existing
    if (!venueId && data.name && data.address && data.city) {
      // Check for duplicate
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

    const leagueVenue = await (prisma as any).leagueVenue.create({
      data: {
        leagueId: params.id,
        venueId,
        isPrimary: data.isPrimary,
      },
    })

    return NextResponse.json({ success: true, id: leagueVenue.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Add venue error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const venues = await (prisma as any).leagueVenue.findMany({
      where: { leagueId: params.id },
      include: {
        venue: { select: { id: true, name: true, address: true, city: true, state: true, capacity: true } },
      },
    })
    return NextResponse.json({ venues })
  } catch (error) {
    console.error("Get venues error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
