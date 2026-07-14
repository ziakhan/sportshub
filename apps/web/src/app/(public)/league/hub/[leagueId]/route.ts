import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { siteUrl } from "@/lib/site"

export const dynamic = "force-dynamic"

/** Canonical league-id → current season hub redirect. Lets anything that
 * knows only a leagueId (payments rows, notifications) link the public hub.
 * Full league-id-canonical URLs land with IA phase N2. */
export async function GET(request: NextRequest, { params }: { params: { leagueId: string } }) {
  const season = await (prisma as any).season.findFirst({
    where: { leagueId: params.leagueId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })
  return NextResponse.redirect(new URL(season ? `/league/${season.id}` : "/leagues", siteUrl()))
}
