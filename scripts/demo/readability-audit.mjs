#!/usr/bin/env node
/**
 * Readability audit (owner ruling 2026-08-16: the 14px machine gate).
 *
 * The demo directory's presentation law says a scene is composed at a logical
 * width and rendered at scale 1.0 on a computer, so text authored at 14px
 * reaches the viewer at 14px. This script is the gate that proves it: it walks
 * a rendered page, measures EVERY visible text node's EFFECTIVE font size
 * (computed size multiplied by every CSS transform scale between the node and
 * the viewport) and lists the ones under the floor.
 *
 * On a demo player route it also steps the playback: chapter chips first, then
 * "Next beat" through the whole timeline, auditing every scene it lands on and
 * recording the stage's rendered scale, because a frame that fits by shrinking
 * is the exact failure the law bans.
 *
 * Usage (dev server must already be running):
 *   node scripts/demo/readability-audit.mjs \
 *     --routes /demos,/demos/season-planned-to-published \
 *     --out /tmp/readability-before.md
 *
 * Flags:
 *   --routes    comma separated paths (default: the two above)
 *   --out       markdown report path (default: ./readability-report.md)
 *   --floor     minimum effective px (default: 14)
 *   --base      origin (default: http://localhost:3000)
 *   --viewport  WxH (default 1440x900). 390x844 is the phone gate.
 *   --scope     all | stage | chrome (default all)
 *   --walk      true | false (default true): step the player, or audit as loaded
 *
 * Two floors, one law (owner 08-16, mobile round). A computer renders a scene
 * at 1.0 and is gated at 14px. A phone renders the same scene inside the
 * keyhole at a fixed 0.85, so its floor is 14 x 0.85 = 11px, and the UNSCALED
 * chrome around it (the intro, the transport, the caption) is still gated at
 * 14px. `--scope` is what lets each half be measured against its own floor
 * instead of averaging the two into a number that means nothing.
 */

import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"

const require = createRequire("/Users/ziakhan/zia/personal/sportshub/scripts/demo/lib.mjs")
const { chromium } = require("playwright")

/* ── Args ─────────────────────────────────────────────────────────────────── */

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const BASE = arg("base", "http://localhost:3000")
const FLOOR = Number(arg("floor", "14"))
const OUT = path.resolve(arg("out", "readability-report.md"))
const ROUTES = arg("routes", "/demos,/demos/season-planned-to-published")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean)

const SCOPE = arg("scope", "all")
const WALK = arg("walk", "true") !== "false"
const [VW, VH] = arg("viewport", "1440x900")
  .split("x")
  .map((n) => Number(n))
const VIEWPORT = { width: VW || 1440, height: VH || 900 }
/** A phone viewport is driven as a phone: touch, and a 2x screen. */
const MOBILE = VIEWPORT.width < 640

/* ── The in-page measurement ──────────────────────────────────────────────── */

/**
 * Runs in the browser. Returns every visible text node under the floor, with
 * its effective size, a selector path, and the first 40 characters of the text.
 *
 * Effective size is what the EYE gets: the computed font-size times the
 * accumulated scale of every ancestor transform. A 14px label inside a frame
 * scaled to 0.85 is an 11.9px label, and that is the disease this gate exists
 * to catch.
 */
const COLLECT = ({ floor, scope }) => {
  const out = []
  const seen = new Set()
  /* "stage" is the composed scene, which a phone renders at a fixed scale;
     "chrome" is everything the player draws around it at 1.0. */
  const inScope = (el) => {
    if (scope === "all") return true
    const inStage = Boolean(el.closest('[data-demo-stage="true"]'))
    return scope === "stage" ? inStage : !inStage
  }

  const scaleOf = (el) => {
    let s = 1
    let node = el
    while (node && node !== document.documentElement) {
      const t = getComputedStyle(node).transform
      if (t && t !== "none") {
        const m = new DOMMatrixReadOnly(t)
        // Uniform scales are what this codebase uses; take the x axis.
        if (m.a > 0) s *= m.a
      }
      node = node.parentElement
    }
    return s
  }

  const pathOf = (el) => {
    const parts = []
    let node = el
    let depth = 0
    while (node && node !== document.body && depth < 5) {
      let part = node.tagName.toLowerCase()
      if (node.getAttribute && node.getAttribute("data-demo-target")) {
        part += `[demo:${node.getAttribute("data-demo-target")}]`
      } else if (node.className && typeof node.className === "string") {
        const cls = node.className.trim().split(/\s+/).slice(0, 2).join(".")
        if (cls) part += "." + cls
      }
      parts.unshift(part)
      node = node.parentElement
      depth += 1
    }
    return parts.join(" > ")
  }

  /* The one exemption, and it is narrow: glyphs INSIDE a brand lockup. The
     "ONE" box on the wordmark is typography that belongs to the logo, not copy
     the viewer has to read, and resizing it would break the mark. Everything
     skipped here is counted and reported, never silently dropped. */
  const excluded = []

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n = walker.nextNode()
  while (n) {
    const text = (n.textContent || "").replace(/\s+/g, " ").trim()
    if (text.length > 0) {
      const el = n.parentElement
      if (el && el.closest("[data-brand-glyph]")) {
        excluded.push(text.slice(0, 20))
        n = walker.nextNode()
        continue
      }
      if (el && inScope(el)) {
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        const visible =
          cs.display !== "none" &&
          cs.visibility !== "hidden" &&
          Number(cs.opacity) > 0.05 &&
          rect.width > 0 &&
          rect.height > 0
        if (visible) {
          const size = Number.parseFloat(cs.fontSize) || 0
          const eff = size * scaleOf(el)
          if (eff > 0 && eff < floor - 0.05) {
            const key = pathOf(el) + "|" + text.slice(0, 40) + "|" + eff.toFixed(1)
            if (!seen.has(key)) {
              seen.add(key)
              out.push({
                eff: Number(eff.toFixed(1)),
                authored: Number(size.toFixed(1)),
                selector: pathOf(el),
                text: text.slice(0, 40),
              })
            }
          }
        }
      }
    }
    n = walker.nextNode()
  }
  out.sort((a, b) => a.eff - b.eff)
  return { violations: out, excluded: [...new Set(excluded)] }
}

/** The rendered scale of the demo stage, so "it fits" cannot mean "it shrank". */
const STAGE_SCALE = () => {
  const stage = document.querySelector('[data-demo-stage="true"]')
  if (!stage) return null
  const inner = stage.querySelector(":scope > div")
  if (!inner) return null
  const t = getComputedStyle(inner).transform
  if (!t || t === "none") return 1
  const m = new DOMMatrixReadOnly(t)
  return Number(m.a.toFixed(3))
}

/* ── Console error capture ────────────────────────────────────────────────── */

function watchConsole(page, sink) {
  page.on("console", (msg) => {
    if (msg.type() === "error") sink.push(msg.text().slice(0, 200))
  })
  page.on("pageerror", (err) => sink.push("pageerror: " + String(err).slice(0, 200)))
}

/* ── Scene walking ────────────────────────────────────────────────────────── */

async function auditScene(page, label, url) {
  const { violations, excluded } = await page.evaluate(COLLECT, { floor: FLOOR, scope: SCOPE })
  const scale = await page.evaluate(STAGE_SCALE)
  return { label, url, violations, excluded, scale }
}

/** Presses Play if the route opens on a read-then-play intro. */
async function startPlayer(page) {
  const play = page.locator('button:has-text("Play the demo")').first()
  if ((await play.count()) === 0) return false
  await play.click()
  await page.waitForTimeout(1200)
  // Playback is paused for the audit: a moving stage cannot be measured.
  const pause = page.locator('button:has-text("Pause")').first()
  if ((await pause.count()) > 0) await pause.click()
  await page.waitForTimeout(400)
  return true
}

async function chapterChips(page) {
  return page.$$eval(
    "button",
    (btns) =>
      btns
        .map((b) => (b.textContent || "").trim())
        .filter((t) => /^\d+\.\s/.test(t))
  )
}

async function walkPlayer(page, scenes, route) {
  const beatCount = await page
    .locator("text=/^Beat \\d+ of \\d+$/")
    .first()
    .textContent()
    .catch(() => null)
  const total = beatCount ? Number(beatCount.match(/of (\d+)/)?.[1] ?? 0) : 0

  // 1. Every chapter chip, which is the jump path a viewer actually uses.
  const chips = await chapterChips(page)
  for (const chip of chips) {
    await page.locator(`button:text-is("${chip}")`).first().click()
    await page.waitForTimeout(900)
    scenes.push(await auditScene(page, `chapter: ${chip}`, route))
  }

  // 2. Every beat from the top, so no scene escapes the gate.
  if (chips.length > 0) {
    await page.locator(`button:text-is("${chips[0]}")`).first().click()
    await page.waitForTimeout(700)
  }
  const next = page.locator('button:has-text("Next beat")').first()
  for (let i = 0; i < Math.max(0, total - 1); i += 1) {
    if ((await next.count()) === 0) break
    const visible = await next.isVisible().catch(() => false)
    if (!visible) break
    await next.click()
    await page.waitForTimeout(650)
    const beatLabel = await page
      .locator("text=/^Beat \\d+ of \\d+$/")
      .first()
      .textContent()
      .catch(() => `beat ${i + 2}`)
    scenes.push(await auditScene(page, (beatLabel || "").trim(), route))
  }
  return total
}

/* ── Report ───────────────────────────────────────────────────────────────── */

function renderReport(results, errors) {
  const lines = []
  lines.push(`# Readability audit (${FLOOR}px floor, scope ${SCOPE})`)
  lines.push("")
  lines.push(
    `Viewport ${VIEWPORT.width}x${VIEWPORT.height}. Effective size = computed font-size times every CSS transform scale between the node and the viewport.`
  )
  if (SCOPE !== "all") {
    lines.push("")
    lines.push(
      SCOPE === "stage"
        ? "Scope: the composed scene inside `[data-demo-stage]` only."
        : "Scope: the player's own chrome and the intro, everything OUTSIDE `[data-demo-stage]`."
    )
  }
  lines.push("")
  lines.push(`Run: ${new Date().toISOString()}`)
  lines.push("")

  let grand = 0
  for (const r of results) {
    const totalViolations = r.scenes.reduce((a, s) => a + s.violations.length, 0)
    grand += totalViolations
    const scales = r.scenes.map((s) => s.scale).filter((s) => typeof s === "number")
    const minScale = scales.length ? Math.min(...scales) : null
    lines.push(`## ${r.route}`)
    lines.push("")
    lines.push(`- scenes audited: ${r.scenes.length}`)
    lines.push(`- violations: **${totalViolations}**`)
    if (minScale !== null) lines.push(`- minimum stage scale: **${minScale}**`)
    if (r.runtime) {
      const s = Math.round(r.runtime / 1000)
      lines.push(
        `- runtime at 1x: **${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} sec**`
      )
    }
    const skipped = [...new Set(r.scenes.flatMap((s) => s.excluded ?? []))]
    if (skipped.length) {
      lines.push(
        `- excluded as brand-lockup glyphs (\`data-brand-glyph\`): ${skipped.map((t) => `\`${t}\``).join(", ")}`
      )
    }
    lines.push("")

    if (totalViolations === 0) {
      lines.push("EMPTY. Every visible text node renders at or above the floor.")
      lines.push("")
      continue
    }

    /* Grouped by the offending text so a component repeated on twenty beats is
       one line to fix, not twenty lines to read. */
    const byKey = new Map()
    for (const s of r.scenes) {
      for (const v of s.violations) {
        const key = `${v.eff}|${v.selector}|${v.text}`
        if (!byKey.has(key)) byKey.set(key, { ...v, scenes: [] })
        byKey.get(key).scenes.push(s.label)
      }
    }
    const rows = [...byKey.values()].sort((a, b) => a.eff - b.eff)
    lines.push(`| eff px | authored px | selector | text | scenes |`)
    lines.push(`|---|---|---|---|---|`)
    for (const v of rows) {
      const where =
        v.scenes.length > 3 ? `${v.scenes.slice(0, 2).join(", ")} +${v.scenes.length - 2}` : v.scenes.join(", ")
      lines.push(
        `| ${v.eff} | ${v.authored} | \`${v.selector.replace(/\|/g, "/")}\` | ${v.text.replace(/\|/g, "/")} | ${where} |`
      )
    }
    lines.push("")

    const belowScale = r.scenes.filter((s) => typeof s.scale === "number" && s.scale < 0.92)
    if (belowScale.length) {
      lines.push(`### Frames rendered below 0.92 scale`)
      lines.push("")
      for (const s of belowScale) lines.push(`- ${s.label}: scale ${s.scale}`)
      lines.push("")
    }
  }

  lines.push(`## Total`)
  lines.push("")
  lines.push(`**${grand}** violations across ${results.length} route(s).`)
  if (errors.length) {
    lines.push("")
    lines.push(`### Console errors (${errors.length})`)
    lines.push("")
    for (const e of [...new Set(errors)].slice(0, 30)) lines.push(`- ${e}`)
  }
  lines.push("")
  return lines.join("\n")
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: MOBILE ? 2 : 1,
    isMobile: MOBILE,
    hasTouch: MOBILE,
    reducedMotion: "no-preference",
  })
  const page = await context.newPage()
  const errors = []
  watchConsole(page, errors)

  const results = []
  for (const route of ROUTES) {
    process.stdout.write(`\n▸ ${route}\n`)
    await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 120000 })
    await page.waitForTimeout(3500)

    const scenes = []
    scenes.push(await auditScene(page, "intro", route))
    process.stdout.write(`  intro: ${scenes[0].violations.length} violations\n`)

    const started = WALK && (await startPlayer(page))
    let runtime = null
    if (started) {
      runtime = await page.evaluate(() => {
        const el = document.querySelector("[data-demo-runtime-ms]")
        return el ? Number(el.getAttribute("data-demo-runtime-ms")) : null
      })
      const total = await walkPlayer(page, scenes, route)
      process.stdout.write(`  walked ${total} beats, ${scenes.length} scenes\n`)
      if (runtime) {
        const s = Math.round(runtime / 1000)
        process.stdout.write(
          `  runtime at 1x: ${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} sec\n`
        )
      }
    }
    const sum = scenes.reduce((a, s) => a + s.violations.length, 0)
    process.stdout.write(`  ${route}: ${sum} violations\n`)
    results.push({ route, scenes, runtime })
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, renderReport(results, errors))
  process.stdout.write(`\nreport: ${OUT}\n`)

  await context.close()
  await browser.close()

  const grand = results.reduce(
    (a, r) => a + r.scenes.reduce((b, s) => b + s.violations.length, 0),
    0
  )
  process.exit(grand === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
