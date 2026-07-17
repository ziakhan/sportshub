// Complete UX audit harness (2026-07-18 overnight run): every daily-use
// web screen × persona at 390px, saving PNG + text outline for critique.
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3000"
const OUT = process.env.AUDIT_DIR || "/tmp/ux-audit"
fs.mkdirSync(OUT, { recursive: true })

const PERSONAS = {
  anon: null,
  parent: "parent@sportshub.demo",
  coach: "coach-force-gr10@sportshub.demo",
  clubowner: "owner-nph@sportshub.demo",
  referee: "ref-mike@sportshub.demo",
}

// discovered ids from the local demo world
const LORDS_TEAM = "30678448-33c0-483d-95dd-ecb6209058e7"
const FORCE_TEAM = "12faf7fd-0cc1-4103-9374-89c3b12c9bb3"
const GAME = "025aab29-28c3-439d-ad4e-fbb15866dc7e"

const SCREENS = {
  anon: [
    ["home", "/"],
    ["scores", "/scores"],
    ["game", `/live/${GAME}`],
    ["leagues", "/leagues"],
    ["news", "/news"],
    ["marketplace", "/marketplace"],
    ["events", "/events"],
  ],
  parent: [
    ["home", "/"],
    ["calendar", "/calendar"],
    ["kids", "/players"],
    ["offers", "/offers"],
    ["payments", "/payments"],
    ["messages", "/messages"],
    ["account", "/account"],
    ["notifications", "/notifications"],
    ["team-page", `/team/${LORDS_TEAM}`],
  ],
  coach: [
    ["home", "/"],
    ["calendar", "/calendar"],
    ["team-home", `/teams/${FORCE_TEAM}`],
    ["team-chat", `/teams/${FORCE_TEAM}/chat`],
    ["team-polls", `/teams/${FORCE_TEAM}/polls`],
    ["team-calendar", `/teams/${FORCE_TEAM}/calendar`],
    ["messages", "/messages"],
    ["account", "/account"],
  ],
  clubowner: [
    ["home", "/"],
    ["dashboard", "/dashboard"],
    ["messages", "/messages"],
    ["account", "/account"],
  ],
  referee: [
    ["home", "/"],
    ["requests", "/referee/requests"],
    ["calendar", "/calendar"],
    ["account", "/account"],
  ],
}

const browser = await chromium.launch()

async function login(email) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" })
  await p.waitForTimeout(800)
  await p.locator('input[type="email"]').first().fill(email)
  await p.locator('input[type="password"]').first().fill("TestPass123!")
  await Promise.all([
    p.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 20000 }).catch(() => {}),
    p.locator('button[type="submit"]').first().click(),
  ])
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(400)
    const s = await (await p.request.get(`${BASE}/api/auth/session`)).json().catch(() => null)
    if (s?.user) break
  }
  await p.close()
  return ctx
}

for (const [persona, email] of Object.entries(PERSONAS)) {
  const ctx = email
    ? await login(email)
    : await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  for (const [name, path] of SCREENS[persona]) {
    try {
      await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30000 })
      await p.waitForTimeout(1200)
      const overflow = await p.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
      await p.screenshot({ path: `${OUT}/${persona}--${name}.png`, fullPage: false })
      const txt = await p.locator("body").innerText()
      fs.writeFileSync(
        `${OUT}/${persona}--${name}.txt`,
        `URL: ${path}\nOVERFLOW-PX: ${overflow}\nFINAL-URL: ${p.url()}\n---\n${txt.slice(0, 6000)}`
      )
      console.log(`ok ${persona}--${name} (overflow ${overflow})`)
    } catch (e) {
      console.log(`FAIL ${persona}--${name}: ${String(e).slice(0, 120)}`)
    }
  }
  await ctx.close()
}
await browser.close()
console.log("AUDIT CAPTURE COMPLETE")
