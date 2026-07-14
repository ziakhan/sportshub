import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { siteUrl } from "@/lib/site"

export const dynamic = "force-dynamic"

/** The club operator's door to their own PUBLIC page (audit GAP-007/027). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const tenant = await (prisma as any).tenant.findUnique({
    where: { id: params.id },
    select: { slug: true },
  })
  return NextResponse.redirect(new URL(tenant ? `/club/${tenant.slug}` : "/club", siteUrl()))
}
