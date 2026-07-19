import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"

// Never touch SMTP/Twilio in tests
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
  appBaseUrl: () => "http://localhost:3000",
  escapeHtml: (s: string) => s,
  transactionalFooter: () => "",
}))

import {
  completeClaim,
  getClaimOptions,
  issueCompletionToken,
  startClaim,
  verifyClaimCode,
} from "./claim-v2"

/**
 * Club claiming v2 (owner 2026-07-18 settled flow): anonymous claim → code
 * to the contact ON FILE → completion token + 14-day reservation → token
 * redemption binds ownership to a USER. Paper-proof path → admin issues the
 * same token.
 */

const RUN = "claimv2test"
let tenantId: string
let bareTenantId: string
let userId: string

beforeAll(async () => {
  const tenant = await (prisma as any).tenant.create({
    data: {
      name: `Claim V2 Test Club ${RUN}`,
      slug: `claim-v2-test-${RUN}`,
      status: "UNCLAIMED",
      contactEmail: `office@${RUN}.example.com`,
      city: "Testville",
    },
  })
  tenantId = tenant.id
  const bare = await (prisma as any).tenant.create({
    data: {
      name: `Claim V2 Bare Club ${RUN}`,
      slug: `claim-v2-bare-${RUN}`,
      status: "UNCLAIMED",
    },
  })
  bareTenantId = bare.id
  const user = await (prisma as any).user.create({
    data: {
      email: `claimer@${RUN}.example.com`,
      firstName: "Claire",
      lastName: "Claimer",
      passwordHash: "x",
    },
  })
  userId = user.id
})

afterAll(async () => {
  await (prisma as any).clubClaim.deleteMany({
    where: { tenantId: { in: [tenantId, bareTenantId] } },
  })
  await (prisma as any).auditLog.deleteMany({ where: { tenantId: { in: [tenantId, bareTenantId] } } })
  await (prisma as any).userRole.deleteMany({ where: { userId } })
  await (prisma as any).notification.deleteMany({ where: { userId } })
  await (prisma as any).tenant.deleteMany({ where: { id: { in: [tenantId, bareTenantId] } } })
  await (prisma as any).user.delete({ where: { id: userId } })
})

describe("claim options", () => {
  it("masks the contact on file and always offers the proof path", async () => {
    const opts = await getClaimOptions(tenantId)
    expect(opts?.claimable).toBe(true)
    const email = opts!.channels.find((c: any) => c.channel === "email")
    expect(email?.hint).toMatch(/^of•••@/)
    expect(email?.hint).not.toContain("office@")
    expect(opts!.channels.some((c: any) => c.channel === "proof")).toBe(true)
    // SMS is dark until the owner supplies Twilio creds
    expect(opts!.channels.some((c: any) => c.channel === "sms")).toBe(false)
  })

  it("a club with no contact on file only offers proof", async () => {
    const opts = await getClaimOptions(bareTenantId)
    expect(opts!.channels.map((c: any) => c.channel)).toEqual(["proof"])
  })
})

describe("email-code path", () => {
  let claimId: string
  let token: string

  it("start sends a code to the contact on file (anonymous, no user)", async () => {
    const res = await startClaim({
      tenantId,
      channel: "email",
      corrections: { website: "https://newsite.example.com" },
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    claimId = res.claimId
    expect(res.sentTo).toMatch(/^of•••@/)
    const row = await (prisma as any).clubClaim.findUnique({ where: { id: claimId } })
    expect(row.userId).toBeNull()
    expect(row.verificationCode).toMatch(/^\d{6}$/)
    expect(row.contactPoint).toBe(`office@${RUN}.example.com`)
  })

  it("blocks a second claim while one is live", async () => {
    const res = await startClaim({ tenantId, channel: "email" })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe("IN_PROGRESS")
  })

  it("wrong codes count attempts; the right code issues a completion token", async () => {
    const bad = await verifyClaimCode({ claimId, code: "000000" })
    expect(bad.ok).toBe(false)

    const row = await (prisma as any).clubClaim.findUnique({ where: { id: claimId } })
    expect(row.attempts).toBe(1)

    const good = await verifyClaimCode({ claimId, code: row.verificationCode })
    expect(good.ok).toBe(true)
    if (!good.ok) return
    token = good.completionToken
    expect(new Date(good.expiresAt).getTime()).toBeGreaterThan(
      Date.now() + 13 * 24 * 3600_000 // ~14-day reservation
    )
    const verified = await (prisma as any).clubClaim.findUnique({ where: { id: claimId } })
    expect(verified.status).toBe("VERIFIED_UNBOUND")
  })

  it("redeeming the token binds ownership to the USER and applies corrections", async () => {
    const res = await completeClaim({ token, userId })
    expect(res.ok).toBe(true)

    const [tenant, role, claim] = await Promise.all([
      (prisma as any).tenant.findUnique({
        where: { id: tenantId },
        select: { status: true, website: true },
      }),
      (prisma as any).userRole.findFirst({
        where: { userId, role: "ClubOwner", tenantId },
      }),
      (prisma as any).clubClaim.findUnique({ where: { id: claimId } }),
    ])
    expect(tenant.status).toBe("ACTIVE")
    expect(tenant.website).toBe("https://newsite.example.com") // claim-time correction
    expect(role).toBeTruthy()
    expect(claim.status).toBe("APPROVED")
    expect(claim.userId).toBe(userId)
  })

  it("a used token cannot be redeemed twice", async () => {
    const res = await completeClaim({ token, userId })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe("BAD_STATE")
  })
})

describe("paper-proof path", () => {
  it("no contact on file → PENDING for admin; expired reservations reject", async () => {
    const res = await startClaim({
      tenantId: bareTenantId,
      channel: "proof",
      claimantEmail: `owner@${RUN}.example.com`,
      proofNote: "I run the club website and can add any page you ask for.",
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const row = await (prisma as any).clubClaim.findUnique({ where: { id: res.claimId } })
    expect(row.status).toBe("PENDING")
    expect(row.method).toBe("PROOF")

    // admin approval issues the same completion token
    const { token } = await issueCompletionToken(res.claimId)

    // simulate the 14 days lapsing
    await (prisma as any).clubClaim.update({
      where: { id: res.claimId },
      data: { completionExpiresAt: new Date(Date.now() - 1000) },
    })
    const expired = await completeClaim({ token, userId })
    expect(expired.ok).toBe(false)
    if (!expired.ok) expect(expired.code).toBe("EXPIRED")
  })
})
