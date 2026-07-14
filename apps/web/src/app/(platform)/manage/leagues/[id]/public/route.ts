import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { siteUrl } from "@/lib/site"

export const dynamic = "force-dynamic"

/** The league operator's door to the PUBLIC league hub (audit GAP-027/042). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const season = await (prisma as any).season.findFirst({
    where: { leagueId: params.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })
  return NextResponse.redirect(new URL(season ? `/league/${season.id}` : "/leagues", siteUrl()))
}
