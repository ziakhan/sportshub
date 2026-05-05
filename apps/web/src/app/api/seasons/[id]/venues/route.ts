import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"

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
  courtsAvailable: z.number().int().min(1).optional(), // Override courts for this league at this venue
})

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await prisma.season.findUnique({
      where: { id: params.id },
      select: { status: true, league: { select: { ownerId: true } } },
    })
    if (!season || (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (isSeasonLocked(season.status)) {
      return NextResponse.json({ error: SEASON_LOCKED_MESSAGE, status: season.status }, { status: 409 })
    }

    const body = await request.json()
    const data = addVenueSchema.parse(body)

    let venueId = data.venueId

    if (!venueId && data.name && data.address && data.city) {
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

    const seasonVenue = await prisma.seasonVenue.create({
      data: {
        seasonId: params.id,
        venueId,
        isPrimary: data.isPrimary,
        courtsAvailable: data.courtsAvailable ?? null,
      },
    })

    return NextResponse.json({ success: true, id: seasonVenue.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Add venue error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const venues = await (prisma as any).seasonVenue.findMany({
      where: { seasonId: params.id },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            capacity: true,
            courts: true,
            courtList: {
              orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
              select: { id: true, name: true, displayOrder: true },
            },
            venueHours: {
              orderBy: { dayOfWeek: "asc" },
              select: {
                id: true,
                dayOfWeek: true,
                openTime: true,
                closeTime: true,
              },
            },
          },
        },
      },
    })
    return NextResponse.json({ venues: venues.map((v: any) => ({ ...v, leagueId: params.id })) })
  } catch (error) {
    console.error("Get venues error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await prisma.season.findUnique({
      where: { id: params.id },
      select: { status: true, league: { select: { ownerId: true } } },
    })
    if (!season || (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (isSeasonLocked(season.status)) {
      return NextResponse.json({ error: SEASON_LOCKED_MESSAGE, status: season.status }, { status: 409 })
    }

    const seasonVenueId =
      request.nextUrl.searchParams.get("leagueVenueId") ??
      request.nextUrl.searchParams.get("seasonVenueId")
    if (!seasonVenueId) {
      return NextResponse.json({ error: "seasonVenueId required" }, { status: 400 })
    }

    await prisma.seasonVenue.delete({ where: { id: seasonVenueId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete venue error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
