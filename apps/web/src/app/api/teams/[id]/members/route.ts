import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembers, getChatMembership } from "@/lib/teams/chat-access"
import { dmRoleOnTeam } from "@/lib/messages/dm"

export const dynamic = "force-dynamic"

/**
 * GET /api/teams/[id]/members — the team's adult chat members (staff +
 * families) for the DM people-picker. Members only. `canDm` reflects the
 * safeguarding rule for the CURRENT viewer (players only reach staff).
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const [members, myRole] = await Promise.all([
      getChatMembers(membership.teamId, membership.tenantId),
      dmRoleOnTeam(membership.teamId, auth.userId),
    ])
    const playerOnly = myRole === "self-player"

    return NextResponse.json({
      teamId: membership.teamId,
      teamName: membership.teamName,
      staff: members.staff
        .filter((s) => s.userId !== auth.userId)
        .map((s) => ({ userId: s.userId, name: s.name, canDm: true })),
      families: members.families
        .filter((f) => f.userId !== auth.userId)
        .map((f) => ({
          userId: f.userId,
          name: f.name,
          playerNames: f.playerNames,
          canDm: !playerOnly,
        })),
    })
  } catch (error) {
    console.error("Team members error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
