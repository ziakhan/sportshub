import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canSubmitTeams, SUBMIT_CLOSED_MESSAGE } from "@/lib/seasons/season-lock"
import { notifyMany } from "@/lib/notifications"

export const dynamic = "force-dynamic"

const requestSchema = z.object({
  teamId: z.string(),
  divisionId: z.string(),
  playerIds: z.array(z.string()).optional(),
})

/**
 * POST /api/seasons/[id]/submission-requests — a coach/TeamManager asks
 * their club to register the team for this season (owner 2026-07-15:
 * payments hang off submissions, so club operators approve first; approval
 * performs the real submission). Club operators are told to submit
 * directly instead.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request" },
        { status: 400 }
      )
    }
    const data = parsed.data

    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
      select: { id: true, name: true, tenantId: true, archivedAt: true },
    })
    if (!team || team.archivedAt) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Operators submit directly — this endpoint is the staff path.
    const operatorRole = await prisma.userRole.findFirst({
      where: {
        userId: auth.userId,
        OR: [
          { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
          { role: "PlatformAdmin" },
        ],
      },
      select: { id: true },
    })
    if (operatorRole || auth.isPlatformAdmin) {
      return NextResponse.json(
        { error: "You can submit this team directly — no approval needed.", code: "SUBMIT_DIRECTLY" },
        { status: 400 }
      )
    }

    const staffRole = await prisma.userRole.findFirst({
      where: {
        userId: auth.userId,
        teamId: team.id,
        role: { in: ["Staff", "TeamManager"] },
      },
      select: { id: true },
    })
    if (!staffRole) {
      return NextResponse.json(
        { error: "Only this team's staff can request a league registration" },
        { status: 403 }
      )
    }

    const season = (await prisma.season.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        label: true,
        registrationDeadline: true,
        league: { select: { name: true } },
      },
    })) as any
    if (!season) return NextResponse.json({ error: "League not found" }, { status: 404 })
    if (!canSubmitTeams(season.status)) {
      return NextResponse.json({ error: SUBMIT_CLOSED_MESSAGE }, { status: 400 })
    }
    if (season.registrationDeadline && new Date(season.registrationDeadline) < new Date()) {
      return NextResponse.json({ error: "Registration deadline has passed" }, { status: 400 })
    }

    const division = await prisma.division.findFirst({
      where: { id: data.divisionId, seasonId: params.id },
      select: { id: true, name: true },
    })
    if (!division) return NextResponse.json({ error: "Division not found" }, { status: 404 })

    const existingSubmission = await prisma.teamSubmission.findUnique({
      where: { seasonId_teamId: { seasonId: params.id, teamId: team.id } },
      select: { id: true },
    })
    if (existingSubmission) {
      return NextResponse.json(
        { error: "This team is already submitted to this league" },
        { status: 409 }
      )
    }

    const existingRequest = await (prisma as any).teamSubmissionRequest.findFirst({
      where: { seasonId: params.id, teamId: team.id, status: "PENDING" },
      select: { id: true },
    })
    if (existingRequest) {
      return NextResponse.json(
        { error: "A registration request for this league is already waiting on your club" },
        { status: 409 }
      )
    }

    const created = await (prisma as any).teamSubmissionRequest.create({
      data: {
        seasonId: params.id,
        teamId: team.id,
        divisionId: data.divisionId,
        playerIds: data.playerIds ?? null,
        requestedById: auth.userId,
      },
      select: { id: true },
    })

    // Tell the club's operators there's something to approve (bell + push)
    try {
      const operators = await prisma.userRole.findMany({
        where: { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
        select: { userId: true },
      })
      const requester = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { firstName: true, lastName: true },
      })
      const requesterName =
        [requester?.firstName, requester?.lastName].filter(Boolean).join(" ") || "A coach"
      await notifyMany(prisma, Array.from(new Set(operators.map((o) => o.userId))), {
        type: "submission_request",
        title: "League registration needs your approval",
        message: `${requesterName} wants to register ${team.name} for ${season.league?.name ?? "a league"} — ${season.label}`,
        link: `/clubs/${team.tenantId}`,
        referenceId: created.id,
        referenceType: "TeamSubmissionRequest",
      })
    } catch (err) {
      console.error("submission_request bell failed:", err)
    }

    return NextResponse.json(
      {
        success: true,
        requestId: created.id,
        message: `Sent to your club for approval — ${team.name} will be submitted to ${season.label} once a club manager approves.`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Submission request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET /api/seasons/[id]/submission-requests?teamId=… — the requester's own
 * pending/decided requests for this season+team (team staff view).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const teamId = new URL(request.url).searchParams.get("teamId")
    if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 })

    const requests = await (prisma as any).teamSubmissionRequest.findMany({
      where: { seasonId: params.id, teamId, requestedById: auth.userId },
      select: { id: true, status: true, declineReason: true, createdAt: true, decidedAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    })
    return NextResponse.json({ requests })
  } catch (error) {
    console.error("Submission request list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
