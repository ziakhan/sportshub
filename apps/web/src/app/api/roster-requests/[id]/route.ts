import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notify } from "@/lib/notifications"

export const dynamic = "force-dynamic"

const resolveSchema = z.object({
  action: z.enum(["approve", "deny"]),
  note: z.string().trim().max(1000).optional(),
})

/**
 * PATCH /api/roster-requests/[id] { action: approve|deny, note? }
 * Commissioner resolves a club's roster-change request. Approval UNLOCKS
 * the season roster — the club's next roster save re-locks it (one-shot
 * change window).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const req = (await prisma.rosterChangeRequest.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        requestedById: true,
        roster: {
          select: {
            id: true,
            teamSubmission: { select: { team: { select: { name: true, tenantId: true, id: true } } } },
            season: {
              select: {
                id: true,
                label: true,
                league: { select: { id: true, name: true, ownerId: true } },
              },
            },
          },
        },
      },
    })) as any
    if (!req) return NextResponse.json({ error: "Request not found" }, { status: 404 })

    const league = req.roster.season.league
    if (!auth.isPlatformAdmin && league.ownerId !== auth.userId) {
      const role = await prisma.userRole.findFirst({
        where: {
          userId: auth.userId,
          role: { in: ["LeagueOwner", "LeagueManager"] },
          leagueId: league.id,
        },
        select: { id: true },
      })
      if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (req.status !== "PENDING") {
      return NextResponse.json({ error: "Request was already resolved" }, { status: 409 })
    }

    const parsed = resolveSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "action must be approve or deny" }, { status: 400 })
    }
    const approved = parsed.data.action === "approve"

    await prisma.$transaction(async (tx: any) => {
      await tx.rosterChangeRequest.update({
        where: { id: req.id },
        data: {
          status: approved ? "APPROVED" : "DENIED",
          resolvedById: auth.userId,
          resolutionNote: parsed.data.note ?? null,
          resolvedAt: new Date(),
        },
      })
      if (approved) {
        // One-shot window: unlocked now, re-locked by the club's next save
        await tx.seasonRoster.update({
          where: { id: req.roster.id },
          data: { isLocked: false },
        })
      }
      await notify(tx, {
        userId: req.requestedById,
        type: approved ? "roster_change_approved" : "roster_change_denied",
        title: approved ? "Roster change approved" : "Roster change denied",
        message: approved
          ? `${league.name} approved your roster change for ${req.roster.season.label} — the roster is unlocked until you save your changes.${parsed.data.note ? ` Note: ${parsed.data.note}` : ""}`
          : `${league.name} denied your roster change for ${req.roster.season.label}.${parsed.data.note ? ` Note: ${parsed.data.note}` : ""}`,
        link: `/clubs/${req.roster.teamSubmission.team.tenantId}/teams/${req.roster.teamSubmission.team.id}/league-rosters`,
        referenceId: req.id,
        referenceType: "RosterChangeRequest",
      })
    })

    return NextResponse.json({ success: true, status: approved ? "APPROVED" : "DENIED" })
  } catch (error) {
    console.error("Roster request resolve error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
