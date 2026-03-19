import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createVenueSchema = z.object({
  name: z.string().min(2).max(200),
  address: z.string().min(3),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().optional(),
  country: z.string().length(2).default("CA"),
  phoneNumber: z.string().optional(),
  placeId: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  capacity: z.number().optional(),
  notes: z.string().optional(),
})

/**
 * POST /api/venues — Create a venue (auth required)
 * Deduplicates by Google placeId if provided
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createVenueSchema.parse(body)

    // Check for duplicate by placeId
    if (data.placeId) {
      const existing = await prisma.venue.findUnique({
        where: { placeId: data.placeId } as any,
      })
      if (existing) {
        return NextResponse.json({
          success: true,
          id: existing.id,
          name: existing.name,
          existing: true,
        })
      }
    }

    // Check for duplicate by name + city
    const nameMatch = await prisma.venue.findFirst({
      where: {
        name: { equals: data.name, mode: "insensitive" },
        city: { equals: data.city, mode: "insensitive" },
      } as any,
    })
    if (nameMatch) {
      return NextResponse.json({
        success: true,
        id: nameMatch.id,
        name: nameMatch.name,
        existing: true,
      })
    }

    const venue = await prisma.venue.create({
      data: {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode || null,
        country: data.country,
        phoneNumber: data.phoneNumber || null,
        placeId: data.placeId || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        capacity: data.capacity || null,
        notes: data.notes || null,
      } as any,
    })

    return NextResponse.json({ success: true, id: venue.id, name: venue.name }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Create venue error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET /api/venues?q=search — Search existing venues by name
 */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") || ""

    if (q.length < 2) {
      return NextResponse.json({ venues: [] })
    }

    const venues = await prisma.venue.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
      } as any,
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        country: true,
        capacity: true,
      },
      orderBy: { name: "asc" },
      take: 10,
    })

    return NextResponse.json({ venues })
  } catch (error) {
    console.error("Search venues error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
