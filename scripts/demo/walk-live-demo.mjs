/**
 * Walks the animated live demo (/demo): waits for each scene's animations to
 * reach a hold point, screenshots it, presses the glowing control, repeats.
 * Also captures an early-state shot when each new scene starts.
 *   node scripts/demo/walk-live-demo.mjs <outDir> [--mobile]
 */
import { chromium } from "playwright"
import fs from "node:fs"

const [, , out = "/tmp/live-shots", ...rest] = process.argv
const mobile = rest.includes("--mobile")
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 },
  deviceScaleFactor: 1,
})
const errors = []
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message))
page.on("console", (m) => m.type() === "error" && errors.push("CONSOLE " + m.text()))

await page.goto("http://localhost:3000/demo", { waitUntil: "networkidle", timeout: 90000 })
const player = page.locator("[data-demo-player]")
await player.waitFor({ timeout: 30000 })

let shot = 0
let lastScene = ""
let holdsInScene = 0
const t0 = Date.now()

while (Date.now() - t0 < 8 * 60_000) {
  const scene = await player.getAttribute("data-live-scene").catch(() => null)
  if (!scene) break
  if (scene === "done") {
    await player.screenshot({ path: `${out}/${String(++shot).padStart(2, "0")}-done.jpg`, type: "jpeg", quality: 55 })
    console.log("done-screen")
    break
  }
  if (scene !== lastScene) {
    lastScene = scene
    holdsInScene = 0
    await page.waitForTimeout(1400)
    await player.scrollIntoViewIfNeeded()
    await player.screenshot({
      path: `${out}/${String(++shot).padStart(2, "0")}-${scene}-a-start.jpg`,
      type: "jpeg",
      quality: 55,
    })
  }
  // Wait for a hold (ready) or a scene change
  const outcome = await page
    .waitForFunction(
      (prev) => {
        const el = document.querySelector("[data-demo-player]")
        if (!el) return "gone"
        const s = el.getAttribute("data-live-scene")
        if (s !== prev) return "scene"
        if (el.hasAttribute("data-live-ready")) return "ready"
        return false
      },
      lastScene,
      { timeout: 120000, polling: 200 }
    )
    .then((h) => h.jsonValue())
    .catch(() => "timeout")
  if (outcome === "timeout") {
    console.log("TIMEOUT waiting in scene", lastScene)
    break
  }
  if (outcome === "gone") break
  if (outcome === "scene") continue
  // ready: screenshot the held state, then press the glowing control
  holdsInScene++
  await page.waitForTimeout(350)
  await player.scrollIntoViewIfNeeded()
  await player.screenshot({
    path: `${out}/${String(++shot).padStart(2, "0")}-${lastScene}-hold${holdsInScene}.jpg`,
    type: "jpeg",
    quality: 55,
  })
  console.log(`${lastScene} hold ${holdsInScene}`)
  const glow = page.locator(".live-hold-glow").first()
  if ((await glow.count()) === 0) {
    console.log("NO GLOW at hold in", lastScene)
    break
  }
  await glow.click({ force: true, timeout: 5000 })
  // wait for ready to clear so we don't double-press the same hold
  await page
    .waitForFunction(() => !document.querySelector("[data-demo-player]")?.hasAttribute("data-live-ready"), null, {
      timeout: 15000,
      polling: 100,
    })
    .catch(() => {})
}

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors")
await browser.close()
