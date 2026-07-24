import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { tenantSlugFromHost } from "@/lib/domains"

export const dynamic = "force-dynamic"

/**
 * Caddy on-demand-TLS "ask" endpoint (seo-strategy §6c): before issuing a
 * certificate for a hostname, Caddy calls this; 200 = issue, 404 = refuse.
 * Certs are minted ONLY for (a) club vanity subdomains of our own domains
 * whose slug is a real tenant (wildcard DNS live 2026-07-24), or (b)
 * verified tenant custom domains. Anything else is refused — strangers
 * can't point random names at the box and farm certificates.
 */
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain")?.toLowerCase().trim()
  if (!domain) {
    return NextResponse.json({ error: "domain required" }, { status: 400 })
  }

  // Club vanity subdomain (kings.sportshubone.com) → slug must exist.
  const slug = tenantSlugFromHost(domain)
  if (slug) {
    const bySlug = await prisma.tenant.findFirst({
      where: { slug, status: { in: ["ACTIVE", "UNCLAIMED"] as any } },
      select: { id: true },
    })
    return bySlug
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ ok: false }, { status: 404 })
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
