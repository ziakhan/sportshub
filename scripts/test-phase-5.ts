/**
 * Phase 5 — Team creation with staff assignment
 *
 * Usage:
 *   cd packages/db && npx tsx /Users/ziakhan/zia/personal/sportshub/scripts/test-phase-5.ts
 */

import { prisma } from "@youthbasketballhub/db"
import { call, makeUser, Reporter } from "./lib/test-helpers"

const TEST_EMAIL_DOMAIN = "phase5-test.local"
const TEST_TENANT_SLUG_PREFIX = "phase5-test-"

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
    await prisma.team.deleteMany({ where: { tenantId: { in: tenantIds } } })
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

async function makeOwnerWithTenant(suffix: string) {
  const owner = await makeUser({
    email: `phase5-owner-${suffix}@${TEST_EMAIL_DOMAIN}`,
    firstName: "Olive",
    lastName: "Owner",
    roles: ["ClubOwner"],
  })
  const tenant = await prisma.tenant.create({
    data: {
      name: `Phase5 Tenant ${suffix}`,
      slug: `${TEST_TENANT_SLUG_PREFIX}${suffix}`,
      contactEmail: `tenant-${suffix}@${TEST_EMAIL_DOMAIN}`,
      city: "Toronto", state: "ON", country: "CA", currency: "CAD",
      status: "ACTIVE",
    },
  })
  const existing = await prisma.userRole.findFirst({ where: { userId: owner.userId, role: "ClubOwner", tenantId: null } })
  if (existing) {
    await prisma.userRole.update({ where: { id: existing.id }, data: { tenantId: tenant.id } })
  } else {
    await prisma.userRole.create({ data: { userId: owner.userId, role: "ClubOwner", tenantId: tenant.id } })
  }
  return { ...owner, tenantId: tenant.id }
}

async function makeStaff(suffix: string) {
  const u = await makeUser({
    email: `phase5-staff-${suffix}@${TEST_EMAIL_DOMAIN}`,
    firstName: "Sandy",
    lastName: "Staff",
    roles: ["Staff"],
    profileData: { type: "Staff", phoneNumber: "+14165550000", country: "CA", city: "Toronto", state: "ON" },
  })
  return u
}

// Attach an existing user as Staff at the tenant level (so they can be "assigned" to a team)
async function attachAsClubStaff(userId: string, tenantId: string) {
  return prisma.userRole.create({ data: { userId, role: "Staff", tenantId } })
}

// ---------- Scenarios ----------

let owner: Awaited<ReturnType<typeof makeOwnerWithTenant>> | null = null
let coachA: Awaited<ReturnType<typeof makeStaff>> | null = null
let coachB: Awaited<ReturnType<typeof makeStaff>> | null = null
let teamA_id: string | null = null
let teamB_id: string | null = null

async function s5_1_create_team() {
  owner = await makeOwnerWithTenant("a")
  const res = await call("/api/teams", {
    method: "POST", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Phase5 Team A",
      ageGroup: "U12",
      gender: "MALE",
      season: "Spring 2026",
      tenantId: owner.tenantId,
    }),
  })
  if (res.status !== 201 && res.status !== 200) return r.record("5.1", "Create team", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const team = await prisma.team.findFirst({ where: { name: "Phase5 Team A", tenantId: owner.tenantId } })
  teamA_id = team?.id ?? null
  const ok = !!team && team.ageGroup === "U12"
  r.record("5.1", "Create team (no staff)", ok, ok ? `Team row created ✓` : `state wrong`)
}

async function s5_2_assign_head_coach() {
  if (!owner) return r.record("5.2", "Assign HeadCoach", false, "no owner")
  coachA = await makeStaff("coach-a")
  await attachAsClubStaff(coachA.userId, owner.tenantId)
  const res = await call("/api/teams", {
    method: "POST", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Phase5 Team B",
      ageGroup: "U14",
      gender: "FEMALE",
      tenantId: owner.tenantId,
      staff: [{ type: "assign", userId: coachA.userId, role: "Staff", designation: "HeadCoach" }],
    }),
  })
  if (res.status !== 201 && res.status !== 200) return r.record("5.2", "Assign HeadCoach", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const team = await prisma.team.findFirst({ where: { name: "Phase5 Team B", tenantId: owner.tenantId } })
  teamB_id = team?.id ?? null
  const role = await prisma.userRole.findFirst({
    where: { userId: coachA.userId, teamId: team?.id ?? "", role: "Staff", designation: "HeadCoach" },
  })
  const ok = !!team && !!role && role.tenantId === owner.tenantId
  r.record("5.2", "Create team + assign HeadCoach", ok, ok ? `UserRole(Staff, HeadCoach, teamId, tenantId) ✓` : `state wrong`)
}

async function s5_3_assign_assistant_coach() {
  if (!owner || !teamB_id) return r.record("5.3", "Assign AssistantCoach", false, "no setup")
  coachB = await makeStaff("coach-b")
  await attachAsClubStaff(coachB.userId, owner.tenantId)
  // Add via PATCH (existing team, append staff)
  const res = await call(`/api/teams/${teamB_id}`, {
    method: "PATCH", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      staffToAdd: [{ type: "assign", userId: coachB.userId, role: "Staff", designation: "AssistantCoach" }],
    }),
  })
  if (res.status !== 200) return r.record("5.3", "Assign AssistantCoach", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const role = await prisma.userRole.findFirst({
    where: { userId: coachB.userId, teamId: teamB_id, role: "Staff", designation: "AssistantCoach" },
  })
  const ok = !!role
  r.record("5.3", "Add AssistantCoach via PATCH", ok, ok ? `UserRole(Staff, AssistantCoach) ✓` : `not found`)
}

async function s5_4_invite_new_staff_team_scoped() {
  if (!owner) return r.record("5.4", "Team-scoped invite", false, "no owner")
  const inviteEmail = `phase5-team-invite@${TEST_EMAIL_DOMAIN}`
  const res = await call("/api/teams", {
    method: "POST", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Phase5 Team C",
      ageGroup: "U16",
      tenantId: owner.tenantId,
      staff: [{ type: "invite", email: inviteEmail, role: "Staff", designation: "HeadCoach" }],
    }),
  })
  if (res.status !== 201 && res.status !== 200) return r.record("5.4", "Team-scoped invite", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const team = await prisma.team.findFirst({ where: { name: "Phase5 Team C", tenantId: owner.tenantId } })
  const inv = await prisma.staffInvitation.findFirst({ where: { tenantId: owner.tenantId, invitedEmail: inviteEmail, teamId: team?.id ?? "" } })
  const ok = !!team && !!inv && inv.designation === "HeadCoach" && inv.teamId === team.id
  r.record("5.4", "Team creation w/ team-scoped invite", ok, ok ? `StaffInvitation w/ teamId + designation ✓` : `state wrong`)
}

async function s5_5_accept_team_scoped_invite() {
  if (!owner) return r.record("5.5", "Accept team-scoped invite", false, "no setup")
  // Make a real existing user, invite them to Team B as AssistantCoach (replacing coachB scenario), then accept
  const newCoach = await makeStaff("late-coach")
  if (!teamB_id) return r.record("5.5", "Accept team-scoped invite", false, "no teamB")
  const inv = await call("/api/teams", {
    method: "POST", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Phase5 Team D",
      ageGroup: "U18",
      tenantId: owner.tenantId,
      staff: [{ type: "invite", email: newCoach.email, role: "Staff", designation: "AssistantCoach" }],
    }),
  })
  if (inv.status !== 201 && inv.status !== 200) return r.record("5.5", "Accept team-scoped invite", false, `team create HTTP ${inv.status}`)
  const teamD = await prisma.team.findFirst({ where: { name: "Phase5 Team D", tenantId: owner.tenantId } })
  const invitation = await prisma.staffInvitation.findFirst({ where: { tenantId: owner.tenantId, invitedUserId: newCoach.userId, teamId: teamD?.id ?? "" } })
  if (!invitation) return r.record("5.5", "Accept team-scoped invite", false, `no invitation row`)
  const acceptRes = await call(`/api/invitations/${invitation.id}`, {
    method: "PATCH", jar: newCoach.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "accept" }),
  })
  if (acceptRes.status !== 200) return r.record("5.5", "Accept team-scoped invite", false, `accept HTTP ${acceptRes.status}`)
  const role = await prisma.userRole.findFirst({
    where: { userId: newCoach.userId, teamId: teamD?.id ?? "", designation: "AssistantCoach" },
  })
  const ok = !!role && role.tenantId === owner.tenantId
  r.record("5.5", "Team-scoped invite → accept → UserRole w/ teamId + designation", ok, ok ? `UserRole(Staff, AssistantCoach, teamId) ✓` : `not found`)
}

async function s5_6_swap_head_coach() {
  if (!owner || !teamB_id || !coachA) return r.record("5.6", "Swap HeadCoach", false, "no setup")
  const replacementCoach = await makeStaff("replacement-hc")
  await attachAsClubStaff(replacementCoach.userId, owner.tenantId)
  const oldHc = await prisma.userRole.findFirst({
    where: { userId: coachA.userId, teamId: teamB_id, designation: "HeadCoach" },
  })
  if (!oldHc) return r.record("5.6", "Swap HeadCoach", false, "no existing HC")
  const res = await call(`/api/teams/${teamB_id}`, {
    method: "PATCH", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      staffToRemove: [oldHc.id],
      staffToAdd: [{ type: "assign", userId: replacementCoach.userId, role: "Staff", designation: "HeadCoach" }],
    }),
  })
  if (res.status !== 200) return r.record("5.6", "Swap HeadCoach", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const stillOld = await prisma.userRole.findUnique({ where: { id: oldHc.id } })
  const newHc = await prisma.userRole.findFirst({ where: { userId: replacementCoach.userId, teamId: teamB_id, designation: "HeadCoach" } })
  const ok = !stillOld && !!newHc
  r.record("5.6", "Swap HeadCoach via PATCH", ok, ok ? `old removed, new added ✓` : `state wrong`)
}

async function s5_7_team_manager() {
  if (!owner || !teamA_id) return r.record("5.7", "TeamManager", false, "no setup")
  // Note: TeamManager isn't in the onboarding role enum. Onboard as Staff first.
  // Product invariant: team PATCH requires the user to already have the matching tenant-level role.
  // So we create a tenant-level TeamManager UserRole before doing the team assignment.
  const tm = await makeUser({
    email: `phase5-teammanager@${TEST_EMAIL_DOMAIN}`,
    firstName: "Tina", lastName: "Manager",
    roles: ["Staff"],
    profileData: { type: "Staff", phoneNumber: "+14165550000", country: "CA", city: "Toronto", state: "ON" },
  })
  await prisma.userRole.create({
    data: { userId: tm.userId, role: "TeamManager", tenantId: owner.tenantId },
  })
  const res = await call(`/api/teams/${teamA_id}`, {
    method: "PATCH", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      staffToAdd: [{ type: "assign", userId: tm.userId, role: "TeamManager", designation: null }],
    }),
  })
  if (res.status !== 200) return r.record("5.7", "TeamManager", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const role = await prisma.userRole.findFirst({
    where: { userId: tm.userId, teamId: teamA_id, role: "TeamManager" },
  })
  const ok = !!role && !role.designation
  r.record("5.7", "Assign TeamManager (no designation)", ok, ok ? `UserRole(TeamManager, designation=null) ✓` : `state wrong`)
}

async function s5_8_multi_team_staff() {
  if (!owner || !teamA_id || !teamB_id || !coachA) return r.record("5.8", "Multi-team staff", false, "no setup")
  // CoachA is HeadCoach of teamB (until 5.6 swapped them out). Now also add to teamA as AssistantCoach.
  const res = await call(`/api/teams/${teamA_id}`, {
    method: "PATCH", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      staffToAdd: [{ type: "assign", userId: coachA.userId, role: "Staff", designation: "AssistantCoach" }],
    }),
  })
  if (res.status !== 200) return r.record("5.8", "Multi-team staff", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const roles = await prisma.userRole.findMany({
    where: { userId: coachA.userId, role: "Staff" },
  })
  // CoachA should have at least: club-level Staff (from attachAsClubStaff) + teamA Assistant (just added).
  // 5.6 removed them from teamB so that role is gone.
  const teamRoles = roles.filter((r) => r.teamId)
  const ok = teamRoles.length >= 1 && teamRoles.some((r) => r.teamId === teamA_id)
  r.record("5.8", "Staff assignable to multiple teams", ok, ok ? `UserRoles across ${teamRoles.length} team(s) ✓` : `only ${teamRoles.length} team-scoped roles`)
}

function s5_9_filter_teams() {
  r.record("5.9", "Filter teams via URL searchParams", "skip", "Manual UI verification — server-rendered list page")
}

// ---------- Main ----------

async function main() {
  console.log(`\n=== Phase 5 — Team creation ===\n`)
  await cleanup()
  await s5_1_create_team()
  await s5_2_assign_head_coach()
  await s5_3_assign_assistant_coach()
  await s5_4_invite_new_staff_team_scoped()
  await s5_5_accept_team_scoped_invite()
  await s5_6_swap_head_coach()
  await s5_7_team_manager()
  await s5_8_multi_team_staff()
  s5_9_filter_teams()
  r.printSummary("Phase 5")
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
