/** Verify 2026-07-31 owner feedback round: org→league nav, settings grouping, structured questions. */
import { chromium } from "playwright"
const B = "http://localhost:3000"
const ORG = "fc28bbe4-8958-4226-8b97-0f8a19a3584c"
const LG = "6bd116aa-3642-455d-9095-3d43815a07fe"
const SN = "6f2a3ada-4c36-4765-bd1e-eb9da6026e91"
const results = []
const check = (l, ok, x = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${l}${x ? " — " + x : ""}`) }
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
const { mkdirSync } = await import("fs")
mkdirSync("/tmp/feedback3-verify", { recursive: true })
await p.goto(B + "/sign-in", { waitUntil: "domcontentloaded" })
await p.waitForTimeout(2500)
await p.locator('input[type="email"]').first().fill("owner-nph@sportshub.demo")
await p.locator('input[type="password"]').first().fill("TestPass123!")
await p.locator('button[type="submit"]').first().click()
for (let i = 0; i < 40; i++) { await p.waitForTimeout(500); const s = await (await p.request.get(B + "/api/auth/session")).json().catch(() => null); if (s?.user) break }

// 1. Org page → league links go to the real league hub
await p.goto(`${B}/manage/org/${ORG}`)
await p.waitForSelector("text=Season defaults", { timeout: 60000 })
await p.waitForTimeout(1500)
check("org league rows link to league hub", (await p.locator(`a[href='/manage/leagues/${LG}']`).count()) >= 1)
check("question builder in org editor", (await p.locator("text=+ Add question").count()) >= 1)
const singleQ = await p.locator("input[value*='How many seasons']").count()
check("structured question round-trips in org editor", singleQ >= 1)
await p.screenshot({ path: "/tmp/feedback3-verify/1-org.png", fullPage: true })

// 2. Settings grouping: rulebook sections first, season-specific below
await p.goto(`${B}/manage/leagues/${LG}/seasons/${SN}/manage?tab=settings`)
await p.waitForSelector("section#rules", { timeout: 60000 })
await p.waitForTimeout(2000)
check("rulebook group header on top", (await p.locator("text=rulebook — inherited").count()) >= 1)
check("'This season only' divider present", (await p.locator("text=This season only").count()) >= 1)
const order = await p.evaluate(() => Array.from(document.querySelectorAll("section[id]")).map((s) => s.id))
check("org sections before season sections", JSON.stringify(order) === JSON.stringify(["registration","game-format","rules","basics","divisions"]), order.join(","))
await p.screenshot({ path: "/tmp/feedback3-verify/2-settings-grouped.png", fullPage: true })

// 3. Entry form renders the single-choice question as radios
const edge = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await edge.goto(B + "/sign-in", { waitUntil: "domcontentloaded" })
await edge.waitForTimeout(2500)
await edge.locator('input[type="email"]').first().fill("owner-edge@sportshub.demo")
await edge.locator('input[type="password"]').first().fill("TestPass123!")
await edge.locator('button[type="submit"]').first().click()
for (let i = 0; i < 40; i++) { await edge.waitForTimeout(500); const s = await (await edge.request.get(B + "/api/auth/session")).json().catch(() => null); if (s?.user) break }
await edge.goto(`${B}/seasons/${SN}/enter`)
await edge.waitForTimeout(4000)
check("entry form shows radio options", (await edge.locator("input[type=radio]").count()) >= 3)
check("paragraph questions still render", (await edge.locator("textarea").count()) >= 2)
await edge.screenshot({ path: "/tmp/feedback3-verify/3-entry-form.png", fullPage: true })

await b.close()
const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
