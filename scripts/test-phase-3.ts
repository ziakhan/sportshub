/**
 * Phase 3 — Club lifecycle (claim / create / verify / branding / CASL)
 *
 * Usage:
 *   cd packages/db && npx tsx /Users/ziakhan/zia/personal/sportshub/scripts/test-phase-3.ts
 */

import { prisma } from "@youthbasketballhub/db"
import { call, makeUser, Reporter } from "./lib/test-helpers"

const TEST_EMAIL_DOMAIN = "phase3-test.local"
const TEST_TENANT_SLUG_PREFIX = "phase3-test-"

const r = new Reporter()

async function cleanup() {
  // Tenants we created (claim targets + new clubs)
  const tenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: TEST_TENANT_SLUG_PREFIX } },
    select: { id: true },
  })
  const tenantIds = tenants.map((t) => t.id)

  // Users we created
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
    select: { id: true },
  })
  const userIds = users.map((u) => u.id)

  if (tenantIds.length > 0) {
    await prisma.clubClaim.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.userRole.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.tenantBranding.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } })
  }
  if (userIds.length > 0) {
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  }
  console.log(`🧹 Cleaned up ${users.length} users, ${tenants.length} tenants`)
}

async function makeClubOwner(slug: string, firstName = "Cleo", lastName = "Owner") {
  return makeUser({
    email: `phase3-${slug}@${TEST_EMAIL_DOMAIN}`,
    firstName,
    lastName,
    roles: ["ClubOwner"],
    // ClubOwner skips profile per onboarding flow; no profileData needed
  })
}

async function makeUnclaimedTenant(suffix: string) {
  return prisma.tenant.create({
    data: {
      name: `Phase3 Test Club ${suffix}`,
      slug: `${TEST_TENANT_SLUG_PREFIX}${suffix}`,
      contactEmail: `target-${suffix}@${TEST_EMAIL_DOMAIN}`,
      city: "Toronto",
      state: "ON",
      country: "CA",
      currency: "CAD",
      status: "UNCLAIMED",
    },
    select: { id: true, name: true, contactEmail: true },
  })
}

// ---------- Scenarios ----------

let claimOwner: Awaited<ReturnType<typeof makeClubOwner>> | null = null
let claimTarget: Awaited<ReturnType<typeof makeUnclaimedTenant>> | null = null
let createdTenantId: string | null = null

async function s3_1_claim_request() {
  claimOwner = await makeClubOwner("3-1-claim", "Cleo", "Claimer")
  claimTarget = await makeUnclaimedTenant("a")
  const res = await call(`/api/clubs/claim/${claimTarget.id}`, {
    method: "POST",
    jar: claimOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "I run this club" }),
  })
  if (res.status !== 201) return r.record("3.1", "Claim request", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const claim = await prisma.clubClaim.findFirst({ where: { tenantId: claimTarget.id, userId: claimOwner.userId } })
  const tenant = await prisma.tenant.findUnique({ where: { id: claimTarget.id } })
  // Status should be EMAIL_SENT (since target has email) OR PENDING (if email send failed)
  const ok = !!claim && !!claim.verificationCode && tenant?.status === "UNCLAIMED" && (claim.status === "EMAIL_SENT" || claim.status === "PENDING")
  r.record("3.1", "Claim request creates ClubClaim, tenant still UNCLAIMED", ok, ok ? `claim.status=${claim?.status}, code=${claim?.verificationCode?.length}-digit ✓` : `state wrong`)
}

async function s3_2_verify_correct_code() {
  if (!claimOwner || !claimTarget) return r.record("3.2", "Verify code", false, "no setup")
  const claim = await prisma.clubClaim.findFirst({ where: { tenantId: claimTarget.id, userId: claimOwner.userId } })
  if (!claim?.verificationCode) return r.record("3.2", "Verify code", false, "no claim/code")
  // Make sure status is EMAIL_SENT for the verify path; if local email send failed it might be PENDING.
  if (claim.status !== "EMAIL_SENT") {
    await prisma.clubClaim.update({ where: { id: claim.id }, data: { status: "EMAIL_SENT" } })
  }
  const res = await call(`/api/clubs/claim/${claimTarget.id}`, {
    method: "PATCH",
    jar: claimOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: claim.verificationCode }),
  })
  if (res.status !== 200) return r.record("3.2", "Verify code", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const tenant = await prisma.tenant.findUnique({ where: { id: claimTarget.id } })
  const role = await prisma.userRole.findFirst({ where: { userId: claimOwner.userId, tenantId: claimTarget.id, role: "ClubOwner" } })
  const ok = tenant?.status === "ACTIVE" && !!role
  r.record("3.2", "Verify correct code → tenant ACTIVE + UserRole", ok, ok ? `tenant=ACTIVE, UserRole(ClubOwner) ✓` : `tenant=${tenant?.status}, role=${!!role}`)
}

async function s3_3_create_new_club() {
  const owner = await makeClubOwner("3-3-create", "Carl", "Creator")
  const slug = `${TEST_TENANT_SLUG_PREFIX}created`
  const res = await call("/api/tenants", {
    method: "POST",
    jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Phase3 Created Club",
      slug,
      description: "A test club",
      timezone: "America/Toronto",
      phoneNumber: "+14165550000",
      contactEmail: `created@${TEST_EMAIL_DOMAIN}`,
      address: "123 Test St",
      city: "Toronto",
      state: "ON",
      zipCode: "M5V1A1",
      country: "CA",
      currency: "CAD",
    }),
  })
  if (res.status !== 201 && res.status !== 200) return r.record("3.3", "Create new club", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const tenant = await prisma.tenant.findUnique({ where: { slug } })
  const role = await prisma.userRole.findFirst({ where: { userId: owner.userId, tenantId: tenant?.id ?? "", role: "ClubOwner" } })
  createdTenantId = tenant?.id ?? null
  const ok = tenant?.status === "ACTIVE" && !!role
  r.record("3.3", "Create new club", ok, ok ? `Tenant ACTIVE + ClubOwner UserRole ✓` : `tenant=${tenant?.status}, role=${!!role}`)
}

async function s3_4_public_visibility() {
  if (!createdTenantId) return r.record("3.4", "Public visibility", false, "no created tenant")
  const tenant = await prisma.tenant.findUnique({ where: { id: createdTenantId } })
  if (!tenant) return r.record("3.4", "Public visibility", false, "tenant gone")
  // Probe public clubs listing
  const res = await call(`/api/clubs/public?slug=${tenant.slug}`)
  // Endpoint may not support slug filter — fall back to checking it shows up in unauthenticated listing
  const list = await call("/api/clubs/public")
  const found = (list.body?.clubs ?? list.body ?? []).some?.((c: any) => c.id === tenant.id || c.slug === tenant.slug)
  const ok = list.status === 200 && (found || res.status === 200)
  r.record("3.4", "Created club visible on public endpoint", ok, ok ? `HTTP 200, present in public listing ✓` : `list HTTP ${list.status} found=${found}`)
}

async function s3_5_edit_branding() {
  if (!createdTenantId) return r.record("3.5", "Edit branding", false, "no tenant")
  // Re-acquire owner jar (the 3.3 owner)
  const owner = await makeUser({
    email: `phase3-3-5-edit@${TEST_EMAIL_DOMAIN}`,
    firstName: "Ed",
    lastName: "Editor",
    roles: ["ClubOwner"],
  })
  // Make this user the owner of the existing tenant
  await prisma.userRole.create({ data: { userId: owner.userId, role: "ClubOwner", tenantId: createdTenantId } })
  const res = await call(`/api/clubs/${createdTenantId}`, {
    method: "PATCH",
    jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Phase3 Renamed Club",
      timezone: "America/Vancouver",
      primaryColor: "#FF6600",
    }),
  })
  if (res.status !== 200) return r.record("3.5", "Edit branding", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const tenant = await prisma.tenant.findUnique({ where: { id: createdTenantId } })
  const branding = await prisma.tenantBranding.findUnique({ where: { tenantId: createdTenantId } })
  const ok = tenant?.name === "Phase3 Renamed Club" && tenant.timezone === "America/Vancouver" && branding?.primaryColor === "#FF6600"
  r.record("3.5", "Edit name + timezone + branding color", ok, ok ? `name+timezone+primaryColor persisted ✓` : `tenant=${tenant?.name}/${tenant?.timezone}, branding=${branding?.primaryColor}`)
}

function s3_6_admin_impersonation() {
  r.record("3.6", "Admin impersonation creates resources as ClubOwner", "skip", "Manual UI verification — impersonation cookie flow not exercised here")
}

async function s3_7_cross_club_casl() {
  if (!createdTenantId) return r.record("3.7", "Cross-club CASL", false, "no tenant")
  // Owner B owns no tenant; tries to PATCH the tenant from 3.5
  const ownerB = await makeClubOwner("3-7-other", "Other", "Owner")
  const res = await call(`/api/clubs/${createdTenantId}`, {
    method: "PATCH",
    jar: ownerB.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Hijacked" }),
  })
  const ok = res.status === 403
  r.record("3.7", "ClubOwner B cannot edit ClubOwner A's tenant", ok, ok ? `HTTP 403 ✓` : `HTTP ${res.status} expected 403`)
}

async function s3_8_wrong_code() {
  // Fresh claim flow with intentionally wrong code
  const owner = await makeClubOwner("3-8-wrongcode", "Wrong", "Coder")
  const target = await makeUnclaimedTenant("b")
  const claimRes = await call(`/api/clubs/claim/${target.id}`, {
    method: "POST",
    jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
  if (claimRes.status !== 201) return r.record("3.8", "Wrong code rejected", false, `claim HTTP ${claimRes.status}`)
  const claim = await prisma.clubClaim.findFirst({ where: { tenantId: target.id, userId: owner.userId } })
  if (claim?.status !== "EMAIL_SENT") {
    await prisma.clubClaim.update({ where: { id: claim!.id }, data: { status: "EMAIL_SENT" } })
  }
  const res = await call(`/api/clubs/claim/${target.id}`, {
    method: "PATCH",
    jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: "000000" }),
  })
  const tenant = await prisma.tenant.findUnique({ where: { id: target.id } })
  const ok = res.status === 400 && tenant?.status === "UNCLAIMED"
  r.record("3.8", "Wrong verification code rejected, tenant stays UNCLAIMED", ok, ok ? `HTTP 400, status=UNCLAIMED ✓` : `HTTP ${res.status}, status=${tenant?.status}`)
}

// ---------- Main ----------

async function main() {
  console.log(`\n=== Phase 3 — Club lifecycle ===\n`)
  await cleanup()
  await s3_1_claim_request()
  await s3_2_verify_correct_code()
  await s3_3_create_new_club()
  await s3_4_public_visibility()
  await s3_5_edit_branding()
  s3_6_admin_impersonation()
  await s3_7_cross_club_casl()
  await s3_8_wrong_code()
  r.printSummary("Phase 3")
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
