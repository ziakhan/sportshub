// Wave-2 sweep smoke: load swept surfaces per persona, fail on pageerror/500.
import { chromium } from "playwright"
import { ensureSession, BASE } from "./lib.mjs"
import fs from "node:fs"

const HUSKIES = "1995bfdf-5750-470c-abd0-251f9c04aa8b"
const SHOTS = "/private/tmp/claude-501/-Users-ziakhan-zia-personal-sportshub/0a8da43e-7c37-4c7f-8869-e1732dfd5e4a/scratchpad/wave2-shots"
fs.mkdirSync(SHOTS, { recursive: true })

const PLANS = [
  {
    email: "owner-huskies@sportshub.demo",
    pages: [
      `/clubs/${HUSKIES}/staff`,
      `/clubs/${HUSKIES}/settings`,
      `/clubs/${HUSKIES}/payments`,
      `/clubs/${HUSKIES}/offer-templates`,
      `/clubs/${HUSKIES}/tryouts/create`,
    ],
    followTeam: true,
  },
  {
    email: "parent@sportshub.demo",
    pages: ["/players", "/payments", "/offers", "/settings/profile"],
  },
  {
    email: "admin@sportshub.demo",
    pages: ["/dashboard/admin/users", "/dashboard/admin/claims", "/dashboard/admin/payments"],
  },
]

const failures = []
const browser = await chromium.launch()
for (const plan of PLANS) {
  const state = await ensureSession(plan.email)
  const ctx = await browser.newContext({ storageState: state, viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(String(e)))

  const targets = [...plan.pages]
  if (plan.followTeam) {
    await page.goto(`${BASE}/clubs/${HUSKIES}/teams`, { waitUntil: "networkidle" }).catch(() => {})
    const href = await page
      .$$eval("a[href*='/teams/']", (as) => as.map((a) => a.getAttribute("href")).find((h) => /\/teams\/[0-9a-f-]{36}/.test(h || "")))
      .catch(() => null)
    if (href) {
      const base = href.replace(/\/(dashboard|roster|edit).*$/, "")
      targets.push(`${base}/dashboard`, `${base}/roster`, `${base}/edit`)
    }
  }

  for (const path of targets) {
    errs.length = 0
    const res = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 }).catch(() => null)
    await page.waitForTimeout(600)
    const status = res ? res.status() : 0
    const name = path.replace(/[^a-z0-9]/gi, "_").slice(0, 80)
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }).catch(() => {})
    const bad = status >= 500 || status === 0 || errs.length > 0
    console.log(`${bad ? "FAIL" : " ok "} ${status} ${path}${errs.length ? " pageerror: " + errs[0].slice(0, 120) : ""}`)
    if (bad) failures.push({ path, status, errs: [...errs] })
  }
  await ctx.close()
}
await browser.close()
console.log(failures.length ? `\n${failures.length} FAILURES` : "\nALL PAGES CLEAN")
process.exit(failures.length ? 1 : 0)
