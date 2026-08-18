/**
 * Drive the club merge the way an admin does: tick two rows, press Merge, pick
 * the survivor, confirm. Then assert the database agrees.
 *
 *   node scripts/demo/verify-merge-flow.mjs
 *
 * Uses throwaway clubs and cleans up after itself, so it can run against a
 * working database without touching real records.
 */
import { chromium } from "playwright"
import { PrismaClient } from "@prisma/client"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const prisma = new PrismaClient()
const RUN = `zzmerge${Date.now().toString(36)}`
const made = []
let failed = false
const check = (ok, msg) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`)
  if (!ok) failed = true
}

const browser = await chromium.launch()
const page = await browser.newContext({ viewport: { width: 1400, height: 1000 } }).then((c) =>
  c.newPage()
)

try {
  // The rich club, and a bare duplicate of it.
  const rich = await prisma.tenant.create({
    data: {
      name: `${RUN} Rich Club`,
      slug: `${RUN}-rich`,
      status: "UNCLAIMED",
      city: "Testville",
      contactEmail: "rich@example.com",
      publishedAt: new Date(),
    },
  })
  const bare = await prisma.tenant.create({
    data: { name: `${RUN} Bare Club`, slug: `${RUN}-bare`, status: "UNCLAIMED", city: "Testville" },
  })
  made.push(rich.id, bare.id)
  await prisma.team.create({
    data: { tenantId: rich.id, name: "U15 Boys", ageGroup: "U15", season: "2026" },
  })

  await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle", timeout: 120000 })
  await page.waitForTimeout(2500)
  await page.fill('input[type="email"]', "admin@sportshub.demo")
  await page.fill('input[type="password"]', "TestPass123!")
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 90000 })
  await page.goto(`${BASE}/dashboard/admin/clubs/lifecycle`, {
    waitUntil: "networkidle",
    timeout: 120000,
  })
  await page.waitForTimeout(5000)

  await page.locator('input[placeholder*="earch name"]').first().fill(RUN)
  await page.waitForTimeout(3000)

  const boxes = page.locator('tbody input[type="checkbox"]')
  check((await boxes.count()) === 2, `both throwaway clubs listed (${await boxes.count()})`)

  const merge = () => page.locator("main").getByRole("button", { name: /^Merge$/ }).first()
  await boxes.nth(0).check()
  await page.waitForTimeout(600)
  check(!(await merge().isEnabled()), "Merge stays disabled with one club ticked")

  await boxes.nth(1).check()
  await page.waitForTimeout(600)
  check(await merge().isEnabled(), "Merge enabled with two ticked")
  await merge().click()
  await page.waitForTimeout(1500)

  const dialog = page.locator('[role="dialog"]')
  const dialogMerge = dialog.getByRole("button", { name: /^Merge$/ })
  check(await dialogMerge.isDisabled(), "cannot confirm before choosing a survivor")

  // Choose the BARE club as survivor: the wrong way round, so the warning fires.
  const panes = dialog.locator("button[aria-pressed]")
  const bareIndex = (await panes.nth(0).innerText()).includes("Bare") ? 0 : 1
  await panes.nth(bareIndex).click()
  await page.waitForTimeout(2500)
  const warned = await dialog.innerText()
  check(warned.includes("wrong way round"), "backwards direction warned")
  check(await dialogMerge.isDisabled(), "blocked until the direction is acknowledged")

  // Switch to the correct direction: keep the rich club.
  await panes.nth(bareIndex === 0 ? 1 : 0).click()
  await page.waitForTimeout(2500)
  const ok = await dialog.innerText()
  check(!ok.includes("wrong way round"), "no warning on the sensible direction")
  check(await dialogMerge.isEnabled(), "confirm available")

  await dialogMerge.click()
  await page.waitForTimeout(4000)

  const [richAfter, bareAfter] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: rich.id } }),
    prisma.tenant.findUnique({ where: { id: bare.id } }),
  ])
  check(bareAfter.mergedIntoId === rich.id, "bare club points at the rich survivor")
  check(richAfter.mergedIntoId === null, "survivor stays live")
  check(
    (await prisma.team.count({ where: { tenantId: rich.id } })) === 1,
    "the team stayed with the survivor"
  )
  check(
    !!(await prisma.auditLog.findFirst({
      where: { resourceId: rich.id, action: "CLUB_MERGE" },
    })),
    "merge audited"
  )

  console.log("\nUNDO")
  // The retired club now lives on the "Merged away" tab.
  await page.getByRole("button", { name: /Merged away/i }).first().click()
  await page.waitForTimeout(2500)
  await page.locator('input[placeholder*="earch name"]').first().fill(`${RUN} Bare`)
  await page.waitForTimeout(3000)
  const undo = page.getByRole("button", { name: /Undo merge/i }).first()
  check((await undo.count()) === 1, "Undo merge offered on the retired club")
  await undo.click()
  await page.waitForTimeout(4000)

  const [richBack, bareBack] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: rich.id } }),
    prisma.tenant.findUnique({ where: { id: bare.id } }),
  ])
  check(bareBack.mergedIntoId === null, "retired club is live again")
  check(bareBack.slug === `${RUN}-bare`, `original slug restored (${bareBack.slug})`)
  check(bareBack.status === "UNCLAIMED", `status restored (${bareBack.status})`)
  check(
    (await prisma.team.count({ where: { tenantId: rich.id } })) === 1,
    "the survivor's own team stayed put"
  )
  check(
    !!(await prisma.auditLog.findFirst({
      where: { resourceId: rich.id, action: "CLUB_MERGE_UNDO" },
    })),
    "undo audited"
  )
} finally {
  await prisma.team.deleteMany({ where: { tenantId: { in: made } } })
  await prisma.auditLog.deleteMany({ where: { resourceId: { in: made } } })
  await prisma.tenant.deleteMany({ where: { id: { in: made } } })
  await browser.close()
  await prisma.$disconnect()
  console.log(failed ? "\nVERIFY FAILED" : "\nVERIFY OK")
  process.exitCode = failed ? 1 : 0
}
