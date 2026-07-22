// Runtime verification for the Trainer role (batch-backlog §5).
// API-level end-to-end against local dev: fresh user → Trainer onboarding →
// tenant → 1-on-1 setup → slots → program publish → parent registers + books.
// Pollutes the local demo DB — reseed with `cd packages/db && npm run db:seed`.
import { chromium } from "playwright"

const BASE = process.env.BASE || "http://localhost:3000"
const results = []
const ok = (label, pass, detail = "") => {
  results.push(`${pass ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`)
  console.log(results[results.length - 1])
}

async function login(browser, email, password = "TestPass123!") {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  await p.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
  await p.waitForTimeout(700)
  await p.locator('input[type="email"], input[name="email"]').first().fill(email)
  await p.locator('input[type="password"], input[name="password"]').first().fill(password)
  await p.locator('button[type="submit"]').first().click()
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(500)
    const session = await (await p.request.get(`${BASE}/api/auth/session`)).json().catch(() => null)
    if (session?.user) break
    if (i === 29) throw new Error(`login never became live for ${email}`)
  }
  await p.close()
  return ctx
}

const api = (ctx, path, opts = {}) =>
  ctx.request.fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  })

const browser = await chromium.launch()
const stamp = Date.now()
const trainerEmail = `trainer-verify-${stamp}@sportshub.demo`

// ── Trainer side ──────────────────────────────────────────────────────────
let res = await fetch(`${BASE}/api/auth/signup`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: trainerEmail,
    password: "TestPass123!",
    firstName: "Verify",
    lastName: "Trainer",
  }),
})
ok("signup fresh trainer user", res.status === 200 || res.status === 201, `status ${res.status}`)

const tctx = await login(browser, trainerEmail)

res = await api(tctx, "/api/onboarding", {
  method: "POST",
  data: { roles: ["Trainer"] },
})
const onboard = await res.json().catch(() => ({}))
ok(
  "onboarding grants Trainer + nextStep /trainers/create",
  res.ok() && onboard.nextStep === "/trainers/create",
  `status ${res.status()} nextStep ${onboard.nextStep}`
)

res = await api(tctx, "/api/trainers", {
  method: "POST",
  data: {
    name: "Verify Trainer Basketball",
    slug: `verify-trainer-${stamp}`,
    bio: "Runtime verification trainer",
    contactEmail: trainerEmail,
    city: "Toronto",
    state: "ON",
  },
})
const tenant = await res.json().catch(() => ({}))
ok("create trainer tenant", res.status() === 201 && !!tenant.id, `status ${res.status()}`)
const tenantId = tenant.id

res = await api(tctx, `/api/trainers/${tenantId}/profile`, {
  method: "PUT",
  data: { oneOnOneFee: 80, slotMinutes: 60, oneOnOneEnabled: true },
})
ok("enable 1-on-1 (fee 80, 60 min)", res.ok(), `status ${res.status()}`)

const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
res = await api(tctx, `/api/trainers/${tenantId}/availability`, {
  method: "POST",
  data: { date: tomorrow, startTime: "09:00", endTime: "12:00" },
})
ok("add availability 09:00-12:00 tomorrow", res.status() === 201, `status ${res.status()}`)

res = await api(tctx, `/api/trainers/${tenantId}/slots`)
let slots = (await res.json()).slots ?? []
ok("slot grid generates 3 slots", slots.length === 3, `got ${slots.length}`)

res = await api(tctx, "/api/training-sessions", {
  method: "POST",
  data: {
    tenantId,
    title: "Verify Small Group Shooting",
    sessionType: "GROUP_TRAINING",
    scheduleType: "ONE_TIME",
    startAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    durationMinutes: 60,
    capacity: 4,
    fee: 40,
  },
})
const created = await res.json().catch(() => ({}))
ok("create training program", res.status() === 201 && !!created.id, `status ${res.status()}`)
const sessionId = created.id

res = await api(tctx, `/api/training-sessions/${sessionId}`, {
  method: "PATCH",
  data: { isPublished: true },
})
ok("publish program", res.ok(), `status ${res.status()}`)

// Public page reachable signed-out
res = await fetch(`${BASE}/training/${sessionId}`)
ok("public /training/[id] renders", res.status === 200, `status ${res.status}`)

// ── Parent side ───────────────────────────────────────────────────────────
const pctx = await login(browser, "parent@sportshub.demo")

res = await api(pctx, "/api/players")
const players = (await res.json()).players ?? []
ok("parent has players", players.length > 0, `got ${players.length}`)
const playerId = players[0]?.id

res = await api(pctx, `/api/training-sessions/${sessionId}/signup`, {
  method: "POST",
  data: { playerId },
})
const signup = await res.json().catch(() => ({}))
ok(
  "parent registers for program (fee 40 → obligation)",
  res.status() === 201 && signup.totalFee === 40,
  `status ${res.status()} fee ${signup.totalFee}`
)

const slotToBook = slots[0]
res = await api(pctx, `/api/trainers/${tenantId}/book`, {
  method: "POST",
  data: { playerId, startAt: slotToBook },
})
const booking = await res.json().catch(() => ({}))
ok("parent books 1-on-1 slot", res.status() === 201 && booking.fee === 80, `status ${res.status()}`)

// Double-book the same slot (second player) must 409
const player2 = players[1]?.id
if (player2) {
  res = await api(pctx, `/api/trainers/${tenantId}/book`, {
    method: "POST",
    data: { playerId: player2, startAt: slotToBook },
  })
  ok("same slot again → 409 taken", res.status() === 409, `status ${res.status()}`)
}

// Slot no longer offered
res = await api(pctx, `/api/trainers/${tenantId}/slots`)
slots = (await res.json()).slots ?? []
ok("booked slot removed from grid", !slots.includes(slotToBook), `${slots.length} left`)

// Off-grid time rejected
res = await api(pctx, `/api/trainers/${tenantId}/book`, {
  method: "POST",
  data: { playerId, startAt: new Date(Date.now() + 5 * 86_400_000).toISOString() },
})
ok("off-grid time rejected", res.status() === 400, `status ${res.status()}`)

await browser.close()
const fails = results.filter((r) => r.startsWith("FAIL"))
console.log(`\n${results.length - fails.length}/${results.length} passed`)
process.exit(fails.length ? 1 : 0)
