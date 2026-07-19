import { chromium } from "playwright"
import path from "node:path"
import { fileURLToPath } from "node:url"
const BASE = "https://sportshubone.com"
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../apps/web/public/shots")
async function mintCookies(email) {
  const jarRes = await fetch(`${BASE}/api/auth/csrf`)
  const setCookies = jarRes.headers.getSetCookie ? jarRes.headers.getSetCookie() : [jarRes.headers.get("set-cookie")].filter(Boolean)
  const { csrfToken } = await jarRes.json()
  const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ")
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookieHeader },
    body: new URLSearchParams({ csrfToken, email, password: "TestPass123!", json: "true" }),
    redirect: "manual",
  })
  const got = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean)
  return [...setCookies, ...got].map((c) => c.split(";")[0]).filter(Boolean).map((kv) => {
    const i = kv.indexOf("=")
    return { name: kv.slice(0, i), value: kv.slice(i + 1), domain: "sportshubone.com", path: "/", secure: true }
  })
}
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" })
await ctx.addCookies(await mintCookies("owner-force@sportshub.demo"))
const page = await ctx.newPage()
await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" })
await page.waitForTimeout(1200)
const links = await page.$$eval('a[href^="/clubs/"]', (as) => as.map((a) => a.getAttribute("href")))
const pay = links.find((l) => /\/clubs\/[^/]+\/payments/.test(l || ""))
console.log("club payments url:", pay)
if (pay) {
  await page.goto(BASE + pay, { waitUntil: "networkidle", timeout: 35000 }).catch(() => {})
  await page.waitForTimeout(1800)
  const txt = await page.content()
  if (/404|could not be found/i.test(txt)) { console.log("PAGE LOOKS 404 — not saving"); }
  else { await page.screenshot({ path: path.join(OUT, "club-payments.png") }); console.log("saved club-payments.png") }
} else console.log("no club payments link found — leaving existing shot")
await browser.close()
