import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * Caddy on-demand-TLS "ask" endpoint (seo-strategy §6c): before issuing a
 * certificate for a hostname, Caddy calls this; 200 = issue, 404 = refuse.
 * Only verified tenant custom domains get certs — prevents strangers from
 * pointing random domains at the box and minting certificates.
 */
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain")?.toLowerCase().trim()
  if (!domain) {
    return NextResponse.json({ error: "domain required" }, { status: 400 })
  }
  const tenant = await prisma.tenant.findFirst({
    where: { customDomain: domain, customDomainVerifiedAt: { not: null } },
    select: { id: true },
  })
  if (!tenant) {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
