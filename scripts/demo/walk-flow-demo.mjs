/**
 * Walks a flow-demo page scene by scene, screenshotting every step.
 *   node scripts/demo/walk-flow-demo.mjs <path> <outDir> [--mobile] [--max N]
 * e.g. node scripts/demo/walk-flow-demo.mjs /how-it-works /tmp/shots
 */
import { chromium } from "playwright"
import fs from "node:fs"

const [, , route = "/how-it-works", out = "/tmp/demo-shots", ...rest] = process.argv
const mobile = rest.includes("--mobile")
const maxIdx = rest.indexOf("--max")
const max = maxIdx >= 0 ? Number(rest[maxIdx + 1]) : 200
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 },
  deviceScaleFactor: 1,
})
const errors = []
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message))
page.on("console", (m) => m.type() === "error" && errors.push("CONSOLE " + m.text()))

await page.goto("http://localhost:3000" + route, { waitUntil: "networkidle", timeout: 90000 })
const player = page.locator("[data-demo-player]")
await player.waitFor({ timeout: 30000 })

let step = 0
for (;;) {
  step++
  await page.waitForTimeout(450)
  const sceneId = await player.getAttribute("data-demo-scene").catch(() => null)
  if (!sceneId) break
  const counter = await page.textContent("[data-demo-player]").then((t) => (t.match(/Step (\d+) of (\d+)/) || [])[0])
  await player.scrollIntoViewIfNeeded()
  await player.screenshot({
    path: `${out}/${String(step).padStart(2, "0")}-${sceneId}.jpg`,
    type: "jpeg",
    quality: 55,
  })
  console.log(`${String(step).padStart(2, "0")} ${sceneId} (${counter})`)
  if (step >= max) break
  const adv = page.locator("[data-demo-advance]").first()
  if ((await adv.count()) === 0) break
  await adv.click({ timeout: 5000, force: true })
  // wait for either the next scene id or the end screen
  const before = sceneId
  const changed = await page
    .waitForFunction(
      (prev) => {
        const el = document.querySelector("[data-demo-player]")
        if (!el) return true // end screen replaced the player
        return el.getAttribute("data-demo-scene") !== prev
      },
      before,
      { timeout: 8000 }
    )
    .then(() => true)
    .catch(() => false)
  if (!changed) {
    console.log("STUCK on", before)
    break
  }
  const stillThere = await player.count()
  if (!stillThere) break
}

// End screen, if reached
const done = page.getByText("That is the whole season")
if (await done.count()) {
  await page.screenshot({ path: `${out}/99-done.jpg`, type: "jpeg", quality: 55 })
  console.log("99 done-screen")
}

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors")
await browser.close()
