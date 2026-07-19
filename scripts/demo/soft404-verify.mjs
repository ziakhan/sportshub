import { chromium } from "playwright"
const BASE = "https://sportshubone.com"
const urls = process.argv.slice(2)
const b = await chromium.launch()
const p = await (await b.newContext()).newPage()
for (const u of urls) {
  const r = await p.goto(BASE + u, { waitUntil: "networkidle", timeout: 30000 }).catch(() => null)
  await p.waitForTimeout(800)
  const visible = await p.evaluate(() => {
    const el = [...document.querySelectorAll("h1,h2,main *")].find((e) => /page not found/i.test(e.textContent || "") && e.checkVisibility && e.checkVisibility())
    return { title: document.title, h1: document.querySelector("h1")?.textContent?.slice(0, 60) ?? null, notFoundVisible: !!el }
  })
  console.log(r ? r.status() : "ERR", u.slice(0, 60), JSON.stringify(visible))
}
await b.close()
