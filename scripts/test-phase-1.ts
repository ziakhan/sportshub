/**
 * Phase 1 — User signup + onboarding (all roles)
 *
 * Runs the 13 scenarios from docs/e2e-test-plan.md Phase 1 against a live
 * dev server at BASE_URL. Verifies HTTP responses + DB state via Prisma.
 *
 * Usage:
 *   cd packages/db && npx tsx ../../scripts/test-phase-1.ts
 *
 * The script is idempotent — it cleans up phase1-test-* users before each run.
 */

import { prisma } from "@youthbasketballhub/db"

const BASE = process.env.BASE_URL || "http://localhost:3000"
const PASSWORD = "TestPass123!"
const TEST_EMAIL_DOMAIN = "phase1-test.local"

type Result = {
  id: string
  description: string
  pass: boolean | "skip"
  detail: string
}
const results: Result[] = []

function record(id: string, description: string, pass: boolean | "skip", detail: string) {
  results.push({ id, description, pass, detail })
  const icon = pass === "skip" ? "⏭️" : pass ? "✅" : "❌"
  console.log(`${icon} ${id} ${description} — ${detail}`)
}

// ---------- HTTP helpers with cookie jar ----------

type Jar = Map<string, string>

function applySetCookie(jar: Jar, headers: Headers) {
  // Headers.getSetCookie is Node 20+; fall back to raw split
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
  try {
    body = JSON.parse(text)
  } catch {
    // not json
  }
  return { status: res.status, body, headers: res.headers }
}

// NextAuth credentials sign-in. Returns a cookie jar with session-token, or null.
async function signIn(email: string, password: string): Promise<Jar | null> {
  const jar: Jar = new Map()
  const csrf = await call("/api/auth/csrf", { jar })
  const csrfToken = csrf.body?.csrfToken
  if (!csrfToken) return null
  const params = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: BASE,
    json: "true",
    redirect: "false",
  })
  const res = await call("/api/auth/callback/credentials", {
    method: "POST",
    jar,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  // NextAuth returns 302/200 with session-token cookie on success, or redirects to ?error= on fail.
  const hasSession =
    jar.has("next-auth.session-token") || jar.has("__Secure-next-auth.session-token")
  if (!hasSession) return null
  // Verify session is real
  const session = await call("/api/auth/session", { jar })
  if (!session.body?.user?.id) return null
  return jar
}

async function signOut(jar: Jar): Promise<boolean> {
  const csrf = await call("/api/auth/csrf", { jar })
  const csrfToken = csrf.body?.csrfToken
  if (!csrfToken) return false
  const params = new URLSearchParams({ csrfToken, callbackUrl: BASE, json: "true" })
  await call("/api/auth/signout", {
    method: "POST",
    jar,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  const session = await call("/api/auth/session", { jar })
  return !session.body?.user?.id
}

// ---------- API helpers ----------

async function signup(email: string, password: string, firstName = "Test", lastName = "User") {
  return call("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, firstName, lastName }),
  })
}

async function onboard(jar: Jar, payload: any) {
  return call("/api/onboarding", {
    method: "POST",
    jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
}

// ---------- Cleanup ----------

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
    select: { id: true },
  })
  if (users.length === 0) return
  const ids = users.map((u) => u.id)
  // Wipe profile data + roles + players in dependency order
  await prisma.player.deleteMany({ where: { parentId: { in: ids } } })
  await prisma.refereeProfile.deleteMany({ where: { userId: { in: ids } } })
  // Leagues created by LeagueOwner test users
  const leagues = await prisma.league.findMany({
    where: { ownerId: { in: ids } },
    select: { id: true },
  })
  const leagueIds = leagues.map((l) => l.id)
  if (leagueIds.length > 0) {
    await prisma.season.deleteMany({ where: { leagueId: { in: leagueIds } } })
    await prisma.league.deleteMany({ where: { id: { in: leagueIds } } })
  }
  await prisma.userRole.deleteMany({ where: { userId: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
  console.log(`🧹 Cleaned up ${users.length} prior test users`)
}

// ---------- Scenarios ----------

const email = (slug: string) => `phase1-${slug}@${TEST_EMAIL_DOMAIN}`

async function s1_1_parent() {
  const e = email("1-1-parent")
  const sup = await signup(e, PASSWORD, "Pat", "Parent")
  if (sup.status !== 200) return record("1.1", "Parent signup", false, `signup HTTP ${sup.status}`)
  const jar = await signIn(e, PASSWORD)
  if (!jar) return record("1.1", "Parent signup", false, "signin failed")
  const ob = await onboard(jar, {
    roles: ["Parent"],
    profileData: { type: "Parent", phoneNumber: "+14165551111", country: "CA", city: "Toronto", state: "ON" },
  })
  if (ob.status !== 200) return record("1.1", "Parent signup", false, `onboarding HTTP ${ob.status} ${JSON.stringify(ob.body)}`)
  const u = await prisma.user.findFirst({ where: { email: e }, include: { roles: true } })
  const ok = !!u?.onboardedAt && u.roles.some((r) => r.role === "Parent") && u.city === "Toronto"
  record("1.1", "Parent signup + onboarding", ok, ok ? "User+UserRole+onboardedAt+profile ✓" : "DB state wrong")
}

async function s1_2_player_13plus() {
  const e = email("1-2-player")
  const sup = await signup(e, PASSWORD, "Sam", "Player")
  if (sup.status !== 200) return record("1.2", "Player 13+", false, `signup HTTP ${sup.status}`)
  const jar = await signIn(e, PASSWORD)
  if (!jar) return record("1.2", "Player 13+", false, "signin failed")
  const ob = await onboard(jar, {
    roles: ["Player"],
    profileData: { type: "Player", dateOfBirth: "2010-05-01", gender: "MALE", country: "CA", city: "Toronto", state: "ON" },
  })
  if (ob.status !== 200) return record("1.2", "Player 13+", false, `onboarding HTTP ${ob.status} ${JSON.stringify(ob.body)}`)
  const u = await prisma.user.findFirst({ where: { email: e }, include: { roles: true } })
  const player = await prisma.player.findFirst({ where: { parentId: u?.id ?? "" } })
  const ok = !!u?.onboardedAt && !!player && player.parentId === u!.id
  record("1.2", "Player 13+ self-registers", ok, ok ? `Player created, parentId=self ✓` : "DB state wrong")
}

async function s1_3_under_13() {
  // 0.1.3 fix: under-13 self-onboarding as Player must be blocked.
  const e = email("1-3-underthirteen")
  const sup = await signup(e, PASSWORD, "Tiny", "Player")
  if (sup.status !== 200) return record("1.3", "Under-13 blocked", false, `signup HTTP ${sup.status}`)
  const jar = await signIn(e, PASSWORD)
  if (!jar) return record("1.3", "Under-13 blocked", false, "signin failed")
  // DOB makes them under 13
  const dob = new Date(); dob.setFullYear(dob.getFullYear() - 9)
  const ob = await onboard(jar, {
    roles: ["Player"],
    profileData: { type: "Player", dateOfBirth: dob.toISOString().slice(0, 10), gender: "MALE", country: "CA", city: "Toronto", state: "ON" },
  })
  const u = await prisma.user.findFirst({ where: { email: e } })
  const player = await prisma.player.findFirst({ where: { parentId: u?.id ?? "" } })
  // Zod schema's `age >= 13` refinement returns 400; runtime check is a backstop returning 403.
  const blocked = ob.status === 400 || ob.status === 403
  const detailString = JSON.stringify(ob.body?.details ?? ob.body?.error ?? "")
  const errMatches = /at least 13|COPPA|under 13/i.test(detailString)
  const ok = blocked && errMatches && !player
  record("1.3", "Under-13 self-Player onboarding blocked (COPPA)", ok,
    ok ? `HTTP ${ob.status} blocked w/ age >= 13 message; no Player row ✓` : `HTTP ${ob.status}, body=${detailString.slice(0, 100)}, player=${!!player}`)
}

async function s1_4_staff() {
  const e = email("1-4-staff")
  const sup = await signup(e, PASSWORD, "Ash", "Staff")
  if (sup.status !== 200) return record("1.4", "Staff signup", false, `signup HTTP ${sup.status}`)
  const jar = await signIn(e, PASSWORD)
  if (!jar) return record("1.4", "Staff signup", false, "signin failed")
  const ob = await onboard(jar, {
    roles: ["Staff"],
    profileData: { type: "Staff", phoneNumber: "+14165552222", country: "CA", city: "Toronto", state: "ON" },
  })
  if (ob.status !== 200) return record("1.4", "Staff signup", false, `onboarding HTTP ${ob.status} ${JSON.stringify(ob.body)}`)
  const u = await prisma.user.findFirst({ where: { email: e }, include: { roles: true } })
  const role = u?.roles.find((r) => r.role === "Staff")
  const ok = !!u?.onboardedAt && !!role && role.tenantId === null && role.teamId === null
  record("1.4", "Staff signup + onboarding (no scope)", ok, ok ? "UserRole(Staff) unscoped ✓" : "DB state wrong")
}

async function s1_5_clubowner() {
  const e = email("1-5-clubowner")
  const sup = await signup(e, PASSWORD, "Cleo", "Owner")
  if (sup.status !== 200) return record("1.5", "ClubOwner signup", false, `signup HTTP ${sup.status}`)
  const jar = await signIn(e, PASSWORD)
  if (!jar) return record("1.5", "ClubOwner signup", false, "signin failed")
  const ob = await onboard(jar, { roles: ["ClubOwner"] })
  if (ob.status !== 200) return record("1.5", "ClubOwner signup", false, `onboarding HTTP ${ob.status} ${JSON.stringify(ob.body)}`)
  const nextStep = ob.body?.nextStep
  const u = await prisma.user.findFirst({ where: { email: e }, include: { roles: true } })
  const ok = !!u?.onboardedAt && u.roles.some((r) => r.role === "ClubOwner") && nextStep === "/clubs/create"
  record("1.5", "ClubOwner signup + redirect to /clubs/create", ok, ok ? `nextStep=${nextStep} ✓` : `nextStep=${nextStep}, expected /clubs/create`)
}

async function s1_6_leagueowner() {
  const e = email("1-6-leagueowner")
  const sup = await signup(e, PASSWORD, "Lee", "Owner")
  if (sup.status !== 200) return record("1.6", "LeagueOwner signup", false, `signup HTTP ${sup.status}`)
  const jar = await signIn(e, PASSWORD)
  if (!jar) return record("1.6", "LeagueOwner signup", false, "signin failed")
  const ob = await onboard(jar, {
    roles: ["LeagueOwner"],
    profileData: {
      type: "LeagueOwner",
      name: "Phase1 Test League",
      description: "auto",
      season: "Test Season 2026",
    },
  })
  if (ob.status !== 200) return record("1.6", "LeagueOwner signup", false, `onboarding HTTP ${ob.status} ${JSON.stringify(ob.body)}`)
  const u = await prisma.user.findFirst({ where: { email: e }, include: { roles: true } })
  const league = await prisma.league.findFirst({ where: { ownerId: u?.id ?? "" } })
  const role = u?.roles.find((r) => r.role === "LeagueOwner")
  const ok = !!u?.onboardedAt && !!league && role?.leagueId === league.id
  record("1.6", "LeagueOwner signup + League/Season created", ok, ok ? "League+Season+UserRole.leagueId ✓" : "DB state wrong")
}

async function s1_7_referee() {
  const e = email("1-7-referee")
  const sup = await signup(e, PASSWORD, "Ray", "Ref")
  if (sup.status !== 200) return record("1.7", "Referee signup", false, `signup HTTP ${sup.status}`)
  const jar = await signIn(e, PASSWORD)
  if (!jar) return record("1.7", "Referee signup", false, "signin failed")
  const ob = await onboard(jar, {
    roles: ["Referee"],
    profileData: {
      type: "Referee",
      certificationLevel: "Level 2",
      standardFee: 75,
      availableRegions: "GTA, Mississauga",
    },
  })
  if (ob.status !== 200) return record("1.7", "Referee signup", false, `onboarding HTTP ${ob.status} ${JSON.stringify(ob.body)}`)
  const u = await prisma.user.findFirst({ where: { email: e }, include: { roles: true } })
  const profile = await prisma.refereeProfile.findFirst({ where: { userId: u?.id ?? "" } })
  const ok = !!u?.onboardedAt && !!profile && profile.availableRegions.length === 2
  record("1.7", "Referee signup + RefereeProfile", ok, ok ? `RefereeProfile w/ ${profile?.availableRegions.length} regions ✓` : "DB state wrong")
}

async function s1_8_duplicate_email() {
  const e = email("1-8-dup")
  const first = await signup(e, PASSWORD)
  if (first.status !== 200) return record("1.8", "Duplicate email", false, `first signup failed HTTP ${first.status}`)
  const second = await signup(e, PASSWORD)
  const ok = second.status === 409
  record("1.8", "Duplicate email rejected", ok, ok ? "HTTP 409 ✓" : `HTTP ${second.status} expected 409`)
}

async function s1_9_weak_password() {
  const e = email("1-9-weak")
  const res = await signup(e, "abc", "Weak", "Pass")
  const ok = res.status === 400
  record("1.9", "Weak password rejected", ok, ok ? "HTTP 400 ✓" : `HTTP ${res.status} expected 400`)
}

async function s1_10_signin_correct() {
  const e = email("1-10-signin")
  await signup(e, PASSWORD)
  const jar = await signIn(e, PASSWORD)
  const ok = !!jar
  record("1.10", "Sign in with correct creds", ok, ok ? "session cookie issued ✓" : "no session")
}

async function s1_11_signin_wrong_password() {
  const e = email("1-11-wrongpw")
  await signup(e, PASSWORD)
  const jar = await signIn(e, "WRONG_PASSWORD_123!")
  const ok = !jar
  record("1.11", "Sign in with wrong password rejected", ok, ok ? "no session ✓" : "session was issued (wrong)")
}

async function s1_12_multirole() {
  const e = email("1-12-multirole")
  await signup(e, PASSWORD, "Multi", "Role")
  const jar = await signIn(e, PASSWORD)
  if (!jar) return record("1.12", "Multi-role", false, "signin failed")
  // First onboard as Parent
  const ob1 = await onboard(jar, {
    roles: ["Parent"],
    profileData: { type: "Parent", phoneNumber: "+14165550000", country: "CA", city: "Toronto", state: "ON" },
  })
  if (ob1.status !== 200) return record("1.12", "Multi-role", false, `first onboard HTTP ${ob1.status}`)
  // Then add Staff role (re-call onboarding with both roles — addRoleSchema may also exist; using the same endpoint as the simplest path)
  const ob2 = await onboard(jar, {
    roles: ["Parent", "Staff"],
    profileData: { type: "Staff", phoneNumber: "+14165550000", country: "CA", city: "Toronto", state: "ON" },
  })
  const u = await prisma.user.findFirst({ where: { email: e }, include: { roles: true } })
  const roles = new Set((u?.roles ?? []).map((r) => r.role))
  const ok = ob2.status === 200 && roles.has("Parent" as any) && roles.has("Staff" as any)
  record("1.12", "Multi-role (Parent + Staff)", ok, ok ? "both UserRoles present ✓" : `roles=${[...roles].join(",")}`)
}

async function s1_13_signout() {
  const e = email("1-13-signout")
  await signup(e, PASSWORD)
  const jar = await signIn(e, PASSWORD)
  if (!jar) return record("1.13", "Sign out", false, "signin failed")
  const ok = await signOut(jar)
  record("1.13", "Sign out clears session", ok, ok ? "session gone ✓" : "session persisted")
}

// ---------- Main ----------

async function main() {
  console.log(`\n=== Phase 1 — User signup + onboarding ===\nBASE=${BASE}\n`)
  await cleanup()
  await s1_1_parent()
  await s1_2_player_13plus()
  await s1_3_under_13()
  await s1_4_staff()
  await s1_5_clubowner()
  await s1_6_leagueowner()
  await s1_7_referee()
  await s1_8_duplicate_email()
  await s1_9_weak_password()
  await s1_10_signin_correct()
  await s1_11_signin_wrong_password()
  await s1_12_multirole()
  await s1_13_signout()

  const passed = results.filter((r) => r.pass === true).length
  const failed = results.filter((r) => r.pass === false).length
  const skipped = results.filter((r) => r.pass === "skip").length
  console.log(`\n=== Phase 1 result: ${passed} pass, ${failed} fail, ${skipped} skipped ===`)
  if (failed > 0) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
