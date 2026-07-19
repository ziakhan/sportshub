import { chromium } from "playwright"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { BASE, ensureSession } from "./lib.mjs"
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../apps/web/public/shots")
const url = "/live/025aab29-28c3-439d-ad4e-fbb15866dc7e"
const browser = await chromium.launch()
for (const [name, vp, who] of [
  ["game-page", { width: 1440, height: 900 }, null],
  ["phone-game", { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }, "parent@sportshub.demo"],
]) {
  const opts = { viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor ?? 1, isMobile: !!vp.isMobile, colorScheme: "light" }
  if (who) opts.storageState = await ensureSession(who)
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1800)
  await page.screenshot({ path: path.join(OUT, name + ".png") })
  console.log("done", name)
  await ctx.close()
}
await browser.close()
