import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/programs/[type]/[id] — one program (tryout, camp,
 * house league or tournament) normalized for the native detail + register
 * screen. Anonymous.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  try {
    const tenantSelect = {
      select: { name: true, slug: true, currency: true },
    } as const

    if (params.type === "tryout") {
      const t = await prisma.tryout.findFirst({
        where: { id: params.id, isPublished: true, isPublic: true },
        include: { tenant: tenantSelect, _count: { select: { signups: true } } },
      })
      if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({
        program: {
          id: t.id,
          type: "tryout",
          name: t.title,
          description: t.description,
          details: null,
          ageGroup: t.ageGroup,
          gender: t.gender,
          startDate: t.scheduledAt,
          endDate: null,
          schedule: t.duration ? `${t.duration} minutes` : null,
          location: t.location,
          fee: Number(t.fee),
          feeUnit: null,
          currency: t.tenant?.currency ?? "CAD",
          clubName: t.tenant?.name ?? "",
          clubSlug: t.tenant?.slug ?? "",
          signedUp: t._count.signups,
          maxParticipants: t.maxParticipants,
          registration: { kind: "player", endpoint: `/api/tryouts/${t.id}/signup` },
        },
      })
    }

    if (params.type === "camp") {
      const c = await prisma.camp.findFirst({
        where: { id: params.id, isPublished: true },
        include: { tenant: tenantSelect, _count: { select: { signups: true } } },
      })
      if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({
        program: {
          id: c.id,
          type: "camp",
          name: c.name,
          description: c.description,
          details: c.details,
          ageGroup: c.ageGroup,
          gender: c.gender,
          startDate: c.startDate,
          endDate: c.endDate,
          schedule: `${c.dailyStartTime}–${c.dailyEndTime} daily`,
          location: c.location,
          fee: Number(c.weeklyFee),
          feeUnit: "per week",
          currency: c.tenant?.currency ?? "CAD",
          clubName: c.tenant?.name ?? "",
          clubSlug: c.tenant?.slug ?? "",
          signedUp: c._count.signups,
          maxParticipants: c.maxParticipants,
          numberOfWeeks: c.numberOfWeeks,
          fullCampFee: c.fullCampFee != null ? Number(c.fullCampFee) : null,
          registration: { kind: "player-weeks", endpoint: `/api/camps/${c.id}/signup` },
        },
      })
    }

    if (params.type === "house-league") {
      const h = await prisma.houseLeague.findFirst({
        where: { id: params.id, isPublished: true },
        include: { tenant: tenantSelect, _count: { select: { signups: true } } },
      })
      if (!h) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({
        program: {
          id: h.id,
          type: "house-league",
          name: h.name,
          description: h.description,
          details: h.details,
          ageGroup: (h.ageGroups || "").split(",").join(", "),
          gender: h.gender,
          startDate: h.startDate,
          endDate: h.endDate,
          schedule: `${h.daysOfWeek} ${h.startTime}–${h.endTime}`,
          location: h.location,
          fee: Number(h.fee),
          feeUnit: null,
          currency: h.tenant?.currency ?? "CAD",
          clubName: h.tenant?.name ?? "",
          clubSlug: h.tenant?.slug ?? "",
          signedUp: (h as any)._count.signups,
          maxParticipants: h.maxParticipants,
          registration: { kind: "player", endpoint: `/api/house-leagues/${h.id}/signup` },
        },
      })
    }

    if (params.type === "tournament") {
      const t = await (prisma as any).tournament.findFirst({
        where: { id: params.id },
        include: { divisions: true, _count: { select: { teams: true } } },
      })
      if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const ageGroups = [...new Set(t.divisions.map((d: any) => d.ageGroup))].filter(Boolean)
      return NextResponse.json({
        program: {
          id: t.id,
          type: "tournament",
          name: t.name,
          description: t.description ?? null,
          details: null,
          ageGroup: ageGroups.join(", "),
          gender: null,
          startDate: t.startDate,
          endDate: t.endDate,
          schedule: `${t.gamesGuaranteed} games guaranteed`,
          location: `${t.city}${t.state ? `, ${t.state}` : ""}`,
          fee: Number(t.teamFee || 0),
          feeUnit: "per team",
          currency: t.currency || "CAD",
          clubName: "",
          clubSlug: "",
          signedUp: t._count.teams,
          maxParticipants: t.maxTeams ?? null,
          // Team registration is an operator flow (desktop) — native shows
          // the details and says who to talk to, never a broken form.
          registration: { kind: "team-desktop", endpoint: null },
        },
      })
    }

    return NextResponse.json({ error: "Unknown program type" }, { status: 400 })
  } catch (error) {
    console.error("Mobile program detail error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
