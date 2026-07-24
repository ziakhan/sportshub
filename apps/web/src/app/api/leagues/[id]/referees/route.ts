import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/** League referee pool — the refs this league knows and books. */

async function requireLeagueSide(
  userId: string,
  isPlatformAdmin: boolean,
  leagueId: string
): Promise<{ error: NextResponse; league?: never } | { error?: never; league: any }> {
  const league = (await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, ownerId: true },
  })) as any
  if (!league) return { error: NextResponse.json({ error: "League not found" }, { status: 404 }) }
  if (isPlatformAdmin || league.ownerId === userId) return { league }
  const role = await prisma.userRole.findFirst({
    where: { userId, role: { in: ["LeagueOwner", "LeagueManager"] }, leagueId },
    select: { id: true },
  })
  if (!role) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { league }
}

/** Does an availability row cover the window on that date? */
function covers(av: { startTime: string; endTime: string }, start: string, end: string) {
  return av.startTime <= start && av.endTime >= end
}

/**
 * GET /api/leagues/[id]/referees?date=&start=&end=&q=
 * The pool with availability status for a shift; ?all=1 adds platform refs
 * outside the pool (to grow the pool).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const ctx = await requireLeagueSide(auth.userId, auth.isPlatformAdmin, params.id)
    if (ctx.error) return ctx.error

    const sp = new URL(request.url).searchParams
    const date = sp.get("date") // YYYY-MM-DD
    const start = sp.get("start") ?? "00:00"
    const end = sp.get("end") ?? "23:59"
    const q = sp.get("q")?.trim().toLowerCase() ?? ""
    const includeAll = sp.get("all") === "1"

    const pool = await prisma.leagueReferee.findMany({
      where: { leagueId: params.id },
      select: {
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            refereeProfile: {
              select: {
                certificationLevel: true,
                standardFee: true,
                gamesRefereed: true,
                signoffPinHash: true,
                certificationDocUrl: true,
                certificationVerifiedAt: true,
              },
            },
            refereeAvailabilities: date
              ? { where: { date: new Date(`${date}T00:00:00.000Z`) }, select: { startTime: true, endTime: true } }
              : { where: { id: "none" }, select: { startTime: true, endTime: true } },
          },
        },
      },
    })

    const mapReferee = (userId: string, u: any, inPool: boolean) => {
      const slots = u.refereeAvailabilities ?? []
      return {
        userId,
        name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(),
        certification: u.refereeProfile?.certificationLevel ?? null,
        fee: u.refereeProfile?.standardFee ? Number(u.refereeProfile.standardFee) : null,
        gamesRefereed: u.refereeProfile?.gamesRefereed ?? 0,
        hasPin: !!u.refereeProfile?.signoffPinHash,
        // QA-208: flags only — the doc itself (data URL, up to ~2MB) never
        // goes into this list payload.
        hasCertDoc: !!u.refereeProfile?.certificationDocUrl,
        certVerified: !!u.refereeProfile?.certificationVerifiedAt,
        inPool,
        // "available" declared + covers · "partial" declared other hours ·
        // "unknown" hasn't said — still contactable, Uber-style
        availability: !date
          ? "unknown"
          : slots.some((s: any) => covers(s, start, end))
            ? "available"
            : slots.length > 0
              ? "partial"
              : "unknown",
      }
    }

    let outside: any[] = []
    if (includeAll) {
      const poolIds = new Set(pool.map((p: any) => p.userId))
      const others = await prisma.user.findMany({
        where: {
          roles: { some: { role: "Referee", gameId: null } },
          id: { notIn: [...poolIds] },
          ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          refereeProfile: {
            select: {
              certificationLevel: true,
              standardFee: true,
              gamesRefereed: true,
              signoffPinHash: true,
              certificationDocUrl: true,
              certificationVerifiedAt: true,
            },
          },
          refereeAvailabilities: date
            ? { where: { date: new Date(`${date}T00:00:00.000Z`) }, select: { startTime: true, endTime: true } }
            : { where: { id: "none" }, select: { startTime: true, endTime: true } },
        },
        take: 25,
        orderBy: { firstName: "asc" },
      })
      outside = others.map((u: any) => mapReferee(u.id, u, false))
    }

    return NextResponse.json({
      referees: [
        ...pool
          .map((p: any) => mapReferee(p.userId, p.user, true))
          .filter((r: any) => !q || r.name.toLowerCase().includes(q)),
        ...outside,
      ],
    })
  } catch (error) {
    console.error("League referees error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const addSchema = z.object({ userId: z.string() })

/** POST — add a referee to the league pool. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const ctx = await requireLeagueSide(auth.userId, auth.isPlatformAdmin, params.id)
    if (ctx.error) return ctx.error

    const parsed = addSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "userId is required" }, { status: 400 })

    const referee = await prisma.user.findFirst({
      where: { id: parsed.data.userId, roles: { some: { role: "Referee" } } },
      select: { id: true },
    })
    if (!referee) return NextResponse.json({ error: "That user is not a referee" }, { status: 400 })

    await prisma.leagueReferee.upsert({
      where: { leagueId_userId: { leagueId: params.id, userId: referee.id } },
      create: { leagueId: params.id, userId: referee.id },
      update: {},
    })
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("League referee add error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE ?userId= — remove from the pool. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const ctx = await requireLeagueSide(auth.userId, auth.isPlatformAdmin, params.id)
    if (ctx.error) return ctx.error

    const userId = new URL(request.url).searchParams.get("userId")
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 })
    await prisma.leagueReferee.deleteMany({ where: { leagueId: params.id, userId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("League referee remove error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const verifySchema = z.object({ userId: z.string() })

/**
 * PATCH — QA-208: league-owner/manager stamps a referee's uploaded
 * certification as verified. Requires a document on file; no-op review of
 * content itself (that's the human step) — this just records who/when.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const ctx = await requireLeagueSide(auth.userId, auth.isPlatformAdmin, params.id)
    if (ctx.error) return ctx.error

    const parsed = verifySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "userId is required" }, { status: 400 })

    const profile = await prisma.refereeProfile.findUnique({
      where: { userId: parsed.data.userId },
      select: { certificationDocUrl: true },
    })
    if (!profile?.certificationDocUrl) {
      return NextResponse.json(
        { error: "This referee has no certification document on file" },
        { status: 400 }
      )
    }

    await prisma.refereeProfile.update({
      where: { userId: parsed.data.userId },
      data: { certificationVerifiedAt: new Date(), certificationVerifiedById: auth.userId },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Referee cert verify error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
