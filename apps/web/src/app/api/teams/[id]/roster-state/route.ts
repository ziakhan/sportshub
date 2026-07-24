import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canActOnTeam } from "@/lib/authz/team-scope"
import { rosterState } from "@/lib/teams/roster-commitment"

export const dynamic = "force-dynamic"

/**
 * Roster-commitment snapshot for staff composing an offer (owner 2026-07-24,
 * QA-103) — cap + how many offers are already out, so the make-offer dialog
 * can nudge staff before they over-offer past the cap.
 * GET /api/teams/[id]/roster-state
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      select: { id: true, tenantId: true },
    })
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })

    const allowed = await canActOnTeam(auth.userId, team.tenantId, team.id)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const state = await rosterState(prisma, team.id)
    if (!state) return NextResponse.json({ error: "Team not found" }, { status: 404 })

    const openOffers = await prisma.offer.count({
      where: { teamId: team.id, status: "PENDING" },
    })

    return NextResponse.json({
      committed: state.committed,
      provisional: state.provisional,
      cap: state.cap,
      isFull: state.isFull,
      openOffers,
    })
  } catch (error) {
    console.error("Roster state fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
