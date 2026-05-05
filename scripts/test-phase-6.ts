/**
 * Phase 6 — Tryouts (1–3 trial sessions per team)
 *
 * Usage:
 *   cd packages/db && npx tsx /Users/ziakhan/zia/personal/sportshub/scripts/test-phase-6.ts
 */

import { prisma } from "@youthbasketballhub/db"
import { call, makeUser, Reporter } from "./lib/test-helpers"

const TEST_EMAIL_DOMAIN = "phase6-test.local"
const TEST_TENANT_SLUG_PREFIX = "phase6-test-"

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
    await prisma.tryoutSignup.deleteMany({ where: { tryout: { tenantId: { in: tenantIds } } } })
    await prisma.tryout.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.staffInvitation.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.userRole.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.team.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.tenantBranding.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } })
  }
  if (userIds.length > 0) {
    await prisma.player.deleteMany({ where: { parentId: { in: userIds } } })
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  }
  console.log(`🧹 Cleaned up ${users.length} users, ${tenants.length} tenants`)
}

async function makeOwnerWithTenantAndTeam(suffix: string) {
  const owner = await makeUser({
    email: `phase6-owner-${suffix}@${TEST_EMAIL_DOMAIN}`,
    firstName: "Olive", lastName: "Owner",
    roles: ["ClubOwner"],
  })
  const tenant = await prisma.tenant.create({
    data: {
      name: `Phase6 Tenant ${suffix}`,
      slug: `${TEST_TENANT_SLUG_PREFIX}${suffix}`,
      contactEmail: `tenant-${suffix}@${TEST_EMAIL_DOMAIN}`,
      city: "Toronto", state: "ON", country: "CA", currency: "CAD",
      status: "ACTIVE",
    },
  })
  const existing = await prisma.userRole.findFirst({ where: { userId: owner.userId, role: "ClubOwner", tenantId: null } })
  if (existing) await prisma.userRole.update({ where: { id: existing.id }, data: { tenantId: tenant.id } })
  else await prisma.userRole.create({ data: { userId: owner.userId, role: "ClubOwner", tenantId: tenant.id } })
  const team = await prisma.team.create({
    data: { name: "Phase6 Team A", ageGroup: "U12", gender: "MALE", season: "Spring 2026", tenantId: tenant.id },
  })
  return { ...owner, tenantId: tenant.id, teamId: team.id }
}

async function makeParentWithChild(suffix: string, age = 11) {
  const parent = await makeUser({
    email: `phase6-parent-${suffix}@${TEST_EMAIL_DOMAIN}`,
    firstName: "Pat", lastName: "Parent",
    roles: ["Parent"],
    profileData: { type: "Parent", phoneNumber: "+14165550000", country: "CA", city: "Toronto", state: "ON" },
  })
  const dob = new Date()
  dob.setFullYear(dob.getFullYear() - age)
  const playerRes = await call("/api/players", {
    method: "POST", jar: parent.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: `Kid${suffix}`, lastName: "Player",
      dateOfBirth: dob.toISOString().slice(0, 10),
      gender: "MALE",
      parentalConsentGiven: true, // COPPA — required for under-13
    }),
  })
  if (playerRes.status !== 201) throw new Error(`add player ${suffix} failed: HTTP ${playerRes.status}`)
  return { ...parent, playerId: playerRes.body.id }
}

function tomorrow(daysAhead = 7): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString()
}

// ---------- Scenarios ----------

let owner: Awaited<ReturnType<typeof makeOwnerWithTenantAndTeam>> | null = null
let draftTryoutId: string | null = null
let publishedTryoutIds: string[] = []
let smallTryoutId: string | null = null

async function s6_1_create_draft() {
  owner = await makeOwnerWithTenantAndTeam("a")
  const res = await call("/api/tryouts", {
    method: "POST", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Phase6 Tryout Draft",
      ageGroup: "U12",
      gender: "MALE",
      location: "Phase6 Gym",
      scheduledAt: tomorrow(7),
      fee: 50,
      maxParticipants: 30,
      tenantId: owner.tenantId,
      teamId: owner.teamId,
    }),
  })
  if (res.status !== 201) return r.record("6.1", "Create draft tryout", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  draftTryoutId = res.body.id
  const tryout = await prisma.tryout.findUnique({ where: { id: draftTryoutId! } })
  const ok = !!tryout && tryout.isPublished === false && tryout.teamId === owner.teamId
  r.record("6.1", "Create tryout (DRAFT)", ok, ok ? `isPublished=false, teamId set ✓` : `state wrong`)
}

async function s6_2_publish() {
  if (!draftTryoutId) return r.record("6.2", "Publish", false, "no draft")
  const res = await call(`/api/tryouts/${draftTryoutId}/publish`, { method: "POST", jar: owner!.jar })
  if (res.status !== 200) return r.record("6.2", "Publish", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const tryout = await prisma.tryout.findUnique({ where: { id: draftTryoutId } })
  const ok = tryout?.isPublished === true
  r.record("6.2", "Publish tryout", ok, ok ? `isPublished=true ✓` : `state wrong`)
}

async function s6_3_multi_session() {
  if (!owner) return r.record("6.3", "Multi-session tryout", false, "no owner")
  const ids: string[] = [draftTryoutId!]
  for (let i = 2; i <= 3; i++) {
    const res = await call("/api/tryouts", {
      method: "POST", jar: owner.jar,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `Phase6 Tryout Session ${i}`,
        ageGroup: "U12",
        gender: "MALE",
        location: "Phase6 Gym",
        scheduledAt: tomorrow(7 + i),
        fee: 50,
        maxParticipants: 30,
        tenantId: owner.tenantId,
        teamId: owner.teamId,
      }),
    })
    if (res.status !== 201) return r.record("6.3", "Multi-session tryout", false, `session ${i} HTTP ${res.status}`)
    ids.push(res.body.id)
    await call(`/api/tryouts/${res.body.id}/publish`, { method: "POST", jar: owner.jar })
  }
  publishedTryoutIds = ids
  const teamTryouts = await prisma.tryout.count({ where: { teamId: owner.teamId, isPublished: true } })
  const ok = teamTryouts === 3
  r.record("6.3", "3-session tryout per team (each = own Tryout row)", ok, ok ? `${teamTryouts} published tryouts on team ✓` : `${teamTryouts} found`)
}

async function s6_4_marketplace() {
  // 0.1.5 fix: /api/tryouts is now in PUBLIC_PATHS — unauth visitors can hit marketplace.
  if (!publishedTryoutIds.length) return r.record("6.4", "Marketplace", false, "no tryouts")
  const res = await call("/api/tryouts?marketplace=true") // no jar
  if (res.status !== 200) return r.record("6.4", "Marketplace", false, `HTTP ${res.status} (expected 200 unauthenticated)`)
  const tryouts = res.body?.tryouts ?? []
  const ours = tryouts.filter((t: any) => publishedTryoutIds.includes(t.id))
  const ok = ours.length === 3
  r.record("6.4", "Marketplace lists published public tryouts (unauth)", ok,
    ok ? `${ours.length}/3 visible without auth ✓` : `${ours.length}/3`)
}

async function s6_5_parent_signs_up_child() {
  if (!publishedTryoutIds[0]) return r.record("6.5", "Parent signs up child", false, "no tryout")
  const parent = await makeParentWithChild("a", 11)
  const res = await call(`/api/tryouts/${publishedTryoutIds[0]}/signup`, {
    method: "POST", jar: parent.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: parent.playerId }),
  })
  if (res.status !== 201 && res.status !== 200) return r.record("6.5", "Parent signs up child", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const su = await prisma.tryoutSignup.findFirst({
    where: { tryoutId: publishedTryoutIds[0], userId: parent.userId },
  })
  const ok = !!su && su.playerName.startsWith("Kid")
  r.record("6.5", "Parent signs up child for tryout", ok, ok ? `TryoutSignup row (denormalized playerName) ✓` : `not created`)
}

async function s6_6_player_self_signup() {
  if (!publishedTryoutIds[1]) return r.record("6.6", "Player self-signup", false, "no tryout")
  // Player 13+ self-signup: onboard as Player so a Player row exists with parentId = self
  const e = `phase6-player-self@${TEST_EMAIL_DOMAIN}`
  const u = await makeUser({
    email: e, firstName: "Sam", lastName: "Solo",
    roles: ["Player"],
    profileData: { type: "Player", dateOfBirth: "2010-05-01", gender: "MALE", country: "CA", city: "Toronto", state: "ON" },
  })
  const player = await prisma.player.findFirst({ where: { parentId: u.userId } })
  if (!player) return r.record("6.6", "Player self-signup", false, "no Player row")
  const res = await call(`/api/tryouts/${publishedTryoutIds[1]}/signup`, {
    method: "POST", jar: u.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: player.id }),
  })
  if (res.status !== 201 && res.status !== 200) return r.record("6.6", "Player self-signup", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const su = await prisma.tryoutSignup.findFirst({
    where: { tryoutId: publishedTryoutIds[1], userId: u.userId },
  })
  const ok = !!su
  r.record("6.6", "Player 13+ self-signup", ok, ok ? `TryoutSignup row (self-parented) ✓` : `not created`)
}

async function s6_7_cancel_signup() {
  if (!publishedTryoutIds[2]) return r.record("6.7", "Cancel signup", false, "no tryout")
  const parent = await makeParentWithChild("cancel", 11)
  const sup = await call(`/api/tryouts/${publishedTryoutIds[2]}/signup`, {
    method: "POST", jar: parent.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: parent.playerId }),
  })
  if (sup.status !== 201 && sup.status !== 200) return r.record("6.7", "Cancel signup", false, `signup HTTP ${sup.status}`)
  const signupId = sup.body?.id || (await prisma.tryoutSignup.findFirstOrThrow({ where: { tryoutId: publishedTryoutIds[2], userId: parent.userId } })).id
  const del = await call(`/api/tryouts/${publishedTryoutIds[2]}/signup?signupId=${signupId}`, {
    method: "DELETE", jar: parent.jar,
  })
  if (del.status !== 200) return r.record("6.7", "Cancel signup", false, `delete HTTP ${del.status} ${JSON.stringify(del.body)}`)
  const after = await prisma.tryoutSignup.findUnique({ where: { id: signupId } })
  // Cancelled may be soft-cancelled (status=CANCELLED) or hard-deleted
  const ok = !after || after.status === "CANCELLED"
  r.record("6.7", "Cancel tryout signup", ok, ok ? `signup ${after ? "soft-cancelled" : "deleted"} ✓` : `still active`)
}

async function s6_8_capacity_enforced() {
  if (!owner) return r.record("6.8", "Capacity enforced", false, "no owner")
  // Make a tryout w/ maxParticipants=1, fill it, third signup should fail
  const small = await call("/api/tryouts", {
    method: "POST", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Phase6 Tiny Tryout",
      ageGroup: "U12", location: "Phase6 Gym",
      scheduledAt: tomorrow(14),
      fee: 0, maxParticipants: 1,
      tenantId: owner.tenantId, teamId: owner.teamId,
    }),
  })
  if (small.status !== 201) return r.record("6.8", "Capacity enforced", false, `create HTTP ${small.status}`)
  smallTryoutId = small.body.id
  await call(`/api/tryouts/${smallTryoutId}/publish`, { method: "POST", jar: owner.jar })
  const p1 = await makeParentWithChild("cap1", 11)
  const p2 = await makeParentWithChild("cap2", 11)
  const sup1 = await call(`/api/tryouts/${smallTryoutId}/signup`, {
    method: "POST", jar: p1.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: p1.playerId }),
  })
  if (sup1.status !== 201 && sup1.status !== 200) return r.record("6.8", "Capacity enforced", false, `first signup HTTP ${sup1.status}`)
  const sup2 = await call(`/api/tryouts/${smallTryoutId}/signup`, {
    method: "POST", jar: p2.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: p2.playerId }),
  })
  const ok = sup2.status === 400
  r.record("6.8", "Tryout at capacity rejects further signups", ok, ok ? `HTTP 400 'tryout is full' ✓` : `HTTP ${sup2.status} expected 400`)
}

async function s6_9_unpublish() {
  if (!publishedTryoutIds[0]) return r.record("6.9", "Unpublish", false, "no tryout")
  // 0.1.6 fix: PATCH /api/tryouts/[id] now accepts isPublished and writes it through.
  const patchRes = await call(`/api/tryouts/${publishedTryoutIds[0]}`, {
    method: "PATCH", jar: owner!.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ isPublished: false }),
  })
  if (patchRes.status !== 200) return r.record("6.9", "Unpublish", false, `PATCH HTTP ${patchRes.status}`)
  const t = await prisma.tryout.findUnique({ where: { id: publishedTryoutIds[0] } })
  // Verify marketplace excludes the now-unpublished tryout (unauthenticated, since 0.1.5 fixed too)
  const mp = await call("/api/tryouts?marketplace=true")
  const stillVisible = (mp.body?.tryouts ?? []).some((x: any) => x.id === publishedTryoutIds[0])
  const ok = t?.isPublished === false && !stillVisible
  r.record("6.9", "PATCH isPublished=false → unpublished + off marketplace", ok,
    ok ? `isPublished=false persisted; off marketplace ✓` : `state wrong (isPublished=${t?.isPublished}, stillVisible=${stillVisible})`)
}

function s6_10_filter() {
  r.record("6.10", "Filter tryouts via URL searchParams", "skip", "Manual UI verification — server-rendered list")
}

async function s6_11_multi_session_signups() {
  if (publishedTryoutIds.length < 3) return r.record("6.11", "Multi-session signups", false, "no setup")
  // The same player signs up to multiple sessions of the same cohort
  const parent = await makeParentWithChild("multi", 11)
  let count = 0
  for (let i = 1; i < 3; i++) {
    const sup = await call(`/api/tryouts/${publishedTryoutIds[i]}/signup`, {
      method: "POST", jar: parent.jar,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: parent.playerId }),
    })
    if (sup.status === 201 || sup.status === 200) count++
  }
  // Coach correlates by playerName/userId across tryouts (no native cohort grouping)
  const playerSignups = await prisma.tryoutSignup.count({ where: { userId: parent.userId } })
  const ok = count === 2 && playerSignups === 2
  r.record("6.11", "Same player can sign up to multiple sibling tryouts (manual cohort correlation)", ok, ok ? `2 signups across tryouts ✓ (no native cohort grouping — known)` : `${count}/2 signups`)
}

// ---------- Main ----------

async function main() {
  console.log(`\n=== Phase 6 — Tryouts ===\n`)
  await cleanup()
  await s6_1_create_draft()
  await s6_2_publish()
  await s6_3_multi_session()
  await s6_4_marketplace()
  await s6_5_parent_signs_up_child()
  await s6_6_player_self_signup()
  await s6_7_cancel_signup()
  await s6_8_capacity_enforced()
  await s6_9_unpublish()
  s6_10_filter()
  await s6_11_multi_session_signups()
  r.printSummary("Phase 6")
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
