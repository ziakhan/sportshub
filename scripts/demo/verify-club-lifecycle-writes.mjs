/**
 * Exercise the club review console's WRITE paths against the running app.
 *
 *   node scripts/demo/verify-club-lifecycle-writes.mjs
 *
 * Creates two throwaway clubs, then drives edit / publish / unpublish / merge
 * through the real HTTP API as a signed-in PlatformAdmin, asserting the
 * database afterwards. Cleans up after itself.
 */
import { chromium } from "playwright"
import { PrismaClient } from "@prisma/client"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@sportshub.demo"
const PASS = process.env.ADMIN_PASS ?? "TestPass123!"

const prisma = new PrismaClient()
const RUN = `vfy${Date.now().toString(36)}`
const made = []
let failed = false
const check = (ok, msg) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`)
  if (!ok) failed = true
}

async function mk(suffix, extra = {}) {
  const t = await prisma.tenant.create({
    data: {
      name: `Verify ${suffix} ${RUN}`,
      slug: `verify-${suffix}-${RUN}`,
      status: "UNCLAIMED",
      city: "Testville",
      ...extra,
    },
  })
  made.push(t.id)
  return t
}

const browser = await chromium.launch()
const page = await browser.newContext().then((c) => c.newPage())
await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle", timeout: 90000 })
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASS)
await page.click('button[type="submit"]')
// The post-login redirect tears down the execution context, so let the
// navigation settle before evaluating anything in the page.
await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 60000 })
await page.waitForLoadState("networkidle")
for (let i = 0; i < 40; i++) {
  const s = await page
    .evaluate(() => fetch("/api/auth/session").then((r) => r.json()).catch(() => null))
    .catch(() => null)
  if (s?.user?.id) break
  await page.waitForTimeout(1000)
}

const call = (body) =>
  page.evaluate(
    (b) =>
      fetch("/api/admin/clubs/lifecycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
      }).then(async (r) => ({ status: r.status, json: await r.json() })),
    body
  )

try {
  const target = await mk("target", { publishedAt: null })
  const source = await mk("source", { publishedAt: new Date(), contactEmail: "src@example.com" })
  await prisma.team.create({
    data: { tenantId: source.id, name: "U15 Boys", ageGroup: "U15", season: "2026" },
  })

  console.log("\nEDIT")
  const edited = await call({
    action: "edit",
    id: target.id,
    fields: { city: "Hamilton", contactEmail: "edited@example.com" },
  })
  check(edited.status === 200, `HTTP ${edited.status}`)
  const afterEdit = await prisma.tenant.findUnique({ where: { id: target.id } })
  check(afterEdit.city === "Hamilton", `city -> ${afterEdit.city}`)
  check(afterEdit.contactEmail === "edited@example.com", `email -> ${afterEdit.contactEmail}`)
  check(!!afterEdit.reviewedAt, "reviewedAt stamped")
  const auditRow = await prisma.auditLog.findFirst({
    where: { resourceId: target.id, action: "CLUB_EDIT" },
  })
  check(!!auditRow, "CLUB_EDIT audit row written")

  console.log("\nPUBLISH")
  const pub = await call({ action: "publish", ids: [target.id] })
  check(pub.status === 200 && pub.json.count === 1, `published ${pub.json?.count}`)
  check(!!(await prisma.tenant.findUnique({ where: { id: target.id } })).publishedAt, "publishedAt set")

  console.log("\nUNPUBLISH")
  await call({ action: "unpublish", ids: [target.id] })
  check(
    (await prisma.tenant.findUnique({ where: { id: target.id } })).publishedAt === null,
    "publishedAt cleared"
  )
  await call({ action: "publish", ids: [target.id] })

  console.log("\nMERGE")
  const merged = await call({ action: "merge", sourceId: source.id, targetId: target.id })
  check(merged.status === 200, `HTTP ${merged.status} ${merged.json?.error ?? ""}`)
  check(merged.json?.moved?.team === 1, `team moved: ${merged.json?.moved?.team}`)
  const src = await prisma.tenant.findUnique({ where: { id: source.id } })
  const tgt = await prisma.tenant.findUnique({ where: { id: target.id } })
  check(src.mergedIntoId === target.id, "source points at survivor")
  check(src.publishedAt === null, "source pulled from public surfaces")
  check((await prisma.team.count({ where: { tenantId: target.id } })) === 1, "team on survivor")
  check(tgt.contactEmail === "edited@example.com", "survivor kept its own email (not overwritten)")
  check(
    !!(await prisma.auditLog.findFirst({ where: { resourceId: target.id, action: "CLUB_MERGE" } })),
    "CLUB_MERGE audit row written"
  )

  console.log("\nGUARDS")
  const self = await call({ action: "merge", sourceId: target.id, targetId: target.id })
  check(self.status === 400, `self-merge rejected (${self.status})`)
  const badField = await call({ action: "edit", id: target.id, fields: { contactEmail: "nope" } })
  check(badField.status === 400, `invalid email rejected (${badField.status})`)
} finally {
  await prisma.team.deleteMany({ where: { tenantId: { in: made } } })
  await prisma.auditLog.deleteMany({ where: { resourceId: { in: made } } })
  await prisma.tenant.deleteMany({ where: { id: { in: made } } })
  await browser.close()
  await prisma.$disconnect()
  console.log(failed ? "\nVERIFY FAILED" : "\nVERIFY OK")
  process.exitCode = failed ? 1 : 0
}
