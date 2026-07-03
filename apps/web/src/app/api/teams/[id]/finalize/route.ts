import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { notify } from "@/lib/notifications"
import { assignJerseys } from "@/lib/teams/assign-jerseys"

export const dynamic = "force-dynamic"

/** G1: fewer than this and a game lineup can't be fielded — warn, don't block. */
const MIN_ROSTER_SIZE = 5

/**
 * Finalize team roster - assign jersey numbers based on preferences (first-come-first-served)
 * POST /api/teams/[id]/finalize
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    // Get the team
    const team = await prisma.team.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, tenantId: true },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Verify club permission
    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId,
        OR: [
          { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
          { role: "PlatformAdmin" },
        ],
      },
    })

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all accepted offers for this team, ordered by respondedAt (first-come-first-served)
    const acceptedOffers = await prisma.offer.findMany({
      where: {
        teamId: params.id,
        status: "ACCEPTED",
      },
      include: {
        player: {
          select: { id: true, parentId: true, firstName: true, lastName: true },
        },
      },
      orderBy: { respondedAt: "asc" },
    })

    if (acceptedOffers.length === 0) {
      return NextResponse.json({ error: "No accepted offers to finalize" }, { status: 400 })
    }

    // Numbers already taken by previously finalized players on this team
    const existingPlayers = await prisma.teamPlayer.findMany({
      where: { teamId: params.id, jerseyNumber: { not: null } },
      select: { jerseyNumber: true },
    })
    const takenNumbers = existingPlayers
      .map((p: any) => p.jerseyNumber)
      .filter((n: number | null): n is number => n !== null)

    // Pure allocation — first-come-first-served over stated preferences
    const assignments = assignJerseys(
      acceptedOffers.map((offer: any) => ({
        offerId: offer.id,
        playerId: offer.player.id,
        playerName: `${offer.player.firstName} ${offer.player.lastName}`,
        jerseyPrefs: [offer.jerseyPref1, offer.jerseyPref2, offer.jerseyPref3],
      })),
      takenNumbers
    )

    // Update TeamPlayer records with assigned jersey numbers
    await prisma.$transaction(async (tx: any) => {
      for (const assignment of assignments) {
        if (assignment.jerseyNumber !== null) {
          await tx.offer.update({
            where: { id: assignment.offerId },
            data: {
              /* mark as processed - no extra field needed, status already ACCEPTED */
            },
          })

          await tx.teamPlayer.updateMany({
            where: {
              teamId: params.id,
              playerId: assignment.playerId,
            },
            data: {
              jerseyNumber: assignment.jerseyNumber,
            },
          })
        }
      }

      // Notify parents about jersey assignments
      for (const offer of acceptedOffers) {
        const assignment = assignments.find((a: any) => a.offerId === offer.id)
        if (assignment?.jerseyNumber !== null) {
          await notify(tx, {
            userId: offer.player.parentId,
            type: "jersey_assigned",
            title: "Jersey Number Assigned",
            message: `${assignment!.playerName} has been assigned jersey #${assignment!.jerseyNumber} on ${team.name}.`,
            link: `/offers`,
            referenceId: offer.id,
            referenceType: "Offer",
          })
        }
      }

      // Expire remaining pending offers atomically with the jersey writes —
      // previously this ran AFTER the transaction, leaving a partial-write
      // window (jerseys assigned but stale offers still pending on failure).
      await tx.offer.updateMany({
        where: {
          teamId: params.id,
          status: "PENDING",
        },
        data: { status: "EXPIRED" },
      })
    })

    // G1: under-roster warning (non-blocking, by owner decision) — accepted
    // offers upsert TeamPlayer rows, so the ACTIVE count is the final roster.
    const activeRosterCount = await prisma.teamPlayer.count({
      where: { teamId: params.id, status: "ACTIVE" },
    })
    const warnings: string[] = []
    if (activeRosterCount < MIN_ROSTER_SIZE) {
      warnings.push(
        `Roster has ${activeRosterCount} player(s) — below the minimum of ${MIN_ROSTER_SIZE} needed to field a lineup.`
      )
    }

    return NextResponse.json({
      success: true,
      assignments: assignments.map((a: any) => ({
        playerName: a.playerName,
        jerseyNumber: a.jerseyNumber,
        status: a.jerseyNumber !== null ? "assigned" : "no_preference_available",
      })),
      expiredPendingOffers: true,
      warnings,
    })
  } catch (error) {
    console.error("Finalize team error:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
