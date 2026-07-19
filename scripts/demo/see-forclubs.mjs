import { chromium } from "playwright"
const browser = await chromium.launch()
for (const [label, vp] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.deviceScaleFactor ?? 1, isMobile: !!vp.isMobile })
  const page = await ctx.newPage()
  const failed = []
  page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(0, 140)}`) })
  await page.goto("https://sportshubone.com/for-clubs", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {})
  await page.evaluate(async () => { window.scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 2500)); window.scrollTo(0, 0) })
  await page.waitForTimeout(2500)
  const imgs = await page.$$eval("img", (els) => els.map((i) => ({ src: (i.currentSrc || i.src).slice(0, 140), ok: i.complete && i.naturalWidth > 0 })))
  console.log(`\n=== ${label}: ${imgs.length} imgs, broken: ${imgs.filter((i) => !i.ok).length} ===`)
  for (const i of imgs.filter((i) => !i.ok)) console.log("BROKEN:", i.src)
  for (const f of failed) console.log("HTTP-FAIL:", f)
  await page.screenshot({ path: `/tmp/forclubs-${label}.png`, fullPage: true })
  await ctx.close()
}
await browser.close()
