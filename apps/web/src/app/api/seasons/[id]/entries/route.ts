import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notify } from "@/lib/notifications"
import { effectiveSeasonConfig } from "@/lib/org/season-defaults"

export const dynamic = "force-dynamic"

const postSchema = z.object({
  tenantId: z.string(),
  plannedTeams: z.number().int().min(1).max(50),
  planNote: z.string().trim().max(1000).optional(),
  // string = text/single answers · string[] = multi-choice answers
  answers: z
    .record(z.union([z.string().max(2000), z.array(z.string().max(200)).max(20)]))
    .optional(),
  signatureName: z.string().trim().max(120).optional(),
})

/**
 * Level-1 registration (owner 2026-07-29): the CLUB enters the season —
 * application answers once per club, planned team count for the league's
 * capacity planning, club official signs the CLUB_OFFICIAL agreement.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        label: true,
        status: true,
        leagueId: true,
        league: { select: { id: true, name: true, ownerId: true } },
      },
    })
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 })
    if (season.status !== "REGISTRATION") {
      return NextResponse.json({ error: "Registration is not open for this season" }, { status: 409 })
    }

    const parsed = postSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 })
    }

    const operator =
      auth.isPlatformAdmin ||
      !!(await prisma.userRole.findFirst({
        where: { userId: auth.userId, tenantId: parsed.data.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
        select: { id: true },
      }))
    if (!operator) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // The league's club agreement must be signed at entry when one exists
    const clubDoc = await (prisma as any).waiverDocument.findFirst({
      where: { leagueId: season.leagueId, active: true, required: true, audience: "CLUB_OFFICIAL" },
      select: { id: true, title: true },
    })
    if (clubDoc && !parsed.data.signatureName) {
      return NextResponse.json(
        { error: `"${clubDoc.title}" must be signed to enter — provide signatureName` },
        { status: 400 }
      )
    }

    const existing = await (prisma as any).clubSeasonEntry.findUnique({
      where: { seasonId_tenantId: { seasonId: params.id, tenantId: parsed.data.tenantId } },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: "This club has already entered the season" }, { status: 409 })
    }

    const tenant = await (prisma as any).tenant.findUnique({
      where: { id: parsed.data.tenantId },
      select: { name: true },
    })
    const entry = await (prisma as any).clubSeasonEntry.create({
      data: {
        seasonId: params.id,
        tenantId: parsed.data.tenantId,
        plannedTeams: parsed.data.plannedTeams,
        planNote: parsed.data.planNote ?? null,
        answers: parsed.data.answers ?? undefined,
        signedById: parsed.data.signatureName ? auth.userId : null,
        signatureName: parsed.data.signatureName ?? null,
        signedAt: parsed.data.signatureName ? new Date() : null,
      },
      select: { id: true },
    })

    await notify(prisma, {
      userId: season.league.ownerId,
      type: "team_submitted",
      title: "New club entry",
      message: `${tenant?.name ?? "A club"} entered ${season.label} — ${parsed.data.plannedTeams} team${parsed.data.plannedTeams === 1 ? "" : "s"} planned`,
      link: `/manage/leagues/${season.league.id}/seasons/${season.id}/manage?tab=clubs`,
      referenceId: entry.id,
      referenceType: "ClubSeasonEntry",
    })

    return NextResponse.json({ id: entry.id }, { status: 201 })
  } catch (error) {
    console.error("Club entry error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** GET — league-side list of entries with club + answers. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: {
        leagueId: true,
        applicationQuestions: true,
        league: {
          select: { ownerId: true, organization: { select: { seasonDefaults: true } } },
        },
      },
    })
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 })
    const allowed =
      auth.isPlatformAdmin ||
      season.league.ownerId === auth.userId ||
      !!(await prisma.userRole.findFirst({
        where: { userId: auth.userId, leagueId: season.leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
        select: { id: true },
      }))
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const entries = await (prisma as any).clubSeasonEntry.findMany({
      where: { seasonId: params.id },
      select: {
        id: true,
        status: true,
        plannedTeams: true,
        planNote: true,
        answers: true,
        signatureName: true,
        signedAt: true,
        createdAt: true,
        tenant: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    })
    // Questions may live on the org rulebook (Phase A) — return effective.
    const { values: cfg } = effectiveSeasonConfig(
      season,
      season.league?.organization?.seasonDefaults
    )
    return NextResponse.json({ entries, questions: cfg.applicationQuestions ?? [] })
  } catch (error) {
    console.error("Entries list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
