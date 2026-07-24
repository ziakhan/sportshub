import { prisma } from "@youthbasketballhub/db"
import { notifyMany } from "@/lib/notifications"

/**
 * Roster commitment model (owner 2026-07-24, QA-103):
 *  - Team.maxPlayers caps COMMITTED players, never offers — clubs over-offer
 *    on purpose (declines and no-shows are normal) and communicate that in
 *    the offer message.
 *  - PAYMENT = COMMITMENT. An accepted offer whose fee is still owed is
 *    provisional ("your spot is not held until payment is made"); paid,
 *    waived, or free = committed.
 *  - When commitments reach the cap: staff and every family still holding a
 *    pending/provisional offer get told the team is full.
 */

/** Committed = active roster minus accepted-but-unpaid (provisional) offers. */
export async function committedCount(db: any, teamId: string): Promise<number> {
  const [active, provisional] = await Promise.all([
    db.teamPlayer.count({ where: { teamId, status: "ACTIVE" } }),
    provisionalOfferCount(db, teamId),
  ])
  return Math.max(0, active - provisional)
}

/**
 * Provisional offers = ACCEPTED offers on this team whose obligation
 * (referenceType "Offer") is still PENDING/PARTIALLY_PAID.
 */
async function provisionalOfferCount(db: any, teamId: string): Promise<number> {
  const accepted = await db.offer.findMany({
    where: { teamId, status: "ACCEPTED" },
    select: { id: true },
  })
  if (accepted.length === 0) return 0
  return db.paymentObligation.count({
    where: {
      referenceType: "Offer",
      referenceId: { in: accepted.map((o: { id: string }) => o.id) },
      status: { in: ["PENDING", "PARTIALLY_PAID"] },
    },
  })
}

export async function rosterState(db: any, teamId: string) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      maxPlayers: true,
      tenantId: true,
      showRosterFill: true,
      tenant: { select: { showRosterFillDefault: true } },
    },
  })
  if (!team) return null
  const [active, provisional] = await Promise.all([
    db.teamPlayer.count({ where: { teamId, status: "ACTIVE" } }),
    provisionalOfferCount(db, teamId),
  ])
  const committed = Math.max(0, active - provisional)
  return {
    team,
    committed,
    provisional,
    cap: team.maxPlayers as number | null,
    isFull: team.maxPlayers != null && committed >= team.maxPlayers,
    showFill: (team.showRosterFill ?? team.tenant?.showRosterFillDefault ?? false) as boolean,
  }
}

/**
 * Fire the "team is full" notifications when commitments have reached the
 * cap. Deduped per team via an existing team_full notification. Best-effort:
 * callers never await failure into their own flow.
 */
export async function notifyIfTeamFull(teamId: string): Promise<void> {
  try {
    const state = await rosterState(prisma, teamId)
    if (!state || !state.isFull) return

    const already = await prisma.notification.findFirst({
      where: { type: "team_full" as any, referenceId: teamId },
      select: { id: true },
    })
    if (already) return

    // Staff circle: club owner/manager + this team's staff.
    const staff = await prisma.userRole.findMany({
      where: {
        OR: [
          { tenantId: state.team.tenantId, role: { in: ["ClubOwner", "ClubManager"] as any } },
          { teamId, role: { in: ["Staff", "TeamManager"] as any } },
        ],
      },
      select: { userId: true },
      distinct: ["userId"],
    })
    await notifyMany(
      prisma,
      staff.map((r) => r.userId),
      {
        type: "team_full" as any,
        title: "Roster full",
        message: `${state.team.name} has reached its cap of ${state.cap} committed players.`,
        link: `/clubs/${state.team.tenantId}/teams`,
        referenceId: teamId,
        referenceType: "Team",
      }
    )

    // Families still holding open offers: their spot race is over.
    const openOffers = await (prisma as any).offer.findMany({
      where: { teamId, status: "PENDING" },
      select: { id: true, player: { select: { parentId: true } } },
    })
    const parentIds: string[] = [...new Set(openOffers.map((o: any) => o.player.parentId))] as string[]
    if (parentIds.length > 0) {
      await notifyMany(prisma, parentIds, {
        type: "team_full" as any,
        title: "Team is now full",
        message: `${state.team.name} has filled its committed roster. Contact the club about waitlist options.`,
        link: "/offers",
        referenceId: teamId,
        referenceType: "Team",
      })
    }
  } catch (error) {
    console.error("notifyIfTeamFull failed:", error)
  }
}
