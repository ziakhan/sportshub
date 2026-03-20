import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * Finalize team roster - assign jersey numbers based on preferences (first-come-first-served)
 * POST /api/teams/[id]/finalize
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

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
      return NextResponse.json(
        { error: "No accepted offers to finalize" },
        { status: 400 }
      )
    }

    // Track assigned jersey numbers
    const assignedNumbers = new Set<number>()

    // Get any existing jersey numbers on the team (from previously finalized players)
    const existingPlayers = await prisma.teamPlayer.findMany({
      where: { teamId: params.id, jerseyNumber: { not: null } },
      select: { jerseyNumber: true },
    })
    existingPlayers.forEach((p: any) => {
      if (p.jerseyNumber !== null) assignedNumbers.add(p.jerseyNumber)
    })

    // Assign jersey numbers based on preferences
    const assignments: { offerId: string; playerId: string; playerName: string; jerseyNumber: number | null }[] = []

    for (const offer of acceptedOffers) {
      let assignedNumber: number | null = null

      // Try preferences in order
      const prefs = [offer.jerseyPref1, offer.jerseyPref2, offer.jerseyPref3].filter(
        (n): n is number => n !== null
      )

      for (const pref of prefs) {
        if (!assignedNumbers.has(pref)) {
          assignedNumber = pref
          assignedNumbers.add(pref)
          break
        }
      }

      assignments.push({
        offerId: offer.id,
        playerId: offer.player.id,
        playerName: `${offer.player.firstName} ${offer.player.lastName}`,
        jerseyNumber: assignedNumber,
      })
    }

    // Update TeamPlayer records with assigned jersey numbers
    await prisma.$transaction(async (tx: any) => {
      for (const assignment of assignments) {
        if (assignment.jerseyNumber !== null) {
          await tx.offer.update({
            where: { id: assignment.offerId },
            data: { /* mark as processed - no extra field needed, status already ACCEPTED */ },
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
          await tx.notification.create({
            data: {
              userId: offer.player.parentId,
              type: "jersey_assigned",
              title: "Jersey Number Assigned",
              message: `${assignment!.playerName} has been assigned jersey #${assignment!.jerseyNumber} on ${team.name}.`,
              link: `/offers`,
              referenceId: offer.id,
              referenceType: "Offer",
            },
          })
        }
      }
    })

    // Expire any remaining pending offers for this team
    await prisma.offer.updateMany({
      where: {
        teamId: params.id,
        status: "PENDING",
      },
      data: { status: "EXPIRED" },
    })

    return NextResponse.json({
      success: true,
      assignments: assignments.map((a: any) => ({
        playerName: a.playerName,
        jerseyNumber: a.jerseyNumber,
        status: a.jerseyNumber !== null ? "assigned" : "no_preference_available",
      })),
      expiredPendingOffers: true,
    })
  } catch (error) {
    console.error("Finalize team error:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
