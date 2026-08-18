// Beat-stepper verification drive for the demo directory (mock realism R1-R8).
// Steps a demo beat by beat via the player's Next button and screenshots every
// state, so a conversion is REVIEWED, not assumed: overflow under the tab bar,
// mis-anchored cursors and unfinished flows all show up as frames.
//
//   cd scripts/demo && ../../.tooling/node/bin/node drive-demo-beats.mjs <slug> [outDir]
//
// Requires the dev server on localhost:3004. Lives in scripts/demo on purpose:
// ESM resolves playwright relative to THIS file, not the cwd.
import { chromium } from "playwright"
import { mkdirSync } from "fs"

const slug = process.argv[2]
if (!slug) {
  console.error("usage: drive-demo-beats.mjs <slug> [outDir]")
  process.exit(1)
}
const OUT = process.argv[3] || `/tmp/demo-drive/${slug}`
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } })
await page.goto(`http://localhost:3004/demos/${slug}`, { waitUntil: "networkidle" })
await page.getByRole("button", { name: "Play the demo" }).click()
await page.waitForTimeout(900)
// Freeze the clock so Next is the only thing advancing beats.
await page.getByRole("button", { name: "Pause" }).click().catch(() => {})
await page.waitForTimeout(400)

for (let i = 1; i <= 80; i++) {
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/beat-${String(i).padStart(2, "0")}.png` })
  console.log(`beat ${i} captured`)
  const next = page.getByRole("button", { name: "Next", exact: true })
  if (!(await next.isVisible().catch(() => false)) || !(await next.isEnabled().catch(() => false))) {
    console.log(`story ends at beat ${i}`)
    break
  }
  await next.click()
}
await browser.close()
console.log(`frames in ${OUT}`)
