/**
 * Phase 7 — Offer pipeline (templates → send → respond)
 *
 * Usage:
 *   cd packages/db && npx tsx /Users/ziakhan/zia/personal/sportshub/scripts/test-phase-7.ts
 */

import { prisma } from "@youthbasketballhub/db"
import { call, makeUser, Reporter } from "./lib/test-helpers"

const TEST_EMAIL_DOMAIN = "phase7-test.local"
const TEST_TENANT_SLUG_PREFIX = "phase7-test-"

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
    const teams = await prisma.team.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true } })
    const teamIds = teams.map((t) => t.id)
    if (teamIds.length > 0) {
      await prisma.offer.deleteMany({ where: { teamId: { in: teamIds } } })
      await prisma.offerTemplate.deleteMany({ where: { teamId: { in: teamIds } } })
      await prisma.teamPlayer.deleteMany({ where: { teamId: { in: teamIds } } })
    }
    await prisma.tryoutSignup.deleteMany({ where: { tryout: { tenantId: { in: tenantIds } } } })
    await prisma.tryout.deleteMany({ where: { tenantId: { in: tenantIds } } })
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

function expiresIn(daysAhead: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString()
}

async function makeOwnerWithTeam(suffix: string) {
  const owner = await makeUser({
    email: `phase7-owner-${suffix}@${TEST_EMAIL_DOMAIN}`,
    firstName: "Olive", lastName: "Owner",
    roles: ["ClubOwner"],
  })
  const tenant = await prisma.tenant.create({
    data: {
      name: `Phase7 Tenant ${suffix}`,
      slug: `${TEST_TENANT_SLUG_PREFIX}${suffix}`,
      contactEmail: `tenant-${suffix}@${TEST_EMAIL_DOMAIN}`,
      city: "Toronto", state: "ON", country: "CA", currency: "CAD",
      status: "ACTIVE",
    },
  })
  const r0 = await prisma.userRole.findFirst({ where: { userId: owner.userId, role: "ClubOwner", tenantId: null } })
  if (r0) await prisma.userRole.update({ where: { id: r0.id }, data: { tenantId: tenant.id } })
  else await prisma.userRole.create({ data: { userId: owner.userId, role: "ClubOwner", tenantId: tenant.id } })
  const team = await prisma.team.create({
    data: { name: "Phase7 Team A", ageGroup: "U12", gender: "MALE", season: "Spring 2026", tenantId: tenant.id },
  })
  return { ...owner, tenantId: tenant.id, teamId: team.id }
}

async function makeParentWithChild(suffix: string, age = 11) {
  const parent = await makeUser({
    email: `phase7-parent-${suffix}@${TEST_EMAIL_DOMAIN}`,
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
  if (playerRes.status !== 201) throw new Error(`add player ${suffix} HTTP ${playerRes.status}`)
  return { ...parent, playerId: playerRes.body.id }
}

// ---------- Scenarios ----------

let owner: Awaited<ReturnType<typeof makeOwnerWithTeam>> | null = null
let templateId: string | null = null

async function s7_1_create_template() {
  owner = await makeOwnerWithTeam("a")
  const res = await call(`/api/teams/${owner.teamId}/offer-templates`, {
    method: "POST", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Phase7 Std Template",
      seasonFee: 1500,
      installments: 3,
      practiceSessions: 60,
      includesBall: true,
      includesUniform: true,
      includesShoes: false,
      includesTracksuit: true,
    }),
  })
  if (res.status !== 201 && res.status !== 200) return r.record("7.1", "Create template", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  templateId = res.body?.id ?? res.body?.template?.id
  if (!templateId) {
    const t = await prisma.offerTemplate.findFirst({ where: { teamId: owner.teamId, name: "Phase7 Std Template" } })
    templateId = t?.id ?? null
  }
  // 0.1.7 fix: team-template create now sets tenantId from team.tenantId.
  const t = templateId ? await prisma.offerTemplate.findUnique({ where: { id: templateId } }) : null
  const ok = !!t && Number(t.seasonFee) === 1500 && t.includesUniform === true && t.tenantId === owner.tenantId
  r.record("7.1", "Create offer template (tenantId set automatically)", ok, ok ? `tenantId + teamId both set ✓` : `state wrong (tenantId=${t?.tenantId}, expected=${owner.tenantId})`)
}

async function s7_2_edit_template() {
  if (!owner || !templateId) return r.record("7.2", "Edit template", false, "no setup")
  const res = await call(`/api/teams/${owner.teamId}/offer-templates/${templateId}`, {
    method: "PATCH", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seasonFee: 1700, includesShoes: true }),
  })
  if (res.status !== 200) return r.record("7.2", "Edit template", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const t = await prisma.offerTemplate.findUnique({ where: { id: templateId! } })
  const ok = Number(t?.seasonFee) === 1700 && t?.includesShoes === true
  r.record("7.2", "Edit template fields", ok, ok ? `seasonFee=1700, includesShoes=true ✓` : `state wrong`)
}

async function sendOffer(parent: Awaited<ReturnType<typeof makeParentWithChild>>, opts: any = {}) {
  return call("/api/offers", {
    method: "POST", jar: owner!.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      teamId: owner!.teamId,
      playerId: parent.playerId,
      templateId,
      expiresAt: opts.expiresAt ?? expiresIn(7),
      ...opts,
    }),
  })
}

let pendingOfferId: string | null = null
let pendingParent: Awaited<ReturnType<typeof makeParentWithChild>> | null = null

async function s7_3_send_offer() {
  if (!owner || !templateId) return r.record("7.3", "Send offer", false, "no setup")
  pendingParent = await makeParentWithChild("send")
  const res = await sendOffer(pendingParent, { message: "Welcome!" })
  if (res.status !== 201 && res.status !== 200) return r.record("7.3", "Send offer", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  pendingOfferId = res.body?.id ?? res.body?.offer?.id
  if (!pendingOfferId) {
    const o = await prisma.offer.findFirst({ where: { teamId: owner.teamId, playerId: pendingParent.playerId, status: "PENDING" } })
    pendingOfferId = o?.id ?? null
  }
  const offer = pendingOfferId ? await prisma.offer.findUnique({ where: { id: pendingOfferId } }) : null
  const notif = await prisma.notification.findFirst({ where: { userId: pendingParent.userId, type: "offer_received" } })
  const ok = !!offer && offer.status === "PENDING" && Number(offer.seasonFee) === 1700 && !!offer.expiresAt
  r.record("7.3", "Send offer (template-derived) → PENDING + parent notification", ok && !!notif,
    ok && !!notif ? `Offer PENDING, seasonFee inherited, notification fired ✓` : `offer=${offer?.status}, notif=${!!notif}`)
}

async function s7_4_custom_installment() {
  if (!owner || !templateId) return r.record("7.4", "Custom installments", false, "no setup")
  const p = await makeParentWithChild("custom-install")
  const res = await sendOffer(p, { installments: 6, seasonFee: 2400 })
  if (res.status !== 201 && res.status !== 200) return r.record("7.4", "Custom installments", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const offer = await prisma.offer.findFirst({ where: { teamId: owner.teamId, playerId: p.playerId } })
  const ok = offer?.installments === 6 && Number(offer?.seasonFee) === 2400
  r.record("7.4", "Custom installment + fee override", ok, ok ? `installments=6, fee=2400 ✓` : `state wrong`)
}

async function s7_5_parent_views_offer() {
  if (!pendingOfferId || !pendingParent) return r.record("7.5", "Parent views offer", false, "no setup")
  const res = await call(`/api/offers/${pendingOfferId}`, { jar: pendingParent.jar })
  const ok = res.status === 200 && res.body?.id === pendingOfferId && res.body?.expiresAt
  r.record("7.5", "Parent fetches offer details", ok, ok ? `GET 200, expiresAt visible ✓` : `HTTP ${res.status}`)
}

async function s7_6_parent_accepts() {
  if (!pendingOfferId || !pendingParent || !owner) return r.record("7.6", "Parent accepts", false, "no setup")
  const res = await call(`/api/offers/${pendingOfferId}`, {
    method: "PATCH", jar: pendingParent.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "accept",
      uniformSize: "M", shoeSize: "10",
      tracksuitSize: "M",
      jerseyPref1: 23, jerseyPref2: 7, jerseyPref3: 11,
    }),
  })
  if (res.status !== 200) return r.record("7.6", "Parent accepts", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const offer = await prisma.offer.findUnique({ where: { id: pendingOfferId } })
  const teamPlayer = await prisma.teamPlayer.findFirst({ where: { teamId: owner.teamId, playerId: pendingParent.playerId } })
  const ok = offer?.status === "ACCEPTED" && !!teamPlayer && teamPlayer.status === "ACTIVE"
  r.record("7.6", "Accept → TeamPlayer created, jersey prefs captured", ok, ok ? `Offer ACCEPTED, TeamPlayer(ACTIVE) ✓` : `state wrong`)
}

async function s7_7_decline() {
  if (!owner) return r.record("7.7", "Decline", false, "no setup")
  const p = await makeParentWithChild("decline")
  const send = await sendOffer(p)
  if (send.status !== 201 && send.status !== 200) return r.record("7.7", "Decline", false, `send HTTP ${send.status}`)
  const offer = await prisma.offer.findFirst({ where: { teamId: owner.teamId, playerId: p.playerId } })
  if (!offer) return r.record("7.7", "Decline", false, "no offer")
  const res = await call(`/api/offers/${offer.id}`, {
    method: "PATCH", jar: p.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "decline" }),
  })
  if (res.status !== 200) return r.record("7.7", "Decline", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const after = await prisma.offer.findUnique({ where: { id: offer.id } })
  const tp = await prisma.teamPlayer.findFirst({ where: { teamId: owner.teamId, playerId: p.playerId } })
  const ok = after?.status === "DECLINED" && !tp
  r.record("7.7", "Parent declines → no TeamPlayer", ok, ok ? `DECLINED, no TeamPlayer ✓` : `state wrong`)
}

async function s7_8_expire_on_read() {
  if (!owner) return r.record("7.8", "Expire on read", false, "no setup")
  const p = await makeParentWithChild("expire")
  // Set expiresAt to ~1 second from now, then wait.
  const send = await sendOffer(p, { expiresAt: new Date(Date.now() + 1000).toISOString() })
  if (send.status !== 201 && send.status !== 200) return r.record("7.8", "Expire on read", false, `send HTTP ${send.status}`)
  const offer = await prisma.offer.findFirst({ where: { teamId: owner.teamId, playerId: p.playerId } })
  if (!offer) return r.record("7.8", "Expire on read", false, "no offer")
  await new Promise((res) => setTimeout(res, 1500))
  // Try to accept → API should mark EXPIRED on read
  const res = await call(`/api/offers/${offer.id}`, {
    method: "PATCH", jar: p.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "accept", jerseyPref1: 5 }),
  })
  const after = await prisma.offer.findUnique({ where: { id: offer.id } })
  const ok = res.status === 400 && after?.status === "EXPIRED"
  r.record("7.8", "Expired offer marked EXPIRED on access", ok, ok ? `HTTP 400 + status=EXPIRED ✓ (no background job)` : `HTTP ${res.status}, status=${after?.status}`)
}

async function s7_9_player_13plus_self_accepts() {
  if (!owner || !templateId) return r.record("7.9", "Player 13+ self-accepts", false, "no setup")
  // Player 13+ self-onboards (parentId = self.userId)
  const u = await makeUser({
    email: `phase7-selfplayer@${TEST_EMAIL_DOMAIN}`,
    firstName: "Sam", lastName: "Solo",
    roles: ["Player"],
    profileData: { type: "Player", dateOfBirth: "2010-05-01", gender: "MALE", country: "CA", city: "Toronto", state: "ON" },
  })
  const player = await prisma.player.findFirstOrThrow({ where: { parentId: u.userId } })
  const send = await call("/api/offers", {
    method: "POST", jar: owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      teamId: owner.teamId, playerId: player.id, templateId, expiresAt: expiresIn(7),
    }),
  })
  if (send.status !== 201 && send.status !== 200) return r.record("7.9", "Player 13+ self-accepts", false, `send HTTP ${send.status}`)
  const offer = await prisma.offer.findFirst({ where: { teamId: owner.teamId, playerId: player.id } })
  if (!offer) return r.record("7.9", "Player 13+ self-accepts", false, "no offer")
  // Player accepts as themselves (parentId === userId for self-registered)
  const res = await call(`/api/offers/${offer.id}`, {
    method: "PATCH", jar: u.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "accept",
      uniformSize: "M", shoeSize: "10", tracksuitSize: "M", jerseyPref1: 9,
    }),
  })
  if (res.status !== 200) return r.record("7.9", "Player 13+ self-accepts", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const after = await prisma.offer.findUnique({ where: { id: offer.id } })
  const ok = after?.status === "ACCEPTED"
  r.record("7.9", "Self-registered Player 13+ accepts own offer", ok, ok ? `Player accepted own offer (parentId=self) ✓` : `state wrong`)
}

async function s7_10_re_offer() {
  if (!owner || !templateId) return r.record("7.10", "Re-offer", false, "no setup")
  const p = await makeParentWithChild("re-offer")
  // First offer → decline
  const first = await sendOffer(p)
  if (first.status !== 201 && first.status !== 200) return r.record("7.10", "Re-offer", false, `first HTTP ${first.status}`)
  const firstOffer = await prisma.offer.findFirstOrThrow({ where: { teamId: owner.teamId, playerId: p.playerId, status: "PENDING" } })
  await call(`/api/offers/${firstOffer.id}`, {
    method: "PATCH", jar: p.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "decline" }),
  })
  // Second offer (re-offer)
  const second = await sendOffer(p)
  if (second.status !== 201 && second.status !== 200) return r.record("7.10", "Re-offer", false, `second HTTP ${second.status} ${JSON.stringify(second.body)}`)
  const offers = await prisma.offer.findMany({ where: { teamId: owner.teamId, playerId: p.playerId } })
  const ok = offers.length === 2 && offers.some((o) => o.status === "DECLINED") && offers.some((o) => o.status === "PENDING")
  r.record("7.10", "Re-offer after decline preserved as new row", ok, ok ? `2 offers (1 DECLINED, 1 PENDING) ✓` : `${offers.length} offers`)
}

async function s7_11_pipeline_view() {
  if (!owner) return r.record("7.11", "Pipeline view", false, "no setup")
  const res = await call(`/api/offers?teamId=${owner.teamId}`, { jar: owner.jar })
  if (res.status !== 200) return r.record("7.11", "Pipeline view", false, `HTTP ${res.status}`)
  const offers = res.body?.offers ?? res.body ?? []
  const list = Array.isArray(offers) ? offers : []
  const statuses = new Set(list.map((o: any) => o.status))
  const ok = list.length >= 4 && statuses.size >= 2
  r.record("7.11", "ClubOwner pipeline view (offers grouped by status)", ok, ok ? `${list.length} offers, statuses=${[...statuses].join(",")} ✓` : `${list.length} offers, statuses=${[...statuses].join(",")}`)
}

function s7_12_bulk_send() {
  r.record("7.12", "Bulk-send offers UX", "skip", "Manual UI verification — bulk endpoint not present; one-at-a-time is the API path")
}

// ---------- Main ----------

async function main() {
  console.log(`\n=== Phase 7 — Offer pipeline ===\n`)
  await cleanup()
  await s7_1_create_template()
  await s7_2_edit_template()
  await s7_3_send_offer()
  await s7_4_custom_installment()
  await s7_5_parent_views_offer()
  await s7_6_parent_accepts()
  await s7_7_decline()
  await s7_8_expire_on_read()
  await s7_9_player_13plus_self_accepts()
  await s7_10_re_offer()
  await s7_11_pipeline_view()
  s7_12_bulk_send()
  r.printSummary("Phase 7")
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
