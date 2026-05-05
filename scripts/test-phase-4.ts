/**
 * Phase 4 — Staff invitations (account + no-account paths, REQUEST, decline, remove)
 *
 * Usage:
 *   cd packages/db && npx tsx /Users/ziakhan/zia/personal/sportshub/scripts/test-phase-4.ts
 */

import { prisma } from "@youthbasketballhub/db"
import { call, makeUser, signIn, signup, Reporter, PASSWORD } from "./lib/test-helpers"

const TEST_EMAIL_DOMAIN = "phase4-test.local"
const TEST_TENANT_SLUG_PREFIX = "phase4-test-"

const r = new Reporter()

async function cleanup() {
  const tenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: TEST_TENANT_SLUG_PREFIX } },
    select: { id: true },
  })
  const tenantIds = tenants.map((t) => t.id)
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
    select: { id: true },
  })
  const userIds = users.map((u) => u.id)

  if (tenantIds.length > 0) {
    await prisma.staffInvitation.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.userRole.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.tenantBranding.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } })
  }
  if (userIds.length > 0) {
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  }
  console.log(`🧹 Cleaned up ${users.length} users, ${tenants.length} tenants`)
}

async function makeTenantWithOwner(slug: string) {
  const owner = await makeUser({
    email: `phase4-owner-${slug}@${TEST_EMAIL_DOMAIN}`,
    firstName: "Olive",
    lastName: "Owner",
    roles: ["ClubOwner"],
  })
  // ClubOwner role is unscoped after onboarding; we need to attach a tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: `Phase4 Tenant ${slug}`,
      slug: `${TEST_TENANT_SLUG_PREFIX}${slug}`,
      contactEmail: `tenant-${slug}@${TEST_EMAIL_DOMAIN}`,
      city: "Toronto", state: "ON", country: "CA", currency: "CAD",
      status: "ACTIVE",
    },
  })
  // Update the unscoped ClubOwner role with tenantId, OR create new
  const existing = await prisma.userRole.findFirst({ where: { userId: owner.userId, role: "ClubOwner", tenantId: null } })
  if (existing) {
    await prisma.userRole.update({ where: { id: existing.id }, data: { tenantId: tenant.id } })
  } else {
    await prisma.userRole.create({ data: { userId: owner.userId, role: "ClubOwner", tenantId: tenant.id } })
  }
  return { ...owner, tenantId: tenant.id }
}

async function makeStaffUser(slug: string) {
  // A pre-existing user with no tenant role
  return makeUser({
    email: `phase4-staff-${slug}@${TEST_EMAIL_DOMAIN}`,
    firstName: "Sandy",
    lastName: "Staff",
    roles: ["Staff"],
    profileData: { type: "Staff", phoneNumber: "+14165550000", country: "CA", city: "Toronto", state: "ON" },
  })
}

// ---------- Scenarios ----------

let owner: Awaited<ReturnType<typeof makeTenantWithOwner>> | null = null
let existingStaff: Awaited<ReturnType<typeof makeStaffUser>> | null = null
let inviteToExistingId: string | null = null
let inviteToFreshEmailId: string | null = null
const FRESH_INVITE_EMAIL = `phase4-fresh-invitee@${TEST_EMAIL_DOMAIN}`

async function s4_1_invite_existing() {
  owner = await makeTenantWithOwner("a")
  existingStaff = await makeStaffUser("ex")
  const res = await call(`/api/clubs/${owner.tenantId}/staff`, {
    method: "POST", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: existingStaff.email, role: "Staff", message: "Welcome" }),
  })
  if (res.status !== 201) return r.record("4.1", "Invite existing user", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  inviteToExistingId = res.body.id
  const inv = await prisma.staffInvitation.findUnique({ where: { id: inviteToExistingId! } })
  const notif = await prisma.notification.findFirst({ where: { userId: existingStaff.userId, type: "staff_invite" } })
  const ok = inv?.invitedUserId === existingStaff.userId && inv?.status === "PENDING" && !!notif
  r.record("4.1", "Invite existing user → invitation + notification", ok, ok ? `invitedUserId set, notification fired ✓` : `state wrong`)
}

async function s4_2_existing_accepts() {
  if (!existingStaff || !inviteToExistingId || !owner) return r.record("4.2", "Existing accepts", false, "no setup")
  const res = await call(`/api/invitations/${inviteToExistingId}`, {
    method: "PATCH", jar: existingStaff.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "accept" }),
  })
  if (res.status !== 200) return r.record("4.2", "Existing accepts", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const inv = await prisma.staffInvitation.findUnique({ where: { id: inviteToExistingId! } })
  const role = await prisma.userRole.findFirst({ where: { userId: existingStaff.userId, tenantId: owner.tenantId, role: "Staff" } })
  const ok = inv?.status === "ACCEPTED" && !!role
  r.record("4.2", "Existing user accepts → UserRole created", ok, ok ? `status=ACCEPTED, UserRole(Staff) ✓` : `inv=${inv?.status}, role=${!!role}`)
}

async function s4_3_invite_fresh_email() {
  if (!owner) return r.record("4.3", "Invite fresh email", false, "no owner")
  const res = await call(`/api/clubs/${owner.tenantId}/staff`, {
    method: "POST", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: FRESH_INVITE_EMAIL, role: "Staff" }),
  })
  if (res.status !== 201) return r.record("4.3", "Invite fresh email", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  inviteToFreshEmailId = res.body.id
  const inv = await prisma.staffInvitation.findUnique({ where: { id: inviteToFreshEmailId! } })
  const ok = inv?.invitedUserId === null && inv?.invitedEmail === FRESH_INVITE_EMAIL && inv?.status === "PENDING"
  r.record("4.3", "Invite non-existing email → invitation w/ invitedUserId=null", ok, ok ? `invitedUserId=null ✓` : `state wrong`)
}

async function s4_4_signup_auto_attach() {
  // Gap 0.1.1 fix: signup-after-invite now sets invitedUserId on matching invitations.
  if (!inviteToFreshEmailId) return r.record("4.4", "Signup auto-attaches", false, "no invitation")
  const sup = await signup(FRESH_INVITE_EMAIL, "Fresh", "Invitee")
  if (sup.status !== 200) return r.record("4.4", "Signup auto-attaches", false, `signup HTTP ${sup.status}`)
  const newUser = await prisma.user.findFirst({ where: { email: FRESH_INVITE_EMAIL } })
  const inv = await prisma.staffInvitation.findUnique({ where: { id: inviteToFreshEmailId } })
  const notif = await prisma.notification.findFirst({ where: { userId: newUser?.id ?? "", type: "staff_invite", referenceId: inviteToFreshEmailId } })
  const ok = inv?.invitedUserId === newUser?.id && !!notif && (sup.body as any)?.pendingInvitations >= 1
  r.record("4.4", "Signup-after-invite auto-attaches invitation + notification", ok,
    ok ? `invitedUserId=${newUser?.id}, notification fired, response.pendingInvitations=${(sup.body as any)?.pendingInvitations} ✓` : `state wrong (invitedUserId=${inv?.invitedUserId})`)
}

async function s4_5_signup_then_accept() {
  // After 0.1.1 fix: signup attaches the invite, so the new user can accept it
  // through the standard /api/invitations/[id] PATCH path.
  if (!inviteToFreshEmailId) return r.record("4.5", "Signup then accept", false, "no invitation")
  const jar = await signIn(FRESH_INVITE_EMAIL, PASSWORD)
  if (!jar) return r.record("4.5", "Signup then accept", false, "signin failed")
  const res = await call(`/api/invitations/${inviteToFreshEmailId}`, {
    method: "PATCH", jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "accept" }),
  })
  if (res.status !== 200) return r.record("4.5", "Signup then accept", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const newUser = await prisma.user.findFirstOrThrow({ where: { email: FRESH_INVITE_EMAIL } })
  const inv = await prisma.staffInvitation.findUnique({ where: { id: inviteToFreshEmailId } })
  const role = await prisma.userRole.findFirst({ where: { userId: newUser.id, tenantId: inv?.tenantId ?? "", role: "Staff" } })
  const ok = inv?.status === "ACCEPTED" && !!role
  r.record("4.5", "Signup → notification → accept (full no-account path)", ok,
    ok ? `invitation ACCEPTED, UserRole(Staff) created ✓` : `state wrong`)
}

async function s4_6_decline() {
  // New invite, then decline
  if (!owner) return r.record("4.6", "Decline", false, "no owner")
  const decliner = await makeStaffUser("decline")
  const inv = await call(`/api/clubs/${owner.tenantId}/staff`, {
    method: "POST", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: decliner.email, role: "Staff" }),
  })
  if (inv.status !== 201) return r.record("4.6", "Decline", false, `invite HTTP ${inv.status}`)
  const res = await call(`/api/invitations/${inv.body.id}`, {
    method: "PATCH", jar: decliner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "decline" }),
  })
  if (res.status !== 200) return r.record("4.6", "Decline", false, `decline HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const persisted = await prisma.staffInvitation.findUnique({ where: { id: inv.body.id } })
  const role = await prisma.userRole.findFirst({ where: { userId: decliner.userId, tenantId: owner.tenantId } })
  const ok = persisted?.status === "DECLINED" && !role
  r.record("4.6", "Decline marks DECLINED, no UserRole", ok, ok ? `status=DECLINED, no UserRole ✓` : `state wrong`)
}

async function s4_7_remove_staff() {
  // Remove the staff member added in 4.2
  if (!owner || !existingStaff) return r.record("4.7", "Remove staff", false, "no setup")
  const role = await prisma.userRole.findFirst({ where: { userId: existingStaff.userId, tenantId: owner.tenantId, role: "Staff" } })
  if (!role) return r.record("4.7", "Remove staff", false, "no Staff role to remove")
  const res = await call(`/api/clubs/${owner.tenantId}/staff?roleId=${role.id}`, {
    method: "DELETE", jar: owner.jar,
  })
  if (res.status !== 200) return r.record("4.7", "Remove staff", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const stillThere = await prisma.userRole.findUnique({ where: { id: role.id } })
  const ok = !stillThere
  r.record("4.7", "Remove staff via DELETE", ok, ok ? `UserRole deleted ✓` : `still present`)
}

async function s4_8_request_to_join() {
  if (!owner) return r.record("4.8", "Request to join", false, "no owner")
  const requester = await makeStaffUser("requester")
  // POST request
  const reqRes = await call(`/api/clubs/${owner.tenantId}/staff/requests`, {
    method: "POST", jar: requester.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: "Staff", message: "Please add me" }),
  })
  if (reqRes.status !== 201 && reqRes.status !== 200) return r.record("4.8", "Request to join", false, `request HTTP ${reqRes.status} ${JSON.stringify(reqRes.body)}`)
  const inv = await prisma.staffInvitation.findFirst({ where: { tenantId: owner.tenantId, type: "REQUEST", invitedUserId: requester.userId } })
  if (!inv) return r.record("4.8", "Request to join", false, "REQUEST row not created")
  // ClubOwner accepts
  const acceptRes = await call(`/api/invitations/${inv.id}`, {
    method: "PATCH", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "accept", role: "Staff" }),
  })
  if (acceptRes.status !== 200) return r.record("4.8", "Request to join", false, `accept HTTP ${acceptRes.status} ${JSON.stringify(acceptRes.body)}`)
  const role = await prisma.userRole.findFirst({ where: { userId: requester.userId, tenantId: owner.tenantId, role: "Staff" } })
  const persisted = await prisma.staffInvitation.findUnique({ where: { id: inv.id } })
  const ok = persisted?.status === "ACCEPTED" && !!role
  r.record("4.8", "REQUEST flow → ClubOwner approves → UserRole", ok, ok ? `request approved, UserRole(Staff) ✓` : `state wrong`)
}

async function s4_9_public_accept_page() {
  if (!owner) return r.record("4.9", "Public accept page", false, "no setup")
  // 0.1.2 fix: create a FRESH PENDING invitation for a brand new email (no signup),
  // then hit the public accept page unauthenticated. Should render sign-in/sign-up CTAs.
  const freshEmail = `phase4-9-newcomer@${TEST_EMAIL_DOMAIN}`
  const inv = await call(`/api/clubs/${owner.tenantId}/staff`, {
    method: "POST", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: freshEmail, role: "Staff" }),
  })
  if (inv.status !== 201) return r.record("4.9", "Public accept page", false, `invite HTTP ${inv.status}`)
  const invId = inv.body.id
  const res = await call(`/invitations/${invId}/accept`) // no jar
  if (res.status !== 200) return r.record("4.9", "Public accept page", false, `HTTP ${res.status} (expected 200)`)
  const html = typeof res.body === "string" ? res.body : JSON.stringify(res.body)
  const hasSignIn = /sign[\s-]in/i.test(html)
  const hasSignUp = /sign[\s-]up|create account/i.test(html)
  const hasClubName = /Phase4 Tenant/i.test(html)
  const ok = hasSignIn && hasSignUp && hasClubName
  r.record("4.9", "Public /invitations/[id]/accept renders unauth", ok,
    ok ? `200 + sign-in/sign-up CTAs + club name ✓` : `signIn=${hasSignIn} signUp=${hasSignUp} clubName=${hasClubName}`)
}

// ---------- Main ----------

async function main() {
  console.log(`\n=== Phase 4 — Staff invitations ===\n`)
  await cleanup()
  await s4_1_invite_existing()
  await s4_2_existing_accepts()
  await s4_3_invite_fresh_email()
  await s4_4_signup_auto_attach()
  await s4_5_signup_then_accept()
  await s4_6_decline()
  await s4_7_remove_staff()
  await s4_8_request_to_join()
  await s4_9_public_accept_page()
  r.printSummary("Phase 4")
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
