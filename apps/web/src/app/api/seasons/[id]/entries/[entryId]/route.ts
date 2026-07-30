import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { notify } from "@/lib/notifications"

export const dynamic = "force-dynamic"

const patchSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) })

/** PATCH — league approves/rejects a club's season entry. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; entryId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const entry = await (prisma as any).clubSeasonEntry.findFirst({
      where: { id: params.entryId, seasonId: params.id },
      select: {
        id: true,
        tenantId: true,
        tenant: { select: { name: true } },
        season: {
          select: { id: true, label: true, leagueId: true, league: { select: { id: true, name: true, ownerId: true } } },
        },
      },
    })
    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

    const allowed =
      auth.isPlatformAdmin ||
      entry.season.league.ownerId === auth.userId ||
      !!(await prisma.userRole.findFirst({
        where: { userId: auth.userId, leagueId: entry.season.leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
        select: { id: true },
      }))
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 })

    await (prisma as any).clubSeasonEntry.update({
      where: { id: entry.id },
      data: { status: parsed.data.status },
    })

    const clubOwner = await prisma.userRole.findFirst({
      where: { tenantId: entry.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
      select: { userId: true },
    })
    if (clubOwner) {
      await notify(prisma, {
        userId: clubOwner.userId,
        type: "team_submitted",
        title: parsed.data.status === "APPROVED" ? "Season entry approved" : "Season entry declined",
        message: `${entry.season.league.name} ${parsed.data.status === "APPROVED" ? "approved" : "declined"} ${entry.tenant.name}'s entry to ${entry.season.label}${parsed.data.status === "APPROVED" ? " — you can now register your teams" : ""}.`,
        link: `/browse-leagues`,
        referenceId: entry.id,
        referenceType: "ClubSeasonEntry",
      })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Entry decide error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
