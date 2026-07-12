import { notFound, redirect } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * Custom-domain resolver (seo-strategy §6c). The middleware rewrites the
 * root path of an unknown host here when CUSTOM_DOMAINS_ENABLED=1 — the DB
 * lookup lives in this server component because edge middleware can't use
 * Prisma. v1 = mirror mode: the club's domain is a vanity front door that
 * redirects to the canonical club page. v2 (customDomainCanonical) will
 * render in place instead.
 */
export default async function DomainResolverPage({ params }: { params: { host: string } }) {
  const host = decodeURIComponent(params.host).toLowerCase()
  const tenant = await prisma.tenant.findFirst({
    where: {
      customDomain: host,
      customDomainVerifiedAt: { not: null },
      status: { in: ["ACTIVE", "UNCLAIMED"] },
    },
    select: { slug: true },
  })
  if (!tenant) notFound()
  redirect(`/club/${tenant.slug}`)
}
