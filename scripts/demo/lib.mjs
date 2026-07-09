import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

export const BASE = "http://localhost:3000"
export const CLIPS = path.resolve("clips")
export const SESSIONS = path.resolve("sessions")
fs.mkdirSync(SESSIONS, { recursive: true })

// Log a persona in ONCE (headless, not recorded) and cache the session cookies,
// so recorded authenticated clips start already signed-in on the target screen —
// no login form wasted on camera.
const sessionCache = new Map()
export async function ensureSession(email, password = "TestPass123!") {
  const file = path.join(SESSIONS, email.replace(/[^a-z0-9]/gi, "_") + ".json")
  if (fs.existsSync(file)) return file
  if (sessionCache.has(email)) return sessionCache.get(email)
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.goto(BASE + "/sign-in", { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(700)
  await page.locator('input[type="email"], input[name="email"]').first().fill(email)
  await page.locator('input[type="password"], input[name="password"]').first().fill(password)
  await page.locator('button[type="submit"]').first().click()
  await page
    .waitForFunction(() => !location.pathname.startsWith("/sign-in"), { timeout: 15000 })
    .catch(() => {})
  await page.waitForTimeout(1500)
  await context.storageState({ path: file })
  await context.close()
  await browser.close()
  sessionCache.set(email, file)
  console.log(`  ↪ session cached: ${email}`)
  return file
}

// Per-persona device framing: parents/players live on phones, operators on
// desktop, the iPad-tuned scoring console on a tablet.
export const DEVICES = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, hasTouch: true },
}

// Injected once per document load: a fake cursor that follows real mouse events
// (Playwright dispatches them) and a bottom caption bar we drive from the script.
const OVERLAY = `
(() => {
  const init = () => {
    if (window.__demo) return; window.__demo = true;
    const s = document.createElement('style');
    s.textContent = \`
      #__cur{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;
        border-radius:50%;background:rgba(37,99,235,.35);border:2px solid #2563eb;
        pointer-events:none;transition:transform .12s ease;left:640px;top:400px;box-shadow:0 0 0 4px rgba(37,99,235,.12)}
      #__cur.__click{transform:scale(.55);background:rgba(37,99,235,.75)}
      #__cap{position:fixed;z-index:2147483646;left:50%;bottom:34px;transform:translateX(-50%);
        max-width:80vw;padding:12px 22px;border-radius:14px;background:rgba(17,17,20,.92);color:#fff;
        font:600 18px/1.35 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.2px;
        box-shadow:0 12px 40px rgba(0,0,0,.35);opacity:0;transition:opacity .25s ease;text-align:center}
      #__cap.__on{opacity:1}
      @media (max-width:520px){#__cap{font-size:14px;bottom:22px;padding:9px 15px;max-width:88vw}}
    \`;
    document.head.appendChild(s);
    const cur = document.createElement('div'); cur.id='__cur'; document.body.appendChild(cur);
    const cap = document.createElement('div'); cap.id='__cap'; document.body.appendChild(cap);
    addEventListener('mousemove', e => { cur.style.left=e.clientX+'px'; cur.style.top=e.clientY+'px'; }, true);
    const pulse = () => { cur.classList.add('__click'); setTimeout(()=>cur.classList.remove('__click'),260); };
    addEventListener('mousedown', pulse, true);
    addEventListener('touchstart', e => { const t=e.touches[0]; if(t){cur.style.left=t.clientX+'px';cur.style.top=t.clientY+'px';} pulse(); }, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init); else init();
})();`

export async function record(name, title, steps, device = "desktop", auth = null) {
  const d = DEVICES[device] ?? DEVICES.desktop
  const storageState = auth ? await ensureSession(auth) : undefined
  const browser = await chromium.launch()
  const context = await browser.newContext({
    ...d,
    storageState,
    recordVideo: { dir: CLIPS, size: d.viewport },
    reducedMotion: "no-preference",
  })
  await context.addInitScript(OVERLAY)
  const page = await context.newPage()
  const h = helpers(page)
  let ok = true
  try {
    console.log(`▶ recording ${name} — ${title}`)
    await steps(page, h)
  } catch (e) {
    ok = false
    console.error(`  ✗ ${name} failed: ${e.message}`)
  }
  const vid = page.video()
  await page.waitForTimeout(500)
  await context.close()
  await browser.close()
  const tmp = await vid.path()
  const dest = path.join(CLIPS, `${name}.webm`)
  fs.renameSync(tmp, dest)
  const kb = Math.round(fs.statSync(dest).size / 1024)
  console.log(`  ${ok ? "✓" : "⚠"} ${name}.webm (${kb} KB)`)
  return ok
}

function helpers(page) {
  const cap = async (text) => {
    await page.evaluate((t) => {
      const c = document.getElementById("__cap")
      if (!c) return
      c.textContent = t
      c.classList.add("__on")
    }, text).catch(() => {})
    await page.waitForTimeout(900)
  }
  const capOff = async () =>
    page.evaluate(() => document.getElementById("__cap")?.classList.remove("__on")).catch(() => {})

  const goto = async (url, caption) => {
    await page.goto(BASE + url, { waitUntil: "domcontentloaded" }).catch(() => {})
    await page.waitForTimeout(1200)
    if (caption) await cap(caption)
  }

  const move = async (loc) => {
    const el = typeof loc === "string" ? page.locator(loc).first() : loc
    await el.scrollIntoViewIfNeeded().catch(() => {})
    const box = await el.boundingBox()
    if (!box) throw new Error("no bounding box for target")
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 })
    await page.waitForTimeout(220)
    return el
  }
  const click = async (loc) => {
    const el = await move(loc)
    await el.click({ timeout: 8000 })
    await page.waitForTimeout(700)
  }
  const type = async (loc, text) => {
    const el = await move(loc)
    await el.click()
    await el.fill("")
    await el.pressSequentially(text, { delay: 45 })
    await page.waitForTimeout(300)
  }
  const scroll = async (dy, ms = 900) => {
    await page.mouse.wheel(0, dy)
    await page.waitForTimeout(ms)
  }
  const beat = (ms = 700) => page.waitForTimeout(ms)

  const login = async (email, password = "TestPass123!") => {
    await page.goto(BASE + "/sign-in", { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(800)
    await page.locator('input[type="email"], input[name="email"]').first().fill(email)
    await page.locator('input[type="password"], input[name="password"]').first().fill(password)
    await page.locator('button[type="submit"]').first().click()
    await page.waitForTimeout(2600) // credentials sign-in does a full window.location redirect
  }

  return { cap, capOff, goto, move, click, type, scroll, beat, login }
}
