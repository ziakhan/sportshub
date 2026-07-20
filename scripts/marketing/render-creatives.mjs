/**
 * Renders the ad creatives in creatives/ to finished assets:
 *   s*.html -> PNG (1080x1080 square + 1080x1920 story)
 *   v*.html -> MP4 (square + story, 24fps H.264) + GIF (square, 540px 12fps)
 * Animated files expose window.__seek(ms) + window.__duration; frames are
 * captured deterministically and assembled with ffmpeg.
 *
 *   node scripts/marketing/render-creatives.mjs <outDir> [--only v3,s1]
 */
import { chromium } from "playwright"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(here, "creatives")
const [, , outDir = "/tmp/sportshub-creatives", ...rest] = process.argv
const onlyIdx = rest.indexOf("--only")
const only = onlyIdx >= 0 ? rest[onlyIdx + 1].split(",") : null
const FPS = 24

fs.mkdirSync(outDir, { recursive: true })
const files = fs
  .readdirSync(srcDir)
  .filter((f) => f.endsWith(".html") && !f.startsWith("_"))
  .filter((f) => !only || only.some((o) => f.startsWith(o)))

const FORMATS = [
  // portrait 4:5 is the biggest canvas Instagram/Facebook feeds allow — the
  // default pick for feed posts and feed ads. Story 9:16 fills Reels/TikTok
  // with content scaled up and kept inside platform UI safe zones. Square
  // stays for carousels and placements that require 1:1.
  { key: "portrait", w: 1080, h: 1350, hash: "#portrait" },
  { key: "story", w: 1080, h: 1920, hash: "#story" },
  { key: "square", w: 1080, h: 1080, hash: "" },
]

const browser = await chromium.launch()

for (const file of files) {
  const name = file.replace(".html", "")
  // ad-*.html are full 9:16 spots authored at 1080x1920 — story format only.
  const isAd = name.startsWith("ad-")
  const animated = name.startsWith("v") || isAd
  const formats = isAd ? FORMATS.filter((f) => f.key === "story") : FORMATS
  for (const fmt of formats) {
    const page = await browser.newPage({ viewport: { width: fmt.w, height: fmt.h }, deviceScaleFactor: 1 })
    await page.goto(`file://${path.join(srcDir, file)}${fmt.hash}`, { waitUntil: "networkidle" })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(150)

    if (!animated) {
      const out = path.join(outDir, `${name}-${fmt.key}.png`)
      await page.screenshot({ path: out })
      console.log("png ", path.basename(out))
    } else {
      const duration = await page.evaluate(() => window.__duration ?? 8000)
      const frames = Math.round((duration / 1000) * FPS)
      const tmp = fs.mkdtempSync(path.join(outDir, `.frames-${name}-${fmt.key}-`))
      for (let i = 0; i < frames; i++) {
        await page.evaluate((t) => window.__seek(t), (i * 1000) / FPS)
        await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(4, "0")}.png`) })
      }
      const mp4 = path.join(outDir, `${name}-${fmt.key}.mp4`)
      execFileSync("ffmpeg", [
        "-y", "-framerate", String(FPS), "-i", path.join(tmp, "f%04d.png"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-movflags", "+faststart", mp4,
      ], { stdio: "ignore" })
      console.log("mp4 ", path.basename(mp4), `(${frames}f)`)
      if (fmt.key === "square") {
        const gif = path.join(outDir, `${name}.gif`)
        execFileSync("ffmpeg", [
          "-y", "-framerate", String(FPS), "-i", path.join(tmp, "f%04d.png"),
          "-vf", "fps=12,scale=540:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer",
          gif,
        ], { stdio: "ignore" })
        console.log("gif ", path.basename(gif))
      }
      fs.rmSync(tmp, { recursive: true, force: true })
    }
    await page.close()
  }
}

await browser.close()
console.log("done ->", outDir)
