import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { submitTeamToSeason } from "@/lib/seasons/submit-team"
import { notifyMany } from "@/lib/notifications"

export const dynamic = "force-dynamic"

const resolveSchema = z.object({
  action: z.enum(["approve", "decline", "cancel"]),
  reason: z.string().trim().max(500).optional(),
})

/**
 * PATCH /api/submission-requests/[id] { action, reason? }
 * approve/decline — club operator of the requesting team's tenant (approval
 * PERFORMS the real season submission via the shared core; if that fails —
 * capacity filled, season closed — the request stays PENDING and the error
 * surfaces). cancel — the requester withdrawing their own request.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = resolveSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "action must be approve, decline or cancel" }, { status: 400 })
    }
    const { action, reason } = parsed.data

    const req = await (prisma as any).teamSubmissionRequest.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        seasonId: true,
        divisionId: true,
        playerIds: true,
        requestedById: true,
        team: { select: { id: true, name: true, tenantId: true } },
        season: { select: { label: true, league: { select: { name: true } } } },
      },
    })
    if (!req) return NextResponse.json({ error: "Request not found" }, { status: 404 })
    if (req.status !== "PENDING") {
      return NextResponse.json({ error: `This request is already ${req.status.toLowerCase()}` }, { status: 409 })
    }

    if (action === "cancel") {
      if (req.requestedById !== auth.userId) {
        return NextResponse.json({ error: "Only the requester can cancel" }, { status: 403 })
      }
      await (prisma as any).teamSubmissionRequest.update({
        where: { id: req.id },
        data: { status: "CANCELLED", decidedAt: new Date() },
      })
      return NextResponse.json({ success: true, status: "CANCELLED" })
    }

    // approve / decline — club operators only
    const operatorRole = await prisma.userRole.findFirst({
      where: {
        userId: auth.userId,
        OR: [
          { tenantId: req.team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
          { role: "PlatformAdmin" },
        ],
      },
      select: { id: true },
    })
    if (!operatorRole && !auth.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const seasonName = `${req.season?.league?.name ?? "league"} — ${req.season?.label ?? ""}`.trim()

    if (action === "decline") {
      await (prisma as any).teamSubmissionRequest.update({
        where: { id: req.id },
        data: {
          status: "DECLINED",
          decidedById: auth.userId,
          decidedAt: new Date(),
          declineReason: reason ?? null,
        },
      })
      await notifyMany(prisma, [req.requestedById], {
        type: "submission_request_decided",
        title: "League registration declined",
        message: `Your club declined registering ${req.team.name} for ${seasonName}${reason ? `: ${reason}` : ""}`,
        link: `/teams/${req.team.id}`,
        referenceId: req.id,
        referenceType: "TeamSubmissionRequest",
      }).catch(() => {})
      return NextResponse.json({ success: true, status: "DECLINED" })
    }

    // approve — run the real submission first, then mark the request
    const result = await submitTeamToSeason({
      seasonId: req.seasonId,
      teamId: req.team.id,
      divisionId: req.divisionId,
      playerIds: Array.isArray(req.playerIds) ? (req.playerIds as string[]) : undefined,
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: `Couldn't submit: ${result.error}`, requestStillPending: true },
        { status: result.status }
      )
    }

    await (prisma as any).teamSubmissionRequest.update({
      where: { id: req.id },
      data: { status: "APPROVED", decidedById: auth.userId, decidedAt: new Date() },
    })
    await notifyMany(prisma, [req.requestedById], {
      type: "submission_request_decided",
      title: "League registration approved",
      message: `${req.team.name} was submitted to ${seasonName} with ${result.playerCount} players — pending league approval.`,
      link: `/teams/${req.team.id}`,
      referenceId: req.id,
      referenceType: "TeamSubmissionRequest",
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      status: "APPROVED",
      submissionId: result.submissionId,
      playerCount: result.playerCount,
    })
  } catch (error) {
    console.error("Submission request resolve error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
