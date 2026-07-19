// Authenticated prod audit v2: mint sessions via the auth API (the sign-in
// page UI defeated the form-fill approach), inject cookies into Playwright,
// crawl the workspace 2 levels deep per persona, report every 404/error.
import { chromium } from "playwright"
const BASE = "https://sportshubone.com"
const HOST = "sportshubone.com"

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
  const all = [...setCookies, ...got]
  const cookies = all
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .map((kv) => {
      const i = kv.indexOf("=")
      return { name: kv.slice(0, i), value: kv.slice(i + 1), domain: HOST, path: "/", secure: true }
    })
  return cookies
}

const PERSONAS = [
  ["parent@sportshub.demo", ["/", "/calendar", "/messages", "/players", "/offers", "/payments", "/account", "/notifications"]],
  ["owner-force@sportshub.demo", ["/dashboard", "/tryouts", "/payments", "/messages", "/teams", "/manage", "/calendar"]],
  ["admin@sportshub.demo", ["/dashboard"]],
]
const browser = await chromium.launch()
let anyBad = false
for (const [email, urls] of PERSONAS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await ctx.addCookies(await mintCookies(email))
  const page = await ctx.newPage()
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
  const sessionOk = await page.evaluate(() => fetch("/api/auth/session").then((r) => r.json()).then((s) => !!s?.user))
  console.log(`\n=== ${email} session:${sessionOk ? "OK" : "MISSING"} ===`)
  if (!sessionOk) { anyBad = true; await ctx.close(); continue }
  const seen = new Set()
  const queue = urls.map((u) => ({ u, d: 0 }))
  const bad = []
  while (queue.length) {
    const { u, d } = queue.shift()
    if (seen.has(u) || seen.size > 120) continue
    seen.add(u)
    const res = await page.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => null)
    const status = res ? res.status() : "ERR"
    let soft = false
    if (status === 200) {
      const txt = await page.content()
      soft = /This page could not be found|Application error|Something went wrong/.test(txt)
    }
    if (status !== 200 || soft) { bad.push(`${soft ? "SOFT-ERR" : status}  ${u}`); }
    if (status === 200 && !soft && d < 2) {
      const links = await page.$$eval('a[href^="/"]', (as) => as.map((a) => a.getAttribute("href")))
      for (let l of new Set(links)) {
        if (!l) continue
        l = l.split("?")[0].split("#")[0]
        if (l.match(/\.(png|jpg|svg|ico)$/) || l.startsWith("/api") || l.startsWith("/_next") || l.startsWith("/sign-")) continue
        if (!seen.has(l)) queue.push({ u: l, d: d + 1 })
      }
    }
  }
  console.log(`checked ${seen.size} pages · broken: ${bad.length}`)
  for (const b of bad) { console.log("   " + b); anyBad = true }
  await ctx.close()
}
await browser.close()
console.log(anyBad ? "\nBROKEN PAGES FOUND" : "\nall clean")
