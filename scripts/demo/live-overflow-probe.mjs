/** Finds what makes the live game page overflow horizontally at 390px. */
import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const GAME = process.argv[2] || "856c8e4f-740c-4565-8657-f016223e413d"
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
await p.goto(`${BASE}/live/${GAME}`, { waitUntil: "domcontentloaded" })
await p.waitForTimeout(6000)
const out = await p.evaluate(() => {
  const vw = window.innerWidth
  const rows = []
  for (const el of Array.from(document.querySelectorAll("body, body *"))) {
    const r = el.getBoundingClientRect()
    const over = Math.round(r.right - vw)
    const sw = el.scrollWidth
    const cw = el.clientWidth
    if (over > 1 || (sw > cw + 1 && getComputedStyle(el).overflowX === "visible")) {
      rows.push({
        tag: el.tagName,
        cls: String(el.className).slice(0, 70),
        w: Math.round(r.width),
        left: Math.round(r.left),
        right: Math.round(r.right),
        sw,
        cw,
        ox: getComputedStyle(el).overflowX,
        text: (el.textContent || "").trim().slice(0, 34),
      })
    }
  }
  return { vw, docSW: document.documentElement.scrollWidth, bodySW: document.body.scrollWidth, rows }
})
console.log(`viewport ${out.vw} doc.scrollWidth ${out.docSW} body.scrollWidth ${out.bodySW}`)
for (const r of out.rows) console.log(JSON.stringify(r))
await browser.close()
