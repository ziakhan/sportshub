/**
 * Phase 8 — Team finalization (jersey assignment + lock pending)
 *
 * Usage:
 *   cd packages/db && npx tsx /Users/ziakhan/zia/personal/sportshub/scripts/test-phase-8.ts
 */

import { prisma } from "@youthbasketballhub/db"
import { call, makeUser, Reporter } from "./lib/test-helpers"

const TEST_EMAIL_DOMAIN = "phase8-test.local"
const TEST_TENANT_SLUG_PREFIX = "phase8-test-"

const r = new Reporter()

async function cleanup() {
  const tenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: TEST_TENANT_SLUG_PREFIX } }, select: { id: true },
  })
  const tenantIds = tenants.map((t) => t.id)
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } }, select: { id: true },
  })
  const userIds = users.map((u) => u.id)

  if (tenantIds.length > 0) {
    const teams = await prisma.team.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true } })
    const teamIds = teams.map((t) => t.id)
    if (teamIds.length > 0) {
      await prisma.offer.deleteMany({ where: { teamId: { in: teamIds } } })
      await prisma.offerTemplate.deleteMany({ where: { teamId: { in: teamIds } } })
      await prisma.teamPlayer.deleteMany({ where: { teamId: { in: teamIds } } })
    }
    await prisma.userRole.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.team.deleteMany({ where: { tenantId: { in: tenantIds } } })
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

function expiresIn(daysAhead: number): string {
  const d = new Date(); d.setDate(d.getDate() + daysAhead); return d.toISOString()
}

async function setupClubWithTeams(suffix: string, teamCount = 2) {
  const owner = await makeUser({
    email: `phase8-owner-${suffix}@${TEST_EMAIL_DOMAIN}`,
    firstName: "Olive", lastName: "Owner",
    roles: ["ClubOwner"],
  })
  const tenant = await prisma.tenant.create({
    data: {
      name: `Phase8 Tenant ${suffix}`, slug: `${TEST_TENANT_SLUG_PREFIX}${suffix}`,
      contactEmail: `tenant-${suffix}@${TEST_EMAIL_DOMAIN}`,
      city: "Toronto", state: "ON", country: "CA", currency: "CAD", status: "ACTIVE",
    },
  })
  const r0 = await prisma.userRole.findFirst({ where: { userId: owner.userId, role: "ClubOwner", tenantId: null } })
  if (r0) await prisma.userRole.update({ where: { id: r0.id }, data: { tenantId: tenant.id } })
  else await prisma.userRole.create({ data: { userId: owner.userId, role: "ClubOwner", tenantId: tenant.id } })
  const teams = []
  for (let i = 0; i < teamCount; i++) {
    const team = await prisma.team.create({
      data: { name: `Phase8 Team ${i + 1}`, ageGroup: "U12", gender: "MALE", tenantId: tenant.id },
    })
    teams.push(team)
  }
  return { ...owner, tenantId: tenant.id, teamIds: teams.map((t) => t.id) }
}

async function makeParentWithChild(suffix: string, age = 11) {
  const parent = await makeUser({
    email: `phase8-parent-${suffix}@${TEST_EMAIL_DOMAIN}`,
    firstName: "Pat", lastName: "Parent",
    roles: ["Parent"],
    profileData: { type: "Parent", phoneNumber: "+14165550000", country: "CA", city: "Toronto", state: "ON" },
  })
  const dob = new Date(); dob.setFullYear(dob.getFullYear() - age)
  const playerRes = await call("/api/players", {
    method: "POST", jar: parent.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ firstName: `Kid${suffix}`, lastName: "Player", dateOfBirth: dob.toISOString().slice(0, 10), gender: "MALE", parentalConsentGiven: true }),
  })
  if (playerRes.status !== 201) throw new Error(`add player ${suffix} HTTP ${playerRes.status}`)
  return { ...parent, playerId: playerRes.body.id }
}

async function sendOfferTo(owner: any, teamId: string, parent: any, jerseyPref1: number) {
  const send = await call("/api/offers", {
    method: "POST", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      teamId, playerId: parent.playerId,
      seasonFee: 1500, installments: 3,
      expiresAt: expiresIn(7),
    }),
  })
  if (send.status !== 201 && send.status !== 200) throw new Error(`send offer HTTP ${send.status}`)
  const offer = await prisma.offer.findFirstOrThrow({ where: { teamId, playerId: parent.playerId, status: "PENDING" } })
  return offer.id
}

async function acceptOffer(parent: any, offerId: string, jerseyPref1: number) {
  const res = await call(`/api/offers/${offerId}`, {
    method: "PATCH", jar: parent.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "accept", jerseyPref1 }),
  })
  if (res.status !== 200) throw new Error(`accept HTTP ${res.status} ${JSON.stringify(res.body)}`)
}

// ---------- Scenarios ----------

let owner: Awaited<ReturnType<typeof setupClubWithTeams>> | null = null

async function s8_1_team_roster() {
  owner = await setupClubWithTeams("a", 2)
  const teamA = owner.teamIds[0]
  // 3 parents accept offers on teamA
  const parents = await Promise.all([1, 2, 3].map((i) => makeParentWithChild(`roster-${i}`, 11)))
  for (let i = 0; i < parents.length; i++) {
    const offerId = await sendOfferTo(owner, teamA, parents[i], 10 + i)
    await acceptOffer(parents[i], offerId, 10 + i)
  }
  const tps = await prisma.teamPlayer.count({ where: { teamId: teamA } })
  const ok = tps === 3
  r.record("8.1", "Team roster reflects accepted offers", ok, ok ? `${tps} TeamPlayer rows ✓` : `${tps} expected 3`)
}

async function s8_2_review_pipeline() {
  if (!owner) return r.record("8.2", "Pipeline review", false, "no setup")
  const teamA = owner.teamIds[0]
  // Add a pending offer (to-be-expired by finalize) and a declined one
  const declined = await makeParentWithChild("decl", 11)
  const declinedOfferId = await sendOfferTo(owner, teamA, declined, 50)
  await call(`/api/offers/${declinedOfferId}`, {
    method: "PATCH", jar: declined.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "decline" }),
  })
  const pending = await makeParentWithChild("pend", 11)
  await sendOfferTo(owner, teamA, pending, 60)
  const offers = await prisma.offer.findMany({ where: { teamId: teamA }, select: { status: true } })
  const statuses = new Set(offers.map((o) => o.status))
  const ok = statuses.has("ACCEPTED") && statuses.has("DECLINED") && statuses.has("PENDING")
  r.record("8.2", "Pipeline contains mixed states", ok, ok ? `${offers.length} offers, statuses=${[...statuses].join(",")} ✓` : `state wrong`)
}

async function s8_3_finalize() {
  if (!owner) return r.record("8.3", "Finalize", false, "no setup")
  const teamA = owner.teamIds[0]
  const beforePending = await prisma.offer.count({ where: { teamId: teamA, status: "PENDING" } })
  const res = await call(`/api/teams/${teamA}/finalize`, {
    method: "POST", jar: owner.jar,
  })
  if (res.status !== 200) return r.record("8.3", "Finalize", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const tps = await prisma.teamPlayer.findMany({ where: { teamId: teamA } })
  const allHaveJerseys = tps.every((t) => t.jerseyNumber !== null)
  const pendingAfter = await prisma.offer.count({ where: { teamId: teamA, status: "PENDING" } })
  const expiredAfter = await prisma.offer.count({ where: { teamId: teamA, status: "EXPIRED" } })
  const ok = allHaveJerseys && pendingAfter === 0 && expiredAfter >= beforePending
  r.record("8.3", "Finalize assigns jerseys + expires pending offers", ok,
    ok ? `${tps.length} jerseys assigned; ${beforePending}→0 pending, ${expiredAfter} expired ✓` : `state wrong`)
}

async function s8_4_remove_player() {
  if (!owner) return r.record("8.4", "Remove player", false, "no setup")
  const teamA = owner.teamIds[0]
  const tp = await prisma.teamPlayer.findFirstOrThrow({ where: { teamId: teamA } })
  // No public DELETE endpoint for TeamPlayer in current code; ClubOwner manages roster manually.
  // Verify via Prisma direct — exposes a real product gap (no remove API).
  await prisma.teamPlayer.update({ where: { id: tp.id }, data: { status: "INACTIVE" } })
  const after = await prisma.teamPlayer.findUnique({ where: { id: tp.id } })
  const ok = after?.status === "INACTIVE"
  r.record("8.4", "Remove player from finalized roster (DB-only path)", ok,
    ok ? `TeamPlayer.status=INACTIVE via DB ✓ — ⚠️ no parent/club API to soft-remove a roster slot` : `state wrong`)
}

async function s8_5_independent_finalize() {
  if (!owner) return r.record("8.5", "Independent finalize", false, "no setup")
  const teamB = owner.teamIds[1]
  // Add 2 accepted offers to teamB (different parents than teamA)
  const ps = await Promise.all([1, 2].map((i) => makeParentWithChild(`team-b-${i}`, 11)))
  for (let i = 0; i < ps.length; i++) {
    const id = await sendOfferTo(owner, teamB, ps[i], 20 + i)
    await acceptOffer(ps[i], id, 20 + i)
  }
  // Snapshot teamA jerseys before teamB finalize
  const teamAJerseys = await prisma.teamPlayer.findMany({ where: { teamId: owner.teamIds[0] }, select: { jerseyNumber: true } })
  const fin = await call(`/api/teams/${teamB}/finalize`, {
    method: "POST", jar: owner.jar,
  })
  if (fin.status !== 200) return r.record("8.5", "Independent finalize", false, `HTTP ${fin.status} ${JSON.stringify(fin.body)}`)
  const teamBPlayers = await prisma.teamPlayer.findMany({ where: { teamId: teamB } })
  const teamAAfter = await prisma.teamPlayer.findMany({ where: { teamId: owner.teamIds[0] }, select: { jerseyNumber: true } })
  const teamAUnchanged = JSON.stringify(teamAJerseys.map((j) => j.jerseyNumber).sort()) === JSON.stringify(teamAAfter.map((j) => j.jerseyNumber).sort())
  const ok = teamBPlayers.length === 2 && teamBPlayers.every((p) => p.jerseyNumber !== null) && teamAUnchanged
  r.record("8.5", "Two teams finalize independently", ok, ok ? `team B finalized, team A roster unchanged ✓` : `state wrong`)
}

// ---------- Main ----------

async function main() {
  console.log(`\n=== Phase 8 — Team finalization ===\n`)
  await cleanup()
  await s8_1_team_roster()
  await s8_2_review_pipeline()
  await s8_3_finalize()
  await s8_4_remove_player()
  await s8_5_independent_finalize()
  r.printSummary("Phase 8")
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
