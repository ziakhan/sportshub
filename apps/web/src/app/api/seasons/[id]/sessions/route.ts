import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"

export const dynamic = "force-dynamic"

const sessionDaySchema = z.object({
  date: z.string(),
  startTime: z.string().min(3),
  endTime: z.string().min(3),
})

// Per-session venue choice: which courts host games, in PREFERRED order —
// the scheduler packs games onto the first court and overflows to the rest
// (owner 2026-07-30: sessions were silently absorbing every court).
const sessionVenueSchema = z.object({
  venueId: z.string(),
  courtIds: z.array(z.string()).default([]),
})

const createSessionSchema = z.object({
  label: z.string().optional(),
  days: z.array(sessionDaySchema).min(1),
  venues: z.array(sessionVenueSchema).optional(),
  // Per-session games-per-team override (owner 2026-07-31): the season
  // derives games/session from guaranteed ÷ sessions; a session that
  // differs (finals weekend, single-day) sets its own number here.
  targetGamesPerTeam: z.number().int().min(1).max(10).nullable().optional(),
  // Legacy shape (pre-2026-07-30 callers): one venue, all its courts.
  venueId: z.string().optional(),
})

const updateSessionSchema = z.object({
  label: z.string().nullable().optional(),
  days: z.array(sessionDaySchema).min(1).optional(),
  venues: z.array(sessionVenueSchema).optional(),
  targetGamesPerTeam: z.number().int().min(1).max(10).nullable().optional(),
  /** What the weekend is FOR (owner's 2026-08-06 analysis, C1). A playoff
   *  weekend is a season fact, set here and nowhere else: planning excludes
   *  its dates entirely, and the scheduler never treats it as supply. */
  phase: z.enum(["REGULAR", "PLAYOFF"]).optional(),
  /** The round this weekend materializes (owner 2026-08-07). Null detaches. */
  roundId: z.string().nullable().optional(),
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
  if (isSeasonLocked(season.status)) {
    return {
      error: NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: season.status },
        { status: 409 }
      ),
    }
  }
  return { season }
}

/** Resolve the venue/court plan: explicit selection, or legacy venueId = all its courts. */
async function resolveVenuePlan(
  venues: Array<{ venueId: string; courtIds: string[] }> | undefined,
  legacyVenueId: string | undefined
): Promise<Array<{ venueId: string; courtIds: string[] }>> {
  if (venues && venues.length > 0) return venues
  if (!legacyVenueId) return []
  const venue = await prisma.venue.findUnique({
    where: { id: legacyVenueId },
    select: {
      courtList: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], select: { id: true } },
    },
  })
  return [{ venueId: legacyVenueId, courtIds: (venue?.courtList ?? []).map((c) => c.id) }]
}

async function createDays(
  tx: any,
  sessionId: string,
  days: Array<{ date: string; startTime: string; endTime: string }>,
  plan: Array<{ venueId: string; courtIds: string[] }>
) {
  for (const d of days) {
    const day = await tx.seasonSessionDay.create({
      data: { sessionId, date: new Date(d.date) },
    })
    for (const v of plan) {
      const dayVenue = await tx.seasonSessionDayVenue.create({
        data: {
          dayId: day.id,
          venueId: v.venueId,
          startTime: d.startTime,
          endTime: d.endTime,
        },
      })
      if (v.courtIds.length > 0) {
        await tx.seasonSessionDayVenueCourt.createMany({
          data: v.courtIds.map((courtId, idx) => ({
            dayVenueId: dayVenue.id,
            courtId,
            order: idx,
          })),
        })
      }
    }
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await authorize(params.id)
    if (auth.error) return auth.error

    const body = await request.json()
    const data = createSessionSchema.parse(body)
    const plan = await resolveVenuePlan(data.venues, data.venueId)

    const result = await prisma.$transaction(async (tx: any) => {
      const seasonSession = await tx.seasonSession.create({
        data: {
          seasonId: params.id,
          label: data.label || null,
          phase: "REGULAR",
          targetGamesPerTeam: data.targetGamesPerTeam ?? null,
        },
      })
      await createDays(tx, seasonSession.id, data.days, plan)
      return seasonSession
    })

    return NextResponse.json({ success: true, id: result.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Create session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/seasons/[id]/sessions?sessionId= — edit a session (owner
 * 2026-07-30: sessions were create-and-delete only). Label edits are
 * in-place; supplying days replaces the day/venue/court substrate wholesale
 * (only possible while the season is unlocked, so no committed games ride
 * on these rows).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await authorize(params.id)
    if (auth.error) return auth.error

    const sessionId = request.nextUrl.searchParams.get("sessionId")
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    const target = await prisma.seasonSession.findFirst({
      where: { id: sessionId, seasonId: params.id },
      select: { id: true },
    })
    if (!target) return NextResponse.json({ error: "Session not found" }, { status: 404 })

    const body = await request.json()
    const data = updateSessionSchema.parse(body)

    await prisma.$transaction(async (tx: any) => {
      if (
        data.label !== undefined ||
        data.targetGamesPerTeam !== undefined ||
        data.phase !== undefined ||
        data.roundId !== undefined
      ) {
        // A round id has to be this season's own, or null to detach.
        if (data.roundId) {
          const round = await (prisma as any).sessionRound.findFirst({
            where: { id: data.roundId, seasonId: params.id },
            select: { id: true },
          })
          if (!round) throw Object.assign(new Error("Round not found"), { status: 404 })
        }
        await tx.seasonSession.update({
          where: { id: sessionId },
          data: {
            ...(data.label !== undefined ? { label: data.label || null } : {}),
            ...(data.targetGamesPerTeam !== undefined
              ? { targetGamesPerTeam: data.targetGamesPerTeam }
              : {}),
            ...(data.phase !== undefined ? { phase: data.phase } : {}),
            ...(data.roundId !== undefined ? { roundId: data.roundId } : {}),
          },
        })
      }
      if (data.days) {
        const plan = await resolveVenuePlan(data.venues, undefined)
        await tx.seasonSessionDay.deleteMany({ where: { sessionId } })
        await createDays(tx, sessionId, data.days, plan)
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Update session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessions = await (prisma as any).seasonSession.findMany({
      where: { seasonId: params.id },
      include: {
        days: {
          orderBy: { date: "asc" },
          include: {
            dayVenues: {
              include: {
                venue: { select: { id: true, name: true, address: true, city: true } },
                courts: {
                  orderBy: { order: "asc" },
                  select: { courtId: true, order: true, court: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })
    // Flatten back to the legacy { venue, days: [{ date, startTime, endTime }] } shape
    // so existing UI reads continue to work. Also expose `isUsable` for the
    // finalize preflight, `phase` (playoff sessions are not schedulable
    // supply), and `venueSelections` (uniform across days by construction)
    // for the session editor.
    const flattened = sessions.map((s: any) => {
      const firstDayVenue = s.days[0]?.dayVenues[0]
      const isUsable = s.days.some((d: any) =>
        (d.dayVenues ?? []).some((dv: any) => (dv.courts ?? []).length > 0)
      )
      const venueSelections = (s.days[0]?.dayVenues ?? []).map((dv: any) => ({
        venueId: dv.venueId,
        venueName: dv.venue?.name ?? "",
        courts: (dv.courts ?? []).map((c: any) => ({
          id: c.courtId,
          name: c.court?.name ?? "",
          order: c.order ?? 0,
        })),
      }))
      return {
        id: s.id,
        label: s.label,
        phase: s.phase,
        roundId: s.roundId ?? null,
        targetGamesPerTeam: s.targetGamesPerTeam ?? null,
        leagueId: params.id,
        venueId: firstDayVenue?.venueId ?? null,
        venue: firstDayVenue?.venue ?? null,
        isUsable,
        venueSelections,
        days: s.days.map((d: any) => {
          const dv = d.dayVenues[0]
          return {
            id: d.id,
            sessionId: s.id,
            date: d.date,
            startTime: dv?.startTime ?? "",
            endTime: dv?.endTime ?? "",
            dayVenues: (d.dayVenues ?? []).map((x: any) => ({
              id: x.id,
              venueId: x.venueId,
              startTime: x.startTime,
              endTime: x.endTime,
              courts: (x.courts ?? []).map((c: any) => ({ id: c.courtId })),
            })),
          }
        }),
        createdAt: s.createdAt,
      }
    })
    return NextResponse.json({ sessions: flattened })
  } catch (error) {
    console.error("Get sessions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await authorize(params.id)
    if (auth.error) return auth.error

    const sessionId = request.nextUrl.searchParams.get("sessionId")
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    // Scope: the session must belong to THIS season (IDOR guard, gap-audit §2).
    const target = await prisma.seasonSession.findFirst({
      where: { id: sessionId, seasonId: params.id },
      select: { id: true },
    })
    if (!target) return NextResponse.json({ error: "Session not found" }, { status: 404 })

    await prisma.seasonSession.delete({ where: { id: sessionId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
