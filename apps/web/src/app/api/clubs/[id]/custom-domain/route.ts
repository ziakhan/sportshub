import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import dns from "node:dns/promises"
import { getSessionUserId } from "@/lib/auth-helpers"
import { isOurHost } from "@/lib/domains"

export const dynamic = "force-dynamic"

/**
 * Custom-domain plumbing (seo-strategy §6c) — inert until launch:
 * - PlatformAdmin can always set/verify (lets us pilot per-club).
 * - ClubOwner/ClubManager additionally require CUSTOM_DOMAINS_ENABLED=1.
 * - Verification requires CUSTOM_DOMAIN_TARGET (CNAME host) and/or
 *   CUSTOM_DOMAIN_TARGET_IP (apex A record) env — unset in dev, so the
 *   Verify path answers 503 until go-live infra exists.
 */

const HOSTNAME_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/

const patchSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, ""))
    .refine((d) => HOSTNAME_RE.test(d), "Enter a bare domain like www.yourclub.ca")
    .nullable(),
})

async function authorize(userId: string, tenantId: string) {
  const roles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ tenantId, role: { in: ["ClubOwner", "ClubManager"] } }, { role: "PlatformAdmin" }],
    },
    select: { role: true },
  })
  const isAdmin = roles.some((r) => r.role === "PlatformAdmin")
  const isClubStaff = roles.some((r) => r.role !== "PlatformAdmin")
  if (!isAdmin && !isClubStaff) return { ok: false as const, status: 403, error: "Forbidden" }
  if (!isAdmin && process.env.CUSTOM_DOMAINS_ENABLED !== "1") {
    return { ok: false as const, status: 403, error: "Custom domains are not enabled yet" }
  }
  return { ok: true as const }
}

/** Set or clear the club's custom domain (clears verification on change). */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getSessionUserId()
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const authz = await authorize(auth.userId, params.id)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  let domain: string | null
  try {
    domain = patchSchema.parse(await request.json()).domain
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message ?? "Invalid domain" }, { status: 400 })
    }
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  // Never allow claiming the platform's own hosts.
  const ownHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").hostname
    } catch {
      return "localhost"
    }
  })()
  // A club can never claim one of the platform's own domains (lib/domains).
  if (domain && (domain === ownHost || isOurHost(domain))) {
    return NextResponse.json({ error: "That domain belongs to the platform" }, { status: 400 })
  }

  if (domain) {
    const taken = await prisma.tenant.findFirst({
      where: { customDomain: domain, id: { not: params.id } },
      select: { id: true },
    })
    if (taken) return NextResponse.json({ error: "Domain is already in use" }, { status: 409 })
  }

  const tenant = await prisma.tenant.update({
    where: { id: params.id },
    data: { customDomain: domain, customDomainVerifiedAt: null },
    select: { customDomain: true },
  })
  return NextResponse.json({ success: true, customDomain: tenant.customDomain, verified: false })
}

/** Verify DNS points at us; sets customDomainVerifiedAt on success. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getSessionUserId()
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const authz = await authorize(auth.userId, params.id)
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    select: { customDomain: true },
  })
  if (!tenant?.customDomain) {
    return NextResponse.json({ error: "Set a domain first" }, { status: 400 })
  }

  const targetHost = process.env.CUSTOM_DOMAIN_TARGET?.toLowerCase()
  const targetIp = process.env.CUSTOM_DOMAIN_TARGET_IP
  if (!targetHost && !targetIp) {
    return NextResponse.json(
      { error: "Domain verification is not configured on this environment yet" },
      { status: 503 }
    )
  }

  let matched = false
  const evidence: string[] = []
  if (targetHost) {
    const cnames = await dns.resolveCname(tenant.customDomain).catch(() => [] as string[])
    evidence.push(...cnames.map((c) => `CNAME ${c}`))
    matched = cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === targetHost)
  }
  if (!matched && targetIp) {
    const ips = await dns.resolve4(tenant.customDomain).catch(() => [] as string[])
    evidence.push(...ips.map((ip) => `A ${ip}`))
    matched = ips.includes(targetIp)
  }

  if (!matched) {
    return NextResponse.json(
      { verified: false, found: evidence, error: "DNS does not point at the platform yet (propagation can take up to a day)" },
      { status: 409 }
    )
  }

  await prisma.tenant.update({
    where: { id: params.id },
    data: { customDomainVerifiedAt: new Date() },
  })
  return NextResponse.json({ verified: true, found: evidence })
}
