/**
 * Deck screenshots, one command, repeatable.
 *
 *   npm run deck:shots            both sets
 *   npm run deck:shots -- --nph   just the NPH set
 *
 * Every screenshot in /deck/leagues and /deck/nph comes from here. Before this
 * existed the captures were ad-hoc scratch scripts, so re-shooting after a UI
 * change meant rediscovering all of it: which element to clip to, how tall a
 * band to take, how to get a neutral set without a rival league's name in it,
 * and which frame each slide actually needs. That is what this file is for.
 *
 * ── WHAT IT KNOWS THAT YOU WOULD OTHERWISE REDISCOVER ────────────────────
 *
 * 1. CLIP TO <main>. A full-page shot is a third sidebar and top bar, neither
 *    of which carries an argument, and shrinking that to fit a slide is why
 *    text came out at 7.6px.
 *
 * 2. CAPTURE NARROW, CROP WIDE. 1280 viewport, then a band about 2.24:1. The
 *    deck's picture box is roughly 2.7:1, so a taller crop is height-bound in
 *    it and wastes the width. At 2.24:1 the product renders on the slide at
 *    about 1.09x, i.e. slightly larger than life.
 *
 * 3. SCROLL EXPLICITLY FOR DETAIL FRAMES. `scrollIntoViewIfNeeded` does
 *    nothing when the target is already on screen, which silently produced
 *    detail frames identical to the first frame.
 *
 * 4. THE NEUTRAL SET IS A RENAME, NOT A SECOND WORLD. The league, its
 *    organisation AND the stored recap bodies carry the league name; renaming
 *    only the league leaves "NPH" sitting in the news cards on the public hub.
 *    The rename is reverted in a finally block. If this script is killed
 *    mid-run, run it again: it re-snapshots and re-restores.
 *
 * 5. THE DEMO RIBBON rides the right edge of every console page and is cropped
 *    off in the convert step, not here.
 *
 * Conversion to WebP happens in deck-shots-convert.py, which this does not
 * call. `npm run deck:shots` runs both.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

/* The two dependencies live in different node_modules: playwright is installed
   under scripts/demo, @prisma/client at the repo root. Resolving both against
   an explicit package.json means this runs from any working directory, which
   matters because CWD drift between calls is a standing hazard in this repo. */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const fromRoot = createRequire(path.join(REPO, "package.json"))
const fromDemo = createRequire(path.join(REPO, "scripts", "demo", "package.json"))
const { chromium } = fromDemo("playwright")
const { PrismaClient } = fromRoot("@prisma/client")

const BASE = process.env.DECK_BASE ?? "http://localhost:3000"
/** Comma-separated shot names to re-shoot; unset means every screen. */
const ONLY_SHOTS = process.env.DECK_ONLY?.split(",").map((s) => s.trim()).filter(Boolean) ?? null
const LEAGUE = process.env.DECK_LEAGUE ?? "a6b08fb8-0a65-486e-ad9d-26f069a120ea"
const SEASON = process.env.DECK_SEASON ?? "75f3bdac-8bac-4a2c-8a14-a9d1d79f7c4e"
const LOGIN = process.env.DECK_LOGIN ?? "owner-nph@sportshub.demo"
const PASSWORD = process.env.DECK_PASSWORD ?? "TestPass123!"
const RAW = process.env.DECK_RAW ?? path.join(REPO, ".deck-shots")

/** What the neutral set renames everything to. Checked against the census for
 *  collisions before it was chosen: "Parkview" matched zero real tenants. */
const NEUTRAL = {
  league: "Parkview Summer League",
  org: "Parkview Basketball",
  tagline: "Weekend basketball, all summer",
  description:
    "Parkview's summer circuit: weekend basketball from April through September. Every game is scored live with stats, standings, recaps and Player of the Game cards.",
}

/**
 * One entry per picture on a slide.
 *
 * `frames` are EXTRA frames beyond the first, in order. Each is either
 * `{ scrollTo }` to bring a region into view or `{ click }` to open something
 * first. The slide crossfades between all of them. Add a screen by adding a
 * row here; nothing else needs editing.
 */
const SHOTS = [
  { name: "overview", url: (c) => `${c.console}?tab=overview`, frames: [{ scrollTo: "Season checklist" }] },
  {
    name: "plan",
    /* Slide 4 needs the planner drawing a REAL calendar: grades sitting on
       weekends, each in a named building. That comes from the journey world
       (scenario nph-pitch-journey, stage 3 or 4), where seedJourneyStage3
       writes SeasonSession.unitKeys AND unitVenues.

       THIS SHOT OPENS THE SEASON'S OWN PLAN. It must never create one: a fresh
       plan is born with no weekends and no gym time at all (owner ruling
       2026-08-05), so "Start a new plan" is exactly how this slide came out as
       a grid of "No gym on this date yet" — the empty board the owner
       reported. Nothing in a screenshot pipeline should be making data. */
    custom: async ({ page, shoot, planning, base }) => {
      if (!planning) {
        console.log("  SKIPPED plan: no planning season. Load nph-pitch-journey stage 3+ from Dashboard > Admin > Demos")
        return false
      }
      const root = `${base}/manage/leagues/${planning.leagueId}/seasons/${planning.seasonId}/plan`

      /* GET /plans also performs the lazy snapshot, so a season whose calendar
         lives on its sessions gets that calendar named as plan #1 (imported,
         active) on this first call. */
      /* page.request shares the context's cookies and does NOT run in the
         page, so it cannot be torn down by the post-login navigation. */
      const res = await page.request.get(`${base}/api/seasons/${planning.seasonId}/plans`)
      const plans = res.ok() ? (await res.json()).plans : null
      if (!plans?.length) {
        throw new Error("season holds no plan to open; the planner would have been photographed empty")
      }
      const plan = plans.find((p) => p.isActive) ?? plans[0]
      /* The plan rides in the address on every step, which is what makes a
         cold page load open it (a visit otherwise starts with nothing open). */
      const at = (step) => `${root}?plan=${plan.id}&step=${step}`
      console.log(`    plan: "${plan.name}" (${plan.source}${plan.isActive ? ", active" : ""})`)

      await page.goto(at(1), { waitUntil: "networkidle", timeout: 60000 })
      await page.waitForTimeout(3000)
      const open = await page.evaluate(() =>
        !/No plan open|Choose a plan in step 1/i.test(document.querySelector("main")?.innerText ?? "")
      )
      if (!open) throw new Error("plan did not open; the planner would have been photographed empty")
      /* Onto the TABLE HEAD, not the question above it. Two read-only banners
         sit between the two on a finalized season, and anchoring higher left
         the grade rows — the numbers this frame is about — under the crop. */
      await bringToTop(page, "EXPECTED TEAMS")
      await page.waitForTimeout(700)
      await shoot("plan")                                   // 1. who is coming

      /* Step 2 is READ ONLY here. The old capture clicked up to twelve weekend
         chips to switch weekends on; against a populated plan those clicks
         toggle real weekends OFF, and the board autosaves within a second. */
      await page.goto(at(2), { waitUntil: "networkidle", timeout: 60000 })
      await page.waitForTimeout(3000)
      await bringToTop(page, "When would you like to run sessions")
      await page.waitForTimeout(700)
      await shoot("plan-2")                                 // 2. gyms and weekends

      await page.goto(at(3), { waitUntil: "networkidle", timeout: 60000 })
      await page.waitForTimeout(4500)
      /* "Draw the calendar" is deliberately NOT pressed: the board is already
         drawn from the plan, and re-solving would overwrite the very calendar
         this frame exists to photograph. */
      await page.keyboard.press("Escape").catch(() => {})
      await page.mouse.click(5, 5).catch(() => {})
      await page.waitForTimeout(600)
      /* Anchor on the FIRST SESSION COLUMN, not the gym roster above it. The
         convert step keeps the top 77% of the band, and anchoring on "YOUR
         GYMS" pushed the weekend cards so low that the grade boxes — the whole
         point of this frame — were cropped off the bottom of the slide. */
      await bringToTop(page, "SESSION 1")
      await page.waitForTimeout(1200)

      /* Refuse to ship an empty board — the failure this whole pass exists to
         remove. A drawn board names buildings on its weekends. */
      const board = await page.evaluate(() => {
        const main = document.querySelector("main")
        const t = main?.innerText ?? ""
        /* Count the GRADE CHIPS sitting in weekend cells, not the gym roster
           at the top of the board — the roster renders whether or not a single
           grade was placed, so matching on gym names alone passed on an empty
           calendar once already. */
        return {
          chips: main?.querySelectorAll('[data-testid="grade-chip"]').length ?? 0,
          grades: (t.match(/\bGr\s?\d+\b|\bGrade \d+\b/g) || []).length,
          unplanned: (t.match(/No gym on this date yet/gi) || []).length,
        }
      })
      if (board.chips === 0 && board.grades === 0) {
        throw new Error(
          "no grade sits on any weekend; refusing to photograph an empty calendar. " +
            "Check Division.expectedTeams — planning runs on the estimate alone, and a null one excludes every grade."
        )
      }
      console.log(
        `    board: ${board.chips} grade chips${board.unplanned ? ` · ${board.unplanned} unplanned cells` : ""}`
      )
      await shoot("plan-3")                                 // 3. the board
      return true
    },
  },
  { name: "schedule", url: (c) => `${c.console}?tab=schedule`, frames: [{ scrollTo: "Team check" }] },
  { name: "playoffs", url: (c) => `${c.console}?tab=playoffs` },
  { name: "referees", url: (c) => `${c.console}?tab=referees`, frames: [{ scrollTo: "League referee pool" }] },
  {
    name: "waivers",
    url: (c) => `${c.season}/waivers`,
    frames: [
      { scrollTo: "Toronto Lords" },
      /* Expanding a team turns the row from a count into the actual list of
         parents, signed against outstanding. That is the frame that shows the
         product doing something rather than reporting a number. */
      { click: "Toronto Lords Grade 9" },
    ],
  },
  { name: "hub", url: (c) => `${c.base}/league/${SEASON}`, full: true },
]

/**
 * THE WORLD SLIDE 4 IS SHOT IN. The planner frames come from the full-scale
 * journey world (scenario nph-pitch-journey), not from the everyday demo
 * league the rest of the deck uses: it is the only one carrying a season whose
 * sessions hold both a grade calendar and the buildings those grades play in.
 *
 * Resolved by NAME, because every reseed mints new ids and a pinned id goes
 * stale silently — which is how this shot ended up pointed at a four-team stub.
 * Override with DECK_PLAN_LEAGUE / DECK_PLAN_SEASON when shooting elsewhere.
 */
const PLAN_LEAGUE_NAME = process.env.DECK_PLAN_LEAGUE_NAME ?? "NPH Showcase League"
const PLAN_SEASON_LABEL = process.env.DECK_PLAN_SEASON_LABEL ?? "Fall/Winter 2026-27"

async function planningSeason(prisma) {
  if (process.env.DECK_PLAN_LEAGUE && process.env.DECK_PLAN_SEASON) {
    return { leagueId: process.env.DECK_PLAN_LEAGUE, seasonId: process.env.DECK_PLAN_SEASON }
  }
  const season = await prisma.season.findFirst({
    where: { label: PLAN_SEASON_LABEL, league: { name: PLAN_LEAGUE_NAME } },
    orderBy: { createdAt: "desc" },
    select: { id: true, leagueId: true },
  })
  return season ? { leagueId: season.leagueId, seasonId: season.id } : null
}

const ctx = {
  base: BASE,
  console: `${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}/manage`,
  season: `${BASE}/manage/leagues/${LEAGUE}/seasons/${SEASON}`,
}

async function signIn(page) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" })
  /* Filling before React hydrates leaves the form's state empty and the
     submit posts blank credentials. */
  await page.waitForTimeout(2500)
  await page.fill("#email", LOGIN)
  await page.fill("#password", PASSWORD)
  await Promise.all([
    page
      .waitForResponse((r) => r.url().includes("/api/auth/callback/credentials"), { timeout: 20000 })
      .catch(() => null),
    page.click('button[type="submit"]:has-text("Sign in")'),
  ])
  for (let i = 0; i < 40; i++) {
    const j = await (await page.request.get(`${BASE}/api/auth/session`)).json().catch(() => ({}))
    if (j?.user?.id) return true
    await page.waitForTimeout(500)
  }
  return false
}

/** Scroll so `needle` sits just under the top of the content band.
 *
 *  Without this every planner frame showed the page header and the step rail
 *  and then ran out of band before the actual content: the grade rows, the gym
 *  list, the weekend picker were all below the fold. The chrome is identical on
 *  all three steps, so the frames looked like three copies of nothing. */
async function bringToTop(page, needle) {
  return page.evaluate((text) => {
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
    let el = null
    while (walk.nextNode()) {
      const n = walk.currentNode
      if (n.children.length === 0 && (n.textContent || "").trim().toLowerCase().includes(text.toLowerCase())) { el = n; break }
    }
    if (!el) return -1
    const top = el.getBoundingClientRect().top - document.querySelector("main").getBoundingClientRect().top - 90
    if (top > 0) scrollBy(0, top)
    return Math.round(Math.max(0, top))
  }, needle)
}

/** The content band: <main> minus the furniture, capped so the crop stays wide. */
const band = (page, full) =>
  page.evaluate((isFull) => {
    if (isFull) return { x: 0, y: 0, width: innerWidth, height: innerHeight }
    const m = document.querySelector("main")
    const r = m.getBoundingClientRect()
    const top = Math.max(0, Math.round(r.y))
    return { x: Math.round(r.x), y: top, width: Math.round(r.width), height: Math.min(560, innerHeight - top) }
  }, full)

async function captureSet(outDir, planning) {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })
    if (!(await signIn(page))) throw new Error("login failed")
    const shoot = async (name) =>
      page.screenshot({ path: path.join(outDir, `${name}.png`), clip: await band(page, false) })
    for (const shot of SHOTS) {
      /* DECK_ONLY=plan,waivers re-shoots just those screens. The raw PNGs of
         every other screen stay on disk and the convert step re-encodes them
         untouched, so fixing one slide never costs a re-shoot of the rest. */
      if (ONLY_SHOTS && !ONLY_SHOTS.includes(shot.name)) continue
      if (shot.custom) {
        const ok = await shot.custom({ page, shoot, planning, base: BASE })
        if (ok) console.log(`  200 ${shot.name} (scripted)`)
        continue
      }
      const res = await page.goto(shot.url(ctx), { waitUntil: "networkidle", timeout: 45000 })
      await page.waitForTimeout(2500)
      await page.screenshot({ path: path.join(outDir, `${shot.name}.png`), clip: await band(page, shot.full) })
      let note = ""
      for (const [idx, frame] of (shot.frames ?? []).entries()) {
        const suffix = `-${idx + 2}`
        if (frame.click) {
          const target = page.getByText(frame.click, { exact: false }).first()
          if (!(await target.count())) throw new Error(`click target not found on ${shot.name}: "${frame.click}"`)
          await target.click()
          await page.waitForTimeout(1200)
          await page.screenshot({ path: path.join(outDir, `${shot.name}${suffix}.png`), clip: await band(page, shot.full) })
          note += ` +click`
          continue
        }
        const moved = await page.evaluate((needle) => {
          const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
          let el = null
          while (walk.nextNode()) {
            const n = walk.currentNode
            if (n.children.length === 0 && (n.textContent || "").trim().toLowerCase().includes(needle.toLowerCase())) {
              el = n
              break
            }
          }
          if (!el) return -1
          const top =
            el.getBoundingClientRect().top - document.querySelector("main").getBoundingClientRect().top - 24
          if (top <= 0) return 0
          scrollBy(0, top)
          return Math.round(top)
        }, frame.scrollTo)
        if (moved < 0) throw new Error(`scroll target not found on ${shot.name}: "${frame.scrollTo}"`)
        await page.waitForTimeout(900)
        await page.screenshot({ path: path.join(outDir, `${shot.name}${suffix}.png`), clip: await band(page, shot.full) })
        note += ` +scroll(${moved}px)`
      }
      console.log(`  ${res?.status()} ${shot.name}${note}`)
    }
  } finally {
    await browser.close()
  }
}

async function renameForNeutral(prisma, snapshotPath, planning) {
  /* THE PLAN'S OWN NAME CARRIES THE BRAND. The imported reference plan is
     called "NPH plan" (IMPORTED_PLAN_NAME), and it is printed on all three
     planner frames — "Working in NPH plan", "NPH plan is on the board", and
     the plan picker. Renaming only the league leaves it sitting there. */
  const plans = planning
    ? await prisma.seasonPlan.findMany({
        where: { seasonId: planning.seasonId, name: { contains: "NPH" } },
        select: { id: true, name: true },
      })
    : []
  for (const pl of plans) {
    await prisma.seasonPlan.update({
      where: { id: pl.id },
      data: { name: pl.name.split("NPH").join("Parkview") },
    })
  }

  const league = await prisma.league.findUnique({
    where: { id: LEAGUE },
    select: { name: true, tagline: true, description: true, organizationId: true },
  })
  /* A missing league means DECK_LEAGUE is stale — every reseed mints new ids.
     On a filtered run that is survivable (the planner frames never show the
     league name); on a full run it would silently ship NPH-branded slides to
     the neutral deck, so it stops here. */
  if (!league) {
    if (!ONLY_SHOTS) {
      throw new Error(
        `neutral rename: no league ${LEAGUE}. Set DECK_LEAGUE to the league this world actually holds.`
      )
    }
    console.log(`  league ${LEAGUE} not found — renamed ${plans.length} plan(s) only (filtered run)`)
    fs.writeFileSync(snapshotPath, JSON.stringify({ league: null, org: null, posts: [], plans }))
    return
  }
  const org = league.organizationId
    ? await prisma.organization.findUnique({ where: { id: league.organizationId }, select: { name: true } })
    : null
  /* Recap bodies carry the league name in their text. Rename only the league
     and "NPH" is still sitting in the news cards on the public hub shot. */
  const posts = await prisma.post.findMany({
    where: { OR: [{ body: { contains: "NPH" } }, { title: { contains: "NPH" } }] },
    select: { id: true, title: true, body: true },
  })
  fs.writeFileSync(snapshotPath, JSON.stringify({ league, org, posts, plans }))

  await prisma.league.update({
    where: { id: LEAGUE },
    data: { name: NEUTRAL.league, tagline: NEUTRAL.tagline, description: NEUTRAL.description },
  })
  if (league.organizationId) {
    await prisma.organization.update({ where: { id: league.organizationId }, data: { name: NEUTRAL.org } })
  }
  const swap = (s) =>
    s?.split("NPH Summer League").join(NEUTRAL.league).split("NPH").join("Parkview") ?? s
  for (const p of posts) {
    await prisma.post.update({ where: { id: p.id }, data: { title: swap(p.title), body: swap(p.body) } })
  }
  console.log(`  renamed (${posts.length} posts, ${plans.length} plan(s) patched)`)
}

async function restore(prisma, snapshotPath) {
  if (!fs.existsSync(snapshotPath)) return
  const { league, org, posts, plans } = JSON.parse(fs.readFileSync(snapshotPath, "utf8"))
  for (const pl of plans ?? []) {
    await prisma.seasonPlan.update({ where: { id: pl.id }, data: { name: pl.name } })
  }
  if (!league) {
    console.log(`  restored: ${(plans ?? []).length} plan name(s)`)
    fs.rmSync(snapshotPath)
    return
  }
  await prisma.league.update({
    where: { id: LEAGUE },
    data: { name: league.name, tagline: league.tagline, description: league.description },
  })
  if (league.organizationId) {
    await prisma.organization.update({ where: { id: league.organizationId }, data: { name: org.name } })
  }
  for (const p of posts) {
    await prisma.post.update({ where: { id: p.id }, data: { title: p.title, body: p.body } })
  }
  const after = await prisma.league.findUnique({ where: { id: LEAGUE }, select: { name: true } })
  const stray =
    (await prisma.post.count({
      where: { OR: [{ body: { contains: "Parkview" } }, { title: { contains: "Parkview" } }] },
    })) + (await prisma.seasonPlan.count({ where: { name: { contains: "Parkview" } } }))
  console.log(`  restored: ${after.name} | stray renamed posts: ${stray}`)
  if (stray > 0) throw new Error("restore incomplete: renamed posts remain")
  fs.rmSync(snapshotPath)
}

const only = process.argv.includes("--nph") ? "nph" : process.argv.includes("--neutral") ? "neutral" : "both"

const lookup = new PrismaClient()
const planning = await planningSeason(lookup).finally(() => lookup.$disconnect())
console.log(`deck shots -> ${RAW} (${only})`)
console.log(
  planning
    ? `planner world: league ${planning.leagueId} season ${planning.seasonId}`
    : `planner world: MISSING (${PLAN_LEAGUE_NAME} / ${PLAN_SEASON_LABEL}) — slide 4 will be skipped`
)
fs.mkdirSync(RAW, { recursive: true })

if (only !== "neutral") {
  console.log("NPH set:")
  await captureSet(path.join(RAW, "nph"), planning)
}

if (only !== "nph") {
  const prisma = new PrismaClient()
  const snapshot = path.join(RAW, "rename-snapshot.json")
  try {
    console.log("neutral set:")
    await renameForNeutral(prisma, snapshot, planning)
    await captureSet(path.join(RAW, "neutral"), planning)
  } finally {
    /* The demo world must come back even if a capture threw. */
    await restore(prisma, snapshot)
    await prisma.$disconnect()
  }
}

console.log("\nnow run: python3 scripts/marketing/deck-shots-convert.py")
