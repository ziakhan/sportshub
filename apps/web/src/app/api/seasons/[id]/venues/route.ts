import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import {
  applyVenueHoursToSessionDays,
  defaultCourtIdsForVenue,
  propagateVenueToSessions,
} from "@/lib/seasons/venue-propagation"

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
  // One-dialog setup (owner 2026-07-31): how many courts the season uses
  // (missing ones are auto-created "Court N"), the default scheduling
  // window, and whether existing sessions pick the venue up immediately.
  courtCount: z.number().int().min(1).max(30).optional(),
  openTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  closeTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  addToSessions: z.boolean().default(false),
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
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: season.status },
        { status: 409 }
      )
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

    const courtCount = data.courtCount ?? data.courtsAvailable ?? null

    // Auto-create missing courts (owner 2026-07-31): pick "6 courts" and
    // Court 1…Court 6 exist immediately — rename in the editor later.
    if (courtCount != null) {
      const existing = await (prisma as any).court.count({ where: { venueId } })
      if (existing < courtCount) {
        await (prisma as any).court.createMany({
          data: Array.from({ length: courtCount - existing }, (_, i) => ({
            venueId,
            name: `Court ${existing + i + 1}`,
            displayOrder: existing + i,
          })),
        })
      }
    }

    const seasonVenue = await prisma.seasonVenue.upsert({
      where: { seasonId_venueId: { seasonId: params.id, venueId } },
      create: {
        seasonId: params.id,
        venueId,
        isPrimary: data.isPrimary,
        courtsAvailable: courtCount,
      },
      update: { courtsAvailable: courtCount ?? undefined },
    })

    // Default scheduling window, stored per weekday — the session form
    // prefills day hours from these when a date is picked.
    if (data.openTime && data.closeTime) {
      for (let dow = 0; dow < 7; dow++) {
        await (prisma as any).seasonVenueHours.upsert({
          where: { seasonVenueId_dayOfWeek: { seasonVenueId: seasonVenue.id, dayOfWeek: dow } },
          create: {
            seasonVenueId: seasonVenue.id,
            dayOfWeek: dow,
            openTime: data.openTime,
            closeTime: data.closeTime,
          },
          update: { openTime: data.openTime, closeTime: data.closeTime },
        })
      }
    }

    let addedToSessions = 0
    if (data.addToSessions) {
      const courtIds = await defaultCourtIdsForVenue(venueId, courtCount)
      addedToSessions = await propagateVenueToSessions(params.id, venueId, courtIds, {
        startTime: data.openTime ?? "09:00",
        endTime: data.closeTime ?? "18:00",
      })
    }

    // Re-running the setup card with new hours must reach EXISTING session
    // days too, not just the ones propagation adds (owner 2026-08-01: half
    // the weekends kept the old window).
    let updatedDays = 0
    if (data.openTime && data.closeTime) {
      updatedDays = await applyVenueHoursToSessionDays(
        params.id,
        venueId,
        Array.from({ length: 7 }, (_, dow) => ({
          dayOfWeek: dow,
          openTime: data.openTime!,
          closeTime: data.closeTime!,
        }))
      )
    }

    return NextResponse.json(
      { success: true, id: seasonVenue.id, addedToSessions, updatedDays },
      { status: 201 }
    )
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
        // THIS season's private scheduling hours at the venue (§2b) — the
        // editable set; venue.venueHours below is display-only reference.
        hours: {
          orderBy: { dayOfWeek: "asc" },
          select: { id: true, dayOfWeek: true, openTime: true, closeTime: true },
        },
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
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: season.status },
        { status: 409 }
      )
    }

    const seasonVenueId =
      request.nextUrl.searchParams.get("leagueVenueId") ??
      request.nextUrl.searchParams.get("seasonVenueId")
    if (!seasonVenueId) {
      return NextResponse.json({ error: "seasonVenueId required" }, { status: 400 })
    }

    // Scope: the link row must belong to THIS season (IDOR guard, gap-audit §2).
    const target = await prisma.seasonVenue.findFirst({
      where: { id: seasonVenueId, seasonId: params.id },
      select: { id: true, venueId: true },
    })
    if (!target) return NextResponse.json({ error: "Season venue not found" }, { status: 404 })

    // Leaving the season means leaving its sessions too (owner 2026-07-31:
    // no orphaned courts lingering in sessions after a venue is removed).
    const removedDays = await (prisma as any).seasonSessionDayVenue.deleteMany({
      where: { venueId: target.venueId, day: { session: { seasonId: params.id } } },
    })

    await prisma.seasonVenue.delete({ where: { id: seasonVenueId } })
    return NextResponse.json({ success: true, removedFromDays: removedDays.count })
  } catch (error) {
    console.error("Delete venue error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
