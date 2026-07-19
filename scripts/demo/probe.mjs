import { chromium } from "playwright"
const BASE = "https://sportshubone.com"
async function mint(email) {
  const j = await fetch(`${BASE}/api/auth/csrf`)
  const sc = j.headers.getSetCookie ? j.headers.getSetCookie() : [j.headers.get("set-cookie")].filter(Boolean)
  const { csrfToken } = await j.json()
  const r = await fetch(`${BASE}/api/auth/callback/credentials`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: sc.map((c) => c.split(";")[0]).join("; ") }, body: new URLSearchParams({ csrfToken, email, password: "TestPass123!", json: "true" }), redirect: "manual" })
  const got = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get("set-cookie")].filter(Boolean)
  return [...sc, ...got].map((c) => c.split(";")[0]).map((kv) => { const i = kv.indexOf("="); return { name: kv.slice(0, i), value: kv.slice(i + 1), domain: "sportshubone.com", path: "/", secure: true } })
}
const b = await chromium.launch()
const ctx = await b.newContext()
await ctx.addCookies(await mint(process.argv[2] || "owner-nph@sportshub.demo"))
const p = await ctx.newPage()
for (const u of process.argv.slice(3)) {
  const r = await p.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => null)
  console.log(r ? r.status() : "ERR", u, "->", p.url().replace(BASE, ""))
}
await b.close()
