// Screenshot expedition for the launch homepage (owner request, 2026-08-17):
// sweep the platform, capture every candidate screen with maximum content in
// frame, and let the owner pick from the contact sheet at /dev/home-shots.
//
// Shots land in apps/web/public/home-preview/shots/ (untracked until chosen).
// Launch-state chrome: signup buttons and the local demo pill are hidden in
// every capture, the way the launch build will hide them.
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"
import { ensureSession, BASE } from "./lib.mjs"

const OUT = path.resolve("apps/web/public/home-preview/shots")
fs.mkdirSync(OUT, { recursive: true })

const PARENT = "summer-parent-lords@sportshub.demo"

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }

const LIVE_GAME = "/live/856c8e4f-740c-4565-8657-f016223e413d"
const EOS_LEAGUE = "/league/860f7c32-65be-45c4-8d4f-84fea6c5d296"
const RECAP =
  "/news/toronto-lords-grade-10-girls-vs-burlington-force-grade-10-gi-20260805-f44d3c46"

/**
 * name         output file name
 * url          route
 * device       PHONE | DESKTOP
 * auth         capture with the parent session
 * scrollY      scroll before shooting (content over chrome)
 * tapText      click the control with this exact text first (tab switches)
 * followHref   after load, navigate to the first link matching this regex
 */
const SHOTS = [
  // The live game, every view worth judging.
  // The main scorecard, top of the page (owner 2026-08-17: "the top view").
  { name: "game-live-scorecard-phone", url: LIVE_GAME, device: PHONE, scrollY: 105 },
  { name: "game-live-leaders-phone", url: LIVE_GAME, device: PHONE, scrollY: 340 },
  { name: "game-live-leaders-deep-phone", url: LIVE_GAME, device: PHONE, scrollY: 720 },
  { name: "game-live-boxscore-phone", url: LIVE_GAME, device: PHONE, tapText: "Team stats", scrollY: 340 },
  { name: "game-live-playbyplay-phone", url: LIVE_GAME, device: PHONE, tapText: "Play-by-play", scrollY: 340 },

  // News: the recap scrolled past the header, and the card grid.
  { name: "news-recap-scrolled-phone", url: RECAP, device: PHONE, scrollY: 430 },
  { name: "news-cards-desktop", url: "/news", device: DESKTOP, scrollY: 260 },
  { name: "news-cards-phone", url: "/news", device: PHONE, scrollY: 200 },

  // Discovery: the club directory with the province and GTA chips.
  { name: "discover-clubs-phone", url: "/club", device: PHONE, scrollY: 205 },

  // The public feed and browse surfaces.
  { name: "home-feed-desktop", url: "/", device: DESKTOP, scrollY: 700 },
  { name: "home-feed-deep-desktop", url: "/", device: DESKTOP, scrollY: 1500 },
  { name: "home-feed-phone", url: "/", device: PHONE, scrollY: 600 },
  { name: "leagues-browse-desktop", url: "/leagues", device: DESKTOP, scrollY: 220 },

  // League depth: standings, leaders, phone standings.
  { name: "league-standings-desktop", url: EOS_LEAGUE, device: DESKTOP, scrollY: 760 },
  { name: "league-leaders-desktop", url: `${EOS_LEAGUE}/leaders`, device: DESKTOP, scrollY: 200 },
  { name: "league-standings-phone", url: EOS_LEAGUE, device: PHONE, scrollY: 900 },

  // A real club page.
  { name: "club-page-desktop", url: "/club/toronto-lords", device: DESKTOP, scrollY: 0 },
  { name: "club-page-phone", url: "/club/toronto-lords", device: PHONE, scrollY: 120 },

  // The parent's phone, signed in: the week, payments, chat, polls, feed.
  { name: "parent-calendar-phone", url: "/calendar", device: PHONE, auth: true, scrollY: 0 },
  { name: "parent-calendar-scrolled-phone", url: "/calendar", device: PHONE, auth: true, scrollY: 300 },
  { name: "parent-home-phone", url: "/", device: PHONE, auth: true, scrollY: 0 },
  { name: "parent-payments-phone", url: "/payments", device: PHONE, auth: true, scrollY: 0 },
  { name: "parent-messages-phone", url: "/messages", device: PHONE, auth: true, scrollY: 0 },
  {
    name: "parent-team-chat-phone",
    url: "/messages",
    device: PHONE,
    auth: true,
    followHref: /\/teams\/[^/]+\/chat/,
    scrollY: 0,
  },
  { name: "parent-polls-phone", url: "/polls", device: PHONE, auth: true, scrollY: 0 },
  { name: "parent-feed-phone", url: "/feed", device: PHONE, auth: true, scrollY: 0 },
  { name: "parent-notifications-phone", url: "/notifications", device: PHONE, auth: true, scrollY: 0 },

  // The social taste (owner 2026-08-17): the feed's cards and a player's
  // public season page, Danielle Reyes (#20, the recap's Player of the Game).
  { name: "social-feed-phone", url: "/feed", device: PHONE, auth: true, scrollY: 500 },
  { name: "social-feed-deep-phone", url: "/feed", device: PHONE, auth: true, scrollY: 1200 },
  {
    name: "social-player-page-phone",
    url: "/player/729b0d07-e388-464f-bc09-1a4ca3e92448",
    device: PHONE,
    scrollY: 120,
  },
  {
    name: "social-player-page-deep-phone",
    url: "/player/729b0d07-e388-464f-bc09-1a4ca3e92448",
    device: PHONE,
    scrollY: 700,
  },
]

const hideLaunchChrome = (page) =>
  page.evaluate(() => {
    document.querySelectorAll("a, button").forEach((el) => {
      const t = (el.textContent || "").trim()
      if (t === "Start Free" || t.toUpperCase().includes("TRY THE DEMO")) {
        el.style.visibility = "hidden"
      }
    })
  })

// The demo-mode welcome popup is local chrome; the launch build will not have
// it. Dismiss it before shooting so home captures show the page.
const dismissWelcome = async (page) => {
  const dismiss = page.getByText("Look around first", { exact: true }).first()
  if (await dismiss.isVisible({ timeout: 1500 }).catch(() => false)) {
    await dismiss.click().catch(() => {})
    await page.waitForTimeout(800)
  }
}

const browser = await chromium.launch()
const storageState = await ensureSession(PARENT).catch((e) => {
  console.log(`AUTH FAILED for ${PARENT}: ${e}`)
  return null
})

for (const shot of SHOTS) {
  if (shot.auth && !storageState) {
    console.log(`${shot.name}: SKIP (no session)`)
    continue
  }
  const ctx = await browser.newContext({
    ...shot.device,
    ...(shot.auth ? { storageState } : {}),
  })
  const page = await ctx.newPage()
  try {
    await page
      .goto(BASE + shot.url, { waitUntil: "networkidle", timeout: 60000 })
      .catch(async () => page.goto(BASE + shot.url, { waitUntil: "domcontentloaded", timeout: 60000 }))
    await page.waitForTimeout(3000)

    if (shot.auth && page.url().includes("/sign-in")) {
      console.log(`${shot.name}: SKIP (bounced to sign-in)`)
      await ctx.close()
      continue
    }
    if (shot.followHref) {
      const href = await page.evaluate((pattern) => {
        const re = new RegExp(pattern)
        const a = Array.from(document.querySelectorAll("a")).find((el) =>
          re.test(el.getAttribute("href") || "")
        )
        return a ? a.getAttribute("href") : null
      }, shot.followHref.source)
      if (!href) {
        console.log(`${shot.name}: SKIP (no link matched ${shot.followHref})`)
        await ctx.close()
        continue
      }
      await page.goto(BASE + href, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {})
      await page.waitForTimeout(2500)
    }
    if (shot.tapText) {
      const tab = page.getByText(shot.tapText, { exact: true }).first()
      await tab.click({ timeout: 8000 }).catch(() => console.log(`${shot.name}: tab miss`))
      await page.waitForTimeout(1500)
    }
    await dismissWelcome(page)
    await hideLaunchChrome(page)
    if (shot.scrollY) {
      await page.evaluate((y) => window.scrollTo(0, y), shot.scrollY)
      await page.waitForTimeout(1000)
    }
    await page.screenshot({ path: path.join(OUT, `${shot.name}.png`) })
    console.log(`${shot.name}: captured`)
  } catch (e) {
    console.log(`${shot.name}: FAILED ${String(e).slice(0, 120)}`)
  }
  await ctx.close()
}
await browser.close()
