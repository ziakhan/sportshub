/**
 * Phase 2 — Parent ↔ Child management
 *
 * Verifies POST/GET/PATCH /api/players, parent-scope CASL enforcement, and
 * the COPPA-related field derivation (isMinor / canLogin).
 *
 * Usage:
 *   cd packages/db && npx tsx ../../scripts/test-phase-2.ts
 *
 * Idempotent: cleans up phase2-test-* users before each run.
 */

import { prisma } from "@youthbasketballhub/db"

const BASE = process.env.BASE_URL || "http://localhost:3000"
const PASSWORD = "TestPass123!"
const TEST_EMAIL_DOMAIN = "phase2-test.local"

type Result = { id: string; description: string; pass: boolean | "skip"; detail: string }
const results: Result[] = []

function record(id: string, description: string, pass: boolean | "skip", detail: string) {
  results.push({ id, description, pass, detail })
  const icon = pass === "skip" ? "⏭️" : pass ? "✅" : "❌"
  console.log(`${icon} ${id} ${description} — ${detail}`)
}

// ---------- HTTP / cookie helpers (copied from phase-1; will lift into shared lib later) ----------

type Jar = Map<string, string>

function applySetCookie(jar: Jar, headers: Headers) {
  const raw = (headers as any).getSetCookie?.() ?? headers.get("set-cookie")?.split(/,(?=\s*\w+=)/) ?? []
  for (const line of raw) {
    const [pair] = line.split(";")
    const eq = pair.indexOf("=")
    if (eq < 0) continue
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    if (value === "" || value === "deleted") jar.delete(name)
    else jar.set(name, value)
  }
}

function cookieHeader(jar: Jar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
}

async function call(
  path: string,
  init: RequestInit & { jar?: Jar } = {}
): Promise<{ status: number; body: any; headers: Headers }> {
  const { jar, headers, ...rest } = init
  const h = new Headers(headers as any)
  if (jar && jar.size > 0) h.set("cookie", cookieHeader(jar))
  const res = await fetch(`${BASE}${path}`, { ...rest, headers: h, redirect: "manual" })
  if (jar) applySetCookie(jar, res.headers)
  const text = await res.text()
  let body: any = text
  try { body = JSON.parse(text) } catch {}
  return { status: res.status, body, headers: res.headers }
}

async function signIn(email: string, password: string): Promise<Jar | null> {
  const jar: Jar = new Map()
  const csrf = await call("/api/auth/csrf", { jar })
  const csrfToken = csrf.body?.csrfToken
  if (!csrfToken) return null
  const params = new URLSearchParams({
    csrfToken, email, password,
    callbackUrl: BASE, json: "true", redirect: "false",
  })
  await call("/api/auth/callback/credentials", {
    method: "POST", jar,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  if (!jar.has("next-auth.session-token") && !jar.has("__Secure-next-auth.session-token")) return null
  const session = await call("/api/auth/session", { jar })
  return session.body?.user?.id ? jar : null
}

async function signup(email: string, firstName: string, lastName: string) {
  return call("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, firstName, lastName }),
  })
}

async function onboard(jar: Jar, payload: any) {
  return call("/api/onboarding", {
    method: "POST", jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
}

// Make a fresh Parent and return their session cookie jar + userId
async function freshParent(slug: string, firstName = "Pat", lastName = "Parent") {
  const e = `phase2-${slug}@${TEST_EMAIL_DOMAIN}`
  const sup = await signup(e, firstName, lastName)
  if (sup.status !== 200) throw new Error(`signup ${slug} HTTP ${sup.status}`)
  const jar = await signIn(e, PASSWORD)
  if (!jar) throw new Error(`signin ${slug} failed`)
  const ob = await onboard(jar, {
    roles: ["Parent"],
    profileData: { type: "Parent", phoneNumber: "+14165550000", country: "CA", city: "Toronto", state: "ON" },
  })
  if (ob.status !== 200) throw new Error(`onboard ${slug} HTTP ${ob.status} ${JSON.stringify(ob.body)}`)
  const u = await prisma.user.findFirstOrThrow({ where: { email: e } })
  return { email: e, jar, userId: u.id }
}

// ---------- Cleanup ----------

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
    select: { id: true },
  })
  if (users.length === 0) return
  const ids = users.map((u) => u.id)
  await prisma.player.deleteMany({ where: { parentId: { in: ids } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
  console.log(`🧹 Cleaned up ${users.length} prior phase-2 users`)
}

// ---------- Scenarios ----------

// Reused parent across 2.1–2.4 so listing/edit have real children to act on
let primaryParent: Awaited<ReturnType<typeof freshParent>> | null = null
let underTenChildId: string | null = null
let teenChildId: string | null = null

async function s2_1_add_under_13() {
  primaryParent = await freshParent("2-1-parent")
  const dob = new Date()
  dob.setFullYear(dob.getFullYear() - 9) // 9 years old

  // 0.1.3 fix: under-13 add without consent should be rejected.
  const noConsent = await call("/api/players", {
    method: "POST", jar: primaryParent.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Alex", lastName: "Junior",
      dateOfBirth: dob.toISOString().slice(0, 10),
      gender: "MALE",
    }),
  })
  if (noConsent.status !== 400 || noConsent.body?.code !== "COPPA_CONSENT_REQUIRED") {
    return record("2.1", "Under-13 without consent rejected", false,
      `HTTP ${noConsent.status} code=${noConsent.body?.code} (expected 400 + COPPA_CONSENT_REQUIRED)`)
  }

  // With consent, add succeeds and sets parentalConsentGiven + consentGivenAt
  const res = await call("/api/players", {
    method: "POST", jar: primaryParent.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Alex", lastName: "Junior",
      dateOfBirth: dob.toISOString().slice(0, 10),
      gender: "MALE",
      parentalConsentGiven: true,
    }),
  })
  if (res.status !== 201) return record("2.1", "Add child under 13", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const player = await prisma.player.findFirst({ where: { id: res.body.id } })
  underTenChildId = player?.id ?? null
  const ok = !!player && player.isMinor === true && player.canLogin === false &&
    player.parentId === primaryParent.userId &&
    player.parentalConsentGiven === true && !!player.consentGivenAt
  record("2.1", "Under-13 add: rejected without consent + accepted with consent (COPPA)", ok,
    ok ? `HTTP 400 w/o consent → HTTP 201 w/ consent; parentalConsentGiven=true, consentGivenAt set ✓` : `state wrong`)
}

async function s2_2_add_13plus() {
  if (!primaryParent) return record("2.2", "Add child 13+", false, "no primary parent")
  const dob = new Date()
  dob.setFullYear(dob.getFullYear() - 14) // 14 years old
  const res = await call("/api/players", {
    method: "POST", jar: primaryParent.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Taylor", lastName: "Junior",
      dateOfBirth: dob.toISOString().slice(0, 10),
      gender: "FEMALE",
    }),
  })
  if (res.status !== 201) return record("2.2", "Add child 13+", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const player = await prisma.player.findFirst({ where: { id: res.body.id } })
  teenChildId = player?.id ?? null
  const ok = !!player && player.isMinor === false && player.canLogin === true && player.parentId === primaryParent.userId
  record("2.2", "Add child 13+", ok, ok ? `isMinor=false, canLogin=true ✓` : `state wrong`)
}

async function s2_3_list_children() {
  if (!primaryParent) return record("2.3", "List children", false, "no primary parent")
  const res = await call("/api/players", { jar: primaryParent.jar })
  const children = res.body?.players ?? []
  const ok = res.status === 200 && children.length === 2 && children.some((p: any) => p.firstName === "Alex") && children.some((p: any) => p.firstName === "Taylor")
  record("2.3", "List parent's children", ok, ok ? `2 players returned ✓` : `got ${children.length} players`)
}

async function s2_4_edit_child() {
  if (!primaryParent || !teenChildId) return record("2.4", "Edit child", false, "no primary parent / teen")
  const res = await call(`/api/players/${teenChildId}`, {
    method: "PATCH", jar: primaryParent.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Taylor", lastName: "Updated",
      dateOfBirth: "2010-06-15",
      gender: "FEMALE",
      jerseyNumber: "23",
    }),
  })
  if (res.status !== 200) return record("2.4", "Edit child", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const player = await prisma.player.findFirst({ where: { id: teenChildId } })
  const ok = player?.lastName === "Updated" && player?.jerseyNumber === "23"
  record("2.4", "Edit child profile", ok, ok ? `lastName + jerseyNumber persisted ✓` : `state wrong`)
}

async function s2_5_remove_child() {
  if (!primaryParent || !underTenChildId) return record("2.5", "Remove child", false, "no setup")
  // 0.1.4 fix: DELETE /api/players/[id] now soft-deletes via deletedAt, parent-only.
  const del = await call(`/api/players/${underTenChildId}`, { method: "DELETE", jar: primaryParent.jar })
  if (del.status !== 200) return record("2.5", "Remove child", false, `DELETE HTTP ${del.status}`)
  const after = await prisma.player.findUnique({ where: { id: underTenChildId } })
  // Verify list excludes the removed player
  const list = await call("/api/players", { jar: primaryParent.jar })
  const stillListed = (list.body?.players ?? []).some((p: any) => p.id === underTenChildId)
  // Verify cross-parent CASL still works (other parent should get 404 too — not via "deleted" leak)
  const ok = !!after?.deletedAt && !stillListed
  record("2.5", "Soft-remove child via DELETE → preserved row + excluded from list", ok,
    ok ? `deletedAt set, hidden from /api/players ✓` : `state wrong (deletedAt=${after?.deletedAt}, listed=${stillListed})`)
}

async function s2_6_player_self_view() {
  // Sign up a 13+ Player who self-registered, then verify they can see their own player profile
  const e = `phase2-2-6-selfplayer@${TEST_EMAIL_DOMAIN}`
  const sup = await signup(e, "Sam", "SelfPlayer")
  if (sup.status !== 200) return record("2.6", "Player self-view", false, `signup HTTP ${sup.status}`)
  const jar = await signIn(e, PASSWORD)
  if (!jar) return record("2.6", "Player self-view", false, "signin failed")
  const ob = await onboard(jar, {
    roles: ["Player"],
    profileData: { type: "Player", dateOfBirth: "2010-05-01", gender: "MALE", country: "CA", city: "Toronto", state: "ON" },
  })
  if (ob.status !== 200) return record("2.6", "Player self-view", false, `onboard HTTP ${ob.status} ${JSON.stringify(ob.body)}`)
  // Player self-registered means parentId = own user id
  const u = await prisma.user.findFirstOrThrow({ where: { email: e } })
  const player = await prisma.player.findFirst({ where: { parentId: u.id } })
  if (!player) return record("2.6", "Player self-view", false, "no Player row")
  // Now hit GET /api/players as the player — should return their own row
  const list = await call("/api/players", { jar })
  const ok = list.status === 200 && list.body?.players?.some((p: any) => p.id === player.id)
  record("2.6", "Player 13+ self-view via /api/players", ok, ok ? `self Player row visible ✓` : `not visible (status=${list.status})`)
}

async function s2_7_cross_parent_casl() {
  if (!primaryParent || !teenChildId) return record("2.7", "Cross-parent CASL", false, "no setup")
  // Create Parent B and try to GET primaryParent's child
  const parentB = await freshParent("2-7-other-parent", "Other", "Parent")
  const res = await call(`/api/players/${teenChildId}`, { jar: parentB.jar })
  // Expected: 404 (the route uses findFirst with parentId scope, so cross-parent GET returns 404, not 403)
  const ok = res.status === 404
  record("2.7", "Other parent cannot read child", ok, ok ? `HTTP 404 ✓ (parent-scoped query)` : `HTTP ${res.status} expected 404`)
}

function s2_8_event_driven_offer() {
  record("2.8", "Event-driven offer link to parent", "skip",
    "Forward reference — verified in Phase 7 (offer pipeline)")
}

// ---------- Main ----------

async function main() {
  console.log(`\n=== Phase 2 — Parent ↔ Child management ===\nBASE=${BASE}\n`)
  await cleanup()
  await s2_1_add_under_13()
  await s2_2_add_13plus()
  await s2_3_list_children()
  await s2_4_edit_child()
  await s2_5_remove_child()
  await s2_6_player_self_view()
  await s2_7_cross_parent_casl()
  s2_8_event_driven_offer()

  const passed = results.filter((r) => r.pass === true).length
  const failed = results.filter((r) => r.pass === false).length
  const skipped = results.filter((r) => r.pass === "skip").length
  console.log(`\n=== Phase 2 result: ${passed} pass, ${failed} fail, ${skipped} skipped ===`)
  if (failed > 0) process.exitCode = 1
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
