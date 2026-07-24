import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { formatTrainingSchedule, trainingSortDate } from "@/lib/training"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getRegistrationViewer, type ProgramKind } from "@/lib/registration/viewer"
import { ACTIVE_SIGNUPS } from "@/lib/registration/capacity"
import { getPublicTryout } from "@/lib/queries/tryout"
import { getPublicTraining } from "@/lib/queries/training"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/programs/[type]/[id] — one program (tryout, camp,
 * house league or tournament) normalized for the native detail + register
 * screen. Anonymous; signed-in callers also get `viewer` (their kids with
 * eligibility + already-registered + the club's payment rails) — the SAME
 * getRegistrationViewer the web pages use, so the two can never disagree.
 */
async function viewerFor(opts: {
  kind: ProgramKind
  programId: string
  tenantId: string
  ageGroup: string | null
  agePolicy: string | null
  gender?: string | null
}) {
  const session = await getSessionUserId().catch(() => null)
  if (!session) return null
  return getRegistrationViewer({
    userId: session.userId,
    kind: opts.kind,
    programId: opts.programId,
    tenantId: opts.tenantId,
    ageGroup: opts.ageGroup,
    agePolicy: (opts.agePolicy as any) ?? "PREFERRED",
    gender: opts.gender,
  })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  try {
    const tenantSelect = {
      select: { name: true, slug: true, currency: true },
    } as const

    if (params.type === "tryout") {
      // One-source doctrine (2026-07-24): getPublicTryout is shared with the
      // public /tryout/[id] page's fetch — this route keeps its own,
      // stricter isPublic gate (a native deep link should never surface a
      // club-internal-only tryout that the marketplace page also hides).
      const t = await getPublicTryout(params.id)
      if (!t || !t.isPublished || !t.isPublic) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const viewer = await viewerFor({
        kind: "tryout",
        programId: t.id,
        tenantId: t.tenantId,
        ageGroup: t.ageGroup,
        agePolicy: (t as any).agePolicy ?? "STRICT",
        gender: t.gender,
      })
      return NextResponse.json({
        viewer,
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
        include: { tenant: tenantSelect, _count: { select: { signups: { where: ACTIVE_SIGNUPS } } } },
      })
      if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const viewer = await viewerFor({
        kind: "camp",
        programId: c.id,
        tenantId: c.tenantId,
        ageGroup: c.ageGroup,
        agePolicy: (c as any).agePolicy ?? "PREFERRED",
        gender: c.gender,
      })
      return NextResponse.json({
        viewer,
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
          fee: c.scheduleKind === "CONSECUTIVE" ? Number(c.weeklyFee) : Number(c.pricePerSession ?? 0),
          feeUnit: c.scheduleKind === "CONSECUTIVE" ? "per week" : "per session",
          currency: c.tenant?.currency ?? "CAD",
          clubName: c.tenant?.name ?? "",
          clubSlug: c.tenant?.slug ?? "",
          signedUp: c._count.signups,
          maxParticipants: c.maxParticipants,
          numberOfWeeks: c.numberOfWeeks,
          fullCampFee: c.fullCampFee != null ? Number(c.fullCampFee) : null,
          // Program flexibility (owner 2026-07-24) — additive; native update
          // to render session-date chips comes later.
          scheduleKind: c.scheduleKind,
          daysOfWeek: c.daysOfWeek,
          pricePerSession: c.pricePerSession != null ? Number(c.pricePerSession) : null,
          registration: { kind: "player-weeks", endpoint: `/api/camps/${c.id}/signup` },
        },
      })
    }

    if (params.type === "house-league") {
      const h = await prisma.houseLeague.findFirst({
        where: { id: params.id, isPublished: true },
        include: { tenant: tenantSelect, _count: { select: { signups: { where: ACTIVE_SIGNUPS } } } },
      })
      if (!h) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const viewer = await viewerFor({
        kind: "house-league",
        programId: h.id,
        tenantId: h.tenantId,
        ageGroup: h.ageGroups,
        agePolicy: (h as any).agePolicy ?? "PREFERRED",
        gender: h.gender,
      })
      return NextResponse.json({
        viewer,
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

    if (params.type === "training") {
      // One-source doctrine (2026-07-24): shared with the public
      // /training/[id] page's fetch.
      const s = await getPublicTraining(params.id)
      if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const viewer = await viewerFor({
        kind: "training",
        programId: s.id,
        tenantId: s.tenantId,
        ageGroup: s.ageGroup,
        agePolicy: (s as any).agePolicy ?? "PREFERRED",
        gender: s.gender,
      })
      return NextResponse.json({
        viewer,
        program: {
          id: s.id,
          type: "training",
          name: s.title,
          description: s.description,
          details: null,
          ageGroup: s.ageGroup,
          gender: s.gender,
          startDate: trainingSortDate(s),
          endDate: s.scheduleType === "RECURRING" ? s.endDate : null,
          schedule: `${formatTrainingSchedule(s)} · ${s.durationMinutes} minutes`,
          location: s.venue?.name ?? s.location,
          fee: Number(s.fee),
          feeUnit: "for the full program",
          currency: s.tenant?.currency ?? "CAD",
          clubName: s.tenant?.name ?? "",
          clubSlug: s.tenant?.slug ?? "",
          signedUp: s._count.signups,
          maxParticipants: s.capacity,
          registration: { kind: "player", endpoint: `/api/training-sessions/${s.id}/signup` },
        },
      })
    }

    return NextResponse.json({ error: "Unknown program type" }, { status: 400 })
  } catch (error) {
    console.error("Mobile program detail error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
