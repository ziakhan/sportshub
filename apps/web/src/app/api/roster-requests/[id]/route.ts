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
        additions: true,
        removals: true,
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
      const additions: string[] = Array.isArray(req.additions) ? req.additions : []
      const removals: string[] = Array.isArray(req.removals) ? req.removals : []
      const structured = additions.length + removals.length > 0
      if (approved && structured) {
        // Structured request (2026-07-15): approval APPLIES the changes —
        // the roster stays locked, no unlock window.
        if (removals.length > 0) {
          await tx.seasonRosterPlayer.deleteMany({
            where: { rosterId: req.roster.id, playerId: { in: removals } },
          })
        }
        if (additions.length > 0) {
          // Same-season eligibility re-check at apply time
          const conflict = await tx.seasonRosterPlayer.findFirst({
            where: {
              playerId: { in: additions },
              roster: { seasonId: req.roster.season.id, id: { not: req.roster.id } },
            },
            select: { playerId: true },
          })
          if (conflict) {
            throw new Error(
              "APPLY_CONFLICT: a requested player is already rostered elsewhere this season"
            )
          }
          const teamPlayers = await tx.teamPlayer.findMany({
            where: {
              teamId: req.roster.teamSubmission.team.id,
              playerId: { in: additions },
              status: "ACTIVE",
            },
            select: {
              playerId: true,
              jerseyNumber: true,
              player: { select: { position: true } },
            },
          })
          if (teamPlayers.length !== additions.length) {
            throw new Error("APPLY_CONFLICT: a requested player is no longer on the club roster")
          }
          const already = await tx.seasonRosterPlayer.findMany({
            where: { rosterId: req.roster.id, playerId: { in: additions } },
            select: { playerId: true },
          })
          const skip = new Set(already.map((a: any) => a.playerId))
          const toCreate = teamPlayers.filter((tp: any) => !skip.has(tp.playerId))
          if (toCreate.length > 0) {
            await tx.seasonRosterPlayer.createMany({
              data: toCreate.map((tp: any) => ({
                rosterId: req.roster.id,
                playerId: tp.playerId,
                jerseyNumber: tp.jerseyNumber,
                position: tp.player?.position ?? null,
              })),
            })
          }
        }
      } else if (approved) {
        // Legacy free-text ask: one-shot window — unlocked now, re-locked by
        // the club's next save
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
          ? Array.isArray(req.additions) || Array.isArray(req.removals)
            ? `${league.name} approved and applied your ${req.roster.season.label} roster change (${Array.isArray(req.additions) ? req.additions.length : 0} added, ${Array.isArray(req.removals) ? req.removals.length : 0} removed).${parsed.data.note ? ` Note: ${parsed.data.note}` : ""}`
            : `${league.name} approved your roster change for ${req.roster.season.label} — the roster is unlocked until you save your changes.${parsed.data.note ? ` Note: ${parsed.data.note}` : ""}`
          : `${league.name} denied your roster change for ${req.roster.season.label}.${parsed.data.note ? ` Note: ${parsed.data.note}` : ""}`,
        link: `/clubs/${req.roster.teamSubmission.team.tenantId}/teams/${req.roster.teamSubmission.team.id}/league-rosters`,
        referenceId: req.id,
        referenceType: "RosterChangeRequest",
      })
    })

    return NextResponse.json({ success: true, status: approved ? "APPROVED" : "DENIED" })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("APPLY_CONFLICT:")) {
      return NextResponse.json(
        { error: error.message.replace("APPLY_CONFLICT: ", ""), requestStillPending: true },
        { status: 409 }
      )
    }
    console.error("Roster request resolve error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
