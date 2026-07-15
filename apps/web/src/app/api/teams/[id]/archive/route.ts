import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getActiveSeasonInvolvement, lifecycleLockReason } from "@/lib/teams/lifecycle"

export const dynamic = "force-dynamic"

/**
 * Archive / unarchive a team (docs/season-continuity-plan.md §2).
 * POST /api/teams/[id]/archive  { archived: boolean }
 *
 * Archived teams disappear from active lists; games, stats and chat stay as
 * read-only history. Unarchive is allowed (a club may archive by mistake).
 */

const archiveSchema = z.object({ archived: z.boolean() })

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      select: { id: true, tenantId: true, archivedAt: true },
    })
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })

    // ClubOwner/ClubManager of the team's tenant, or PlatformAdmin
    const role = await prisma.userRole.findFirst({
      where: {
        userId: auth.userId,
        OR: [
          { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
          { role: "PlatformAdmin" },
        ],
      },
      select: { id: true },
    })
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = archiveSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "archived (boolean) is required" }, { status: 400 })
    }

    // Mid-season teams can't be archived (owner 2026-07-15) — the league is
    // counting on this roster. Unarchive stays allowed.
    if (parsed.data.archived) {
      const reason = lifecycleLockReason(await getActiveSeasonInvolvement(team.id))
      if (reason) return NextResponse.json({ error: reason }, { status: 409 })
    }

    const updated = await prisma.team.update({
      where: { id: team.id },
      data: { archivedAt: parsed.data.archived ? (team.archivedAt ?? new Date()) : null },
      select: { id: true, archivedAt: true },
    })

    return NextResponse.json({ id: updated.id, archived: !!updated.archivedAt })
  } catch (error) {
    console.error("Team archive toggle error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
