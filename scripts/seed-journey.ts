/**
 * NPH full-scale journey scenario (demo-journey plan, owner 2026-08-01).
 * Every REAL 2025-26 NPH team entry (scripts/data/nph-census.ts — their own
 * standings data) across Showcase League, D1, NPA and WNPA; real venue
 * names; FICTIONAL players (owner ruling — real players are minors).
 *
 * Stages (fast-forward = ADDITIVE top-up; live demo actions survive):
 *   1  Registration in flight — D1/NPA/WNPA approved + schedule-ready;
 *      Showcase League mid-registration (~25 of 146 submitted).
 *   2  Everyone's in — every remaining census team submitted (PENDING).
 *   3  Ready to schedule — all approved, fees settled, league FINALIZED, the
 *      two gyms the league has attached at full strength (Playground 3 = the
 *      home gym, Six Park 6 = pool, 10:00-22:00 — owner 2026-08-02: the demo
 *      starts correct, no editing), Haber in the pool on no weekend for the
 *      owner to switch on, EVERY GRADE PLACED in a booked building weekend by
 *      weekend (unitVenues — the column the planner board draws its coloured
 *      grade boxes from, and the deck's slide 4 photographs), far-team
 *      requests + a pending withdrawal seeded. Zero games.
 *   4  Game day — completed games with stats and standings, referees
 *      assigned, one game queued live for scoring.
 */
import bcrypt from "bcryptjs"
import { prisma } from "@youthbasketballhub/db"
import { NPH_CENSUS, type NphCensusEntry } from "./data/nph-census"
import { EMAIL_DOMAIN, JOURNEY_SLUG_PREFIX, MARKER, PASSWORD } from "./demo-shared"

const p = prisma as any
const days = (n: number) => n * 24 * 3600_000

// ── Deterministic bits ──────────────────────────────────────────────────
let rndState = 20260801
const rnd = () => {
  rndState = (rndState * 1103515245 + 12345) % 2147483648
  return rndState / 2147483648
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]

const BOY_NAMES = ["Aiden", "Marcus", "Jalen", "Owen", "Theo", "Malik", "Devin", "Noah", "Isaiah", "Cole", "Darius", "Evan", "Kadeem", "Lucas", "Micah", "Nate", "Quincy", "Rohan", "Sami", "Tristan", "Zion", "Andre", "Blake", "Cameron"]
const GIRL_NAMES = ["Aaliyah", "Brianna", "Chloe", "Danielle", "Emma", "Faith", "Grace", "Hannah", "Imani", "Jade", "Keisha", "Lena", "Maya", "Nia", "Olivia", "Priya", "Renee", "Sasha", "Tia", "Zara"]
const LAST_NAMES = ["Ali", "Bennett", "Chen", "Diallo", "Evans", "Fofana", "Grant", "Hughes", "Ibrahim", "Jackson", "Kelly", "Lam", "Mensah", "Nguyen", "Okafor", "Persaud", "Quinn", "Robinson", "Singh", "Thomas", "Umar", "Vieira", "Walker", "Young", "Zhang", "Osei", "Baptiste", "Cruz"]
const ADULT_NAMES = ["Andre", "Bianca", "Carlos", "Dawn", "Errol", "Farah", "Glen", "Hodan", "Ivan", "Jasmine", "Kwame", "Leila", "Marco", "Nadia", "Omar", "Paula", "Quentin", "Rosa", "Stefan", "Tanya"]

// ── Real venues (docs/research/nph-operations-intel-2026-08.md) ─────────
// THREE main gyms only (owner 2026-08-01: "everything happens in our GTA —
// Six Park, the Playground, and Haber"; no Ottawa/Quebec satellites).
const JOURNEY_VENUES = [
  { key: "sixpark", name: "Six Park East", address: "1000 Thornton Rd S", city: "Oshawa", zipCode: "L1J 7E2", courts: 6 },
  { key: "playground", name: "The Playground Burlington", address: "952 Century Dr", city: "Burlington", zipCode: "L7L 5P2", courts: 3 },
  // courts per owner's Google-review reading 2026-08-03, UNCONFIRMED — verify
  // with the facility before any pitch.
  { key: "haber", name: "Haber Recreation Centre", address: "3040 Tim Dobbie Dr", city: "Burlington", zipCode: "L7M 0M3", courts: 6 },
]

// What each building IS to NPH (venue model v2, owner ruling 2026-08-03: fill
// order is dead, a gym is either yours or rented):
//   The Playground Burlington — NPH-managed, their own morning programming
//     runs there. The HOME gym: games in it cost nothing and it fills first.
//   Six Park East — rented by the court-day, and a SHARED building (the
//     NJC/NSC circuits hold it six 2026-27 weekends). Pool.
//   Haber Recreation Centre — rented, zero NPH games in all of 2025-26 and a
//     Summer 2026 appearance only. Pool, and unattached until an operator says
//     they have it (see the pool-only note in buildSessions).
// Evidence: docs/research/nph-operations-intel-2026-08.md.
const VENUE_ROLE: Record<string, "home" | "pool"> = {
  playground: "home",
  sixpark: "pool",
  haber: "pool",
}

const SL_LEAGUE = "NPH Showcase League"
const SL_SEASON = "Fall/Winter 2026-27"
const D1_LEAGUE = "NPH D1 League"
const NPA_LEAGUE = "NPA"
const WNPA_LEAGUE = "WNPA"
export const JOURNEY_LEAGUES = [SL_LEAGUE, D1_LEAGUE, NPA_LEAGUE, WNPA_LEAGUE]

// SL weekends (Sat/Sun) mirror NPH's REAL per-grade calendar (owner
// 2026-08-01: "the dates are different for different age groups"): 14
// weekends Oct→Feb, each grade playing exactly FIVE of them on its own
// track (Gr9 opens Oct 24; Gr10/11 the Nov 1 track; Gr12 its own; etc.),
// 2 games per playing weekend → the 10-game guarantee.
const SL_TRACKS: Array<{ sat: string; grades: string[] }> = [
  // OFFICIAL 2026-27 boys calendar (owner-supplied NPH graphic, 2026-08-01).
  // Our census world fields Gr7-12 (+ JrGirls, whose girls calendar isn't on
  // the boys slide — mapped to her 2025-26 pattern's nearest weekends).
  // The real season also adds Gr5/Gr6 — not in the 2025-26 census, noted.
  { sat: "2026-10-24", grades: ["Gr7", "Gr8", "Gr9", "Gr11", "JrGirls"] },
  { sat: "2026-10-31", grades: ["Gr10", "Gr12"] },
  { sat: "2026-11-14", grades: ["Gr7"] },
  { sat: "2026-11-21", grades: ["Gr8", "Gr9", "Gr10", "JrGirls"] },
  { sat: "2026-11-28", grades: ["Gr11", "Gr12"] },
  { sat: "2026-12-12", grades: ["Gr8", "Gr11", "Gr12"] },
  { sat: "2026-12-19", grades: ["Gr7", "Gr9", "Gr10"] },
  { sat: "2027-01-09", grades: ["Gr7", "Gr9", "JrGirls"] },
  { sat: "2027-01-16", grades: ["Gr10"] },
  { sat: "2027-01-30", grades: ["Gr8", "Gr11", "Gr12", "JrGirls"] },
  { sat: "2027-02-06", grades: ["Gr9", "JrGirls"] },
  { sat: "2027-02-13", grades: ["Gr7", "Gr8", "Gr10"] },
  { sat: "2027-02-20", grades: ["Gr11", "Gr12"] },
]

// Finals weekends (official graphic): Tier 2 all grades Feb 27-28; Tier 1
// split Mar 6-7 (Gr5/7/9/10) and Mar 13-14 (Gr6/8/11/12). Seeded as
// PLAYOFF-phase sessions — regular scheduling never touches them.
const SL_FINALS: Array<{ sat: string; label: string }> = [
  { sat: "2027-02-27", label: "Tier 2 Finals · Feb 27-28" },
  { sat: "2027-03-06", label: "Tier 1 Finals · Mar 6-7 (Gr7, Gr9, Gr10)" },
  { sat: "2027-03-13", label: "Tier 1 Finals · Mar 13-14 (Gr8, Gr11, Gr12)" },
]
const D1_WEEKENDS = ["2026-11-14", "2026-12-12", "2027-01-16", "2027-02-13", "2027-03-13"]
const PREP_WEEKENDS = ["2026-11-21", "2027-01-23", "2027-02-27"]

// Weekends Six Park East is NOT ours (owner ruling 2026-08-02): the NJC and
// NSC circuits have the building on these six 2026-27 Saturdays. Pre-marked
// from real knowledge so the plan wizard tells the truth on day one — the
// operator can still take any of them back with one tap on the grid. The
// Playground gets nothing: it is NPH-managed, so the season always has it.
export const SIXPARK_TAKEN_SATS = [
  "2026-10-17",
  "2026-11-14",
  "2026-12-12",
  "2027-01-16",
  "2027-02-13",
  "2027-03-13",
]
export const SIXPARK_TAKEN_REASON = "Taken: NJC/NSC"

// Far teams (real Ottawa/Gatineau-region clubs) for the requests beat.
const FAR_REQUEST_CLUBS = ["Ottawa Elite (incl. Prep)", "Capital Courts", "Dragons de Gatineau"]
const WITHDRAWAL_CLUB = "Orillia Lakers"

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48)

const gradeGender = (division: string): "MALE" | "FEMALE" =>
  /girls/i.test(division) ? "FEMALE" : "MALE"

const birthYearFor = (division: string): number => {
  const m = /Gr(\d+)/.exec(division)
  if (m) return 2026 - (Number(m[1]) + 5) // Gr7≈12yo … Gr12≈17yo
  if (/junior/i.test(division)) return 2010
  return 2009
}

/** Division display name, composed the way the console does. */
const divisionName = (e: NphCensusEntry): string => {
  if (e.league === "SL") {
    // One division per grade (design 2026-08-09): divisions do not exist
    // until the operator CREATES them at scheduling time. The conference
    // still flavors duplicate team names, never the division.
    return e.division.startsWith("Gr") ? `Grade ${e.division.slice(2)} Boys` : "Junior Girls"
  }
  if (e.league === "D1") return e.division
  return "National"
}

const baseTeamName = (e: NphCensusEntry): string =>
  e.teamLabel && !e.teamLabel.includes(e.club) ? `${e.club} ${e.teamLabel}` : (e.teamLabel ?? e.club)

/**
 * Unique display names: a club fielding two teams in the SAME grade
 * (Burloak Elite Gr9 in PRIME and ARETE) gets the conference appended —
 * which is how NPH's own standings disambiguate them.
 */
function buildTeamNames(entries: NphCensusEntry[]): Map<NphCensusEntry, string> {
  const names = new Map<NphCensusEntry, string>()
  const groups = new Map<string, NphCensusEntry[]>()
  for (const e of entries) {
    const k = `${e.club}|${e.league}|${e.division}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(e)
  }
  const used = new Set<string>()
  for (const [, group] of groups) {
    for (const e of group) {
      let name = baseTeamName(e)
      if (group.length > 1 || used.has(`${e.club}|${name}|${e.division}`)) {
        name = e.conference ? `${name} (${e.conference})` : `${name} ${group.indexOf(e) + 1}`
      }
      let candidate = name
      let n = 2
      while (used.has(`${e.club}|${candidate}|${e.division}`)) candidate = `${name} ${n++}`
      used.add(`${e.club}|${candidate}|${e.division}`)
      names.set(e, candidate)
    }
  }
  return names
}

/** Big-grade entries the census left conference-less get balanced into the
 *  thinnest conference of their grade (deterministic). */
function withBalancedConferences(entries: NphCensusEntry[]): NphCensusEntry[] {
  const out = entries.map((e) => ({ ...e }))
  const bigGrades = ["Gr9", "Gr10", "Gr11", "Gr12"]
  for (const grade of bigGrades) {
    const inGrade = out.filter((e) => e.league === "SL" && e.division === grade)
    const counts = new Map<string, number>()
    for (const c of ["ARETE", "DMV CHILL", "GAME SPEAKS", "PRIME"]) counts.set(c, 0)
    for (const e of inGrade) if (e.conference) counts.set(e.conference, (counts.get(e.conference) ?? 0) + 1)
    for (const e of inGrade) {
      if (e.conference) continue
      const thinnest = [...counts.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0][0]
      e.conference = thinnest
      counts.set(thinnest, counts.get(thinnest)! + 1)
    }
  }
  return out
}

// ── demo state (PlatformSettings.demoState) ─────────────────────────────
export async function readDemoState(): Promise<{ scenario: string; stage: number } | null> {
  const row = await p.platformSettings.findUnique({ where: { id: "default" }, select: { demoState: true } })
  return (row?.demoState as any) ?? null
}
async function writeDemoState(scenario: string, stage: number) {
  await p.platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default", enabledCountries: ["CA", "US"], demoState: { scenario, stage, loadedAt: new Date().toISOString() } },
    update: { demoState: { scenario, stage, loadedAt: new Date().toISOString() } },
  })
}

// ── shared lookups (used by stages 2/3 against a stage-1 world) ─────────
async function journeyLeague(name: string) {
  const league = await p.league.findFirst({ where: { name }, select: { id: true, ownerId: true } })
  if (!league) throw new Error(`Journey league missing: ${name} — load stage 1 first`)
  return league
}
async function journeySeason(leagueName: string) {
  const league = await journeyLeague(leagueName)
  const season = await p.season.findFirst({
    where: { leagueId: league.id },
    select: { id: true, leagueId: true },
    orderBy: { createdAt: "desc" },
  })
  if (!season) throw new Error(`Journey season missing for ${leagueName}`)
  return { ...season, ownerId: league.ownerId }
}

// ═════════════════════════ STAGE 1 ═════════════════════════════════════
export async function seedJourneyStage1() {
  const now = new Date()
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const entries = withBalancedConferences(NPH_CENSUS)
  const nameByEntry = buildTeamNames(entries)

  const mkUser = (email: string, firstName: string, lastName: string, extra: any = {}) =>
    p.user.create({
      data: { email, passwordHash, firstName, lastName, phoneNumber: "416-555-0142", onboardedAt: new Date(), city: "Toronto", state: "ON", ...extra },
      select: { id: true },
    })

  // Core logins
  const admin = await mkUser(`admin@${EMAIL_DOMAIN}`, "Avery", "Admin")
  await p.userRole.create({ data: { userId: admin.id, role: "PlatformAdmin" } })
  const nph = await mkUser(`owner-nph@${EMAIL_DOMAIN}`, "Nathan", "Hoops")
  console.log("✓ admin + owner-nph")

  // Org (same identity as the pitch world)
  let org = await p.organization.findFirst({ where: { slug: "north-pole-hoops" }, select: { id: true } })
  if (!org) {
    org = await p.organization.create({
      data: {
        slug: "north-pole-hoops",
        name: "North Pole Hoops",
        tagline: "Youth Pathway to the Next Level",
        primaryColor: "#d7282f",
        seasonDefaults: {
          gamesGuaranteed: 10,
          idealGamesPerDayPerTeam: 2,
          defaultWeekendStyle: "SAME_DAY",
          gameSlotMinutes: 90,
          gameLengthMinutes: 80,
        },
      },
      select: { id: true },
    })
  }

  // Venues (global find-or-create; courts per the REAL buildings)
  const venueByKey = new Map<string, { id: string; courtIds: string[] }>()
  for (const v of JOURNEY_VENUES) {
    let venue = await p.venue.findFirst({ where: { name: v.name }, select: { id: true } })
    if (!venue) {
      venue = await p.venue.create({
        data: { name: v.name, address: v.address, city: v.city, zipCode: v.zipCode, state: v.city === "Longueuil" ? "QC" : "ON", country: "CA" },
        select: { id: true },
      })
    }
    const courtIds: string[] = []
    for (let c = 1; c <= v.courts; c++) {
      let court = await p.court.findFirst({ where: { venueId: venue.id, name: `Court ${c}` }, select: { id: true } })
      if (!court) court = await p.court.create({ data: { venueId: venue.id, name: `Court ${c}`, displayOrder: c }, select: { id: true } })
      courtIds.push(court.id)
    }
    venueByKey.set(v.key, { id: venue.id, courtIds })
    // Posted hours = the building's REAL Google listing (owner 2026-08-02:
    // never assume hours). Both run to midnight; the platform's time format
    // tops out at 23:59, which costs no game slot. Haber has no verified
    // listing, so it gets none rather than an invented one.
    const posted =
      v.key === "playground"
        ? Array.from({ length: 7 }, (_, dow) => ({ dow, open: "08:00", close: "23:59" }))
        : v.key === "sixpark"
          ? [0, 6]
              .map((dow) => ({ dow, open: "08:00", close: "23:59" }))
              .concat([1, 2, 3, 4, 5].map((dow) => ({ dow, open: "16:00", close: "23:59" })))
          : []
    for (const h of posted) {
      await p.venueHours.upsert({
        where: { venueId_dayOfWeek: { venueId: venue.id, dayOfWeek: h.dow } },
        create: { venueId: venue.id, dayOfWeek: h.dow, openTime: h.open, closeTime: h.close },
        update: { openTime: h.open, closeTime: h.close },
      })
    }
  }
  console.log(
    `✓ ${JOURNEY_VENUES.length} real venues (Six Park 6 courts, Playground 3, Haber 6 — unconfirmed; Google hours posted)`
  )

  // Clubs: one tenant per census club (adopt-or-create). Demo logins only
  // for the clubs the pitch script drives.
  const clubs = [...new Set(entries.map((e) => e.club))]
  const DEMO_CLUB_LOGINS: Record<string, string> = {
    "Royal Crown": "owner-royalcrown",
    "Ottawa Elite (incl. Prep)": "owner-ottawaelite",
  }
  const tenantByClub = new Map<string, { id: string; ownerId: string | null; parentId: string }>()
  let clubSeq = 0
  for (const club of clubs) {
    clubSeq++
    let tenant = await p.tenant.findFirst({ where: { name: club }, select: { id: true } })
    if (!tenant) {
      tenant = await p.tenant.create({
        data: {
          slug: `${JOURNEY_SLUG_PREFIX}${slugify(club)}`,
          name: club,
          status: "ACTIVE",
          city: "Toronto",
          state: "ON",
          country: "CA",
          currency: "CAD",
          timezone: "America/Toronto",
        },
        select: { id: true },
      })
    } else {
      await p.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE" } })
    }
    let ownerId: string | null = null
    if (DEMO_CLUB_LOGINS[club]) {
      const owner = await mkUser(`${DEMO_CLUB_LOGINS[club]}@${EMAIL_DOMAIN}`, pick(ADULT_NAMES), pick(LAST_NAMES))
      await p.userRole.create({ data: { userId: owner.id, role: "ClubOwner", tenantId: tenant.id } })
      ownerId = owner.id
    }
    // One synthetic guardian per club carries the fictional rosters.
    const parent = await mkUser(`guardian-${String(clubSeq).padStart(3, "0")}@${EMAIL_DOMAIN}`, pick(ADULT_NAMES), pick(LAST_NAMES))
    await p.userRole.create({ data: { userId: parent.id, role: "Parent" } })
    tenantByClub.set(club, { id: tenant.id, ownerId, parentId: parent.id })
  }
  console.log(`✓ ${clubs.length} club tenants (real names)`)

  // Leagues + seasons + divisions
  const mkLeague = async (name: string, description: string) => {
    const league = await p.league.create({
      data: { name, description, ownerId: nph.id, statDepth: "STANDARD", periodType: "QUARTERS", organizationId: org.id },
      select: { id: true },
    })
    await p.userRole.create({ data: { userId: nph.id, role: "LeagueOwner", leagueId: league.id } })
    return league
  }
  const mkSeason = (leagueId: string, label: string, status: string, guarantee: number) =>
    p.season.create({
      data: {
        leagueId,
        label,
        status,
        type: "FALL_WINTER",
        startDate: new Date("2026-11-01T00:00:00Z"),
        endDate: new Date("2027-03-31T00:00:00Z"),
        gamesGuaranteed: guarantee,
        defaultWeekendStyle: "SAME_DAY",
        // 10 to 10 (owner 2026-08-02): no youth game finishes after 10 PM.
        defaultVenueOpenTime: "10:00",
        defaultVenueCloseTime: "22:00",
        teamFee: 3950,
        rosterChangePolicy: "REQUEST_ONLY",
      },
      select: { id: true },
    })

  /**
   * A season's gyms and the weekends they are on.
   *
   * `venueKeys` are attached to every weekend. `poolOnlyKeys` join the season's
   * POOL and are attached to nothing (venue model v2, owner 2026-08-03): a
   * rented gym's weekend availability is operator knowledge, so the seed never
   * pretends to know the league has it — the operator turns the weekends on.
   */
  const buildSessions = async (
    seasonId: string,
    weekends: string[],
    venueKeys: string[],
    courtsPerVenue: Record<string, number> | null,
    targetGamesPerTeam: number,
    poolOnlyKeys: string[] = []
  ) => {
    for (const key of [...venueKeys, ...poolOnlyKeys]) {
      const v = venueByKey.get(key)!
      const courtsAvailable = courtsPerVenue?.[key] ?? v.courtIds.length
      await p.seasonVenue.upsert({
        where: { seasonId_venueId: { seasonId, venueId: v.id } },
        create: { seasonId, venueId: v.id, courtsAvailable, role: VENUE_ROLE[key] ?? "pool" },
        update: { role: VENUE_ROLE[key] ?? "pool" },
      })
    }
    let i = 0
    for (const sat of weekends) {
      i++
      const session = await p.seasonSession.create({
        data: { seasonId, label: `Session ${i}`, phase: "REGULAR", targetGamesPerTeam },
        select: { id: true },
      })
      for (const offset of [0, 1]) {
        // LOCAL midnight, no Z (QA T-015, same law as runbook #81): a
        // UTC-midnight day row under TZ=America/Toronto reads a day early
        // and lands engine slots on the wrong local day.
        const date = new Date(`${sat}T00:00:00`)
        date.setDate(date.getDate() + offset)
        const day = await p.seasonSessionDay.create({ data: { sessionId: session.id, date }, select: { id: true } })
        for (const key of venueKeys) {
          const v = venueByKey.get(key)!
          const useCourts = v.courtIds.slice(0, courtsPerVenue?.[key] ?? v.courtIds.length)
          const dayVenue = await p.seasonSessionDayVenue.create({
            // A seeded weekend is a booking the league HAS, not one a solver
            // guessed at (venue model v2) — so it says so.
            data: {
              dayId: day.id,
              venueId: v.id,
              startTime: "10:00",
              endTime: "22:00",
              bookingStatus: "confirmed",
            },
            select: { id: true },
          })
          let order = 0
          for (const courtId of useCourts) {
            await p.seasonSessionDayVenueCourt.create({ data: { dayVenueId: dayVenue.id, courtId, order: order++ } })
          }
        }
      }
    }
  }

  // Division rows per league from the census
  const mkDivisions = async (seasonId: string, league: NphCensusEntry["league"]) => {
    const forLeague = entries.filter((e) => e.league === league)
    const names = [...new Set(forLeague.map((e) => divisionName(e)))]
    const map = new Map<string, string>()
    for (const name of names.sort()) {
      const div = await p.division.create({
        data: {
          seasonId,
          name,
          ageGroup: /Grade (\d+)/.exec(name)?.[0] ?? name,
          gender: /girls/i.test(name) ? "FEMALE" : "MALE",
          /**
           * THE OPERATOR'S ESTIMATE — and the ONLY number the planner runs on
           * (owner ruling 2026-08-02: registration counts deliberately do not
           * drive planning until real scheduling). A null here leaves the
           * grade with teams: 0 and included: false, so the board excludes
           * every grade, every weekend reads 0 games and the calendar draws as
           * an empty grid. That is what made the deck's planning slide
           * photograph blank.
           *
           * The census count is exactly what NPH would have typed on step 1,
           * so the estimate and the eventual registration agree.
           */
          expectedTeams: forLeague.filter((e) => divisionName(e) === name).length,
        },
        select: { id: true },
      })
      map.set(name, div.id)
    }
    return map
  }

  // Teams + fictional rosters for EVERY census entry (so live submissions
  // work from stage 1 — the club picks an existing team).
  const mkTeamWithRoster = async (e: NphCensusEntry) => {
    const t = tenantByClub.get(e.club)!
    const gender = gradeGender(e.division)
    const nameList = gender === "FEMALE" ? GIRL_NAMES : BOY_NAMES
    const team = await p.team.create({
      data: {
        tenantId: t.id,
        name: nameByEntry.get(e)!,
        ageGroup: /Gr(\d+)/.test(e.division) ? `Grade ${/Gr(\d+)/.exec(e.division)![1]}` : e.division,
        gender,
        season: SL_SEASON,
        description: MARKER,
      },
      select: { id: true },
    })
    const jerseys = new Set<number>()
    for (let i = 0; i < 9; i++) {
      const player = await p.player.create({
        data: {
          firstName: pick(nameList),
          lastName: pick(LAST_NAMES),
          dateOfBirth: new Date(Date.UTC(birthYearFor(e.division), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28))),
          gender,
          isMinor: true,
          parentId: t.parentId,
          position: pick(["Guard", "Guard", "Forward", "Forward", "Center"]),
          mediaConsent: "UNSET",
        },
        select: { id: true },
      })
      let jersey = 1 + Math.floor(rnd() * 44)
      while (jerseys.has(jersey)) jersey++
      jerseys.add(jersey)
      await p.teamPlayer.create({ data: { teamId: team.id, playerId: player.id, jerseyNumber: jersey, status: "ACTIVE" } })
    }
    return team
  }

  const submitTeam = async (
    seasonId: string,
    divisionId: string,
    teamId: string,
    status: "PENDING" | "APPROVED" | "REJECTED",
    lockRoster: boolean
  ) => {
    const submission = await p.teamSubmission.create({
      data: {
        seasonId,
        divisionId,
        teamId,
        status,
        paymentStatus: status === "APPROVED" ? "PAID_MANUAL" : "UNPAID",
      },
      select: { id: true },
    })
    const rosterRows = await p.teamPlayer.findMany({ where: { teamId }, select: { playerId: true, jerseyNumber: true } })
    await p.seasonRoster.create({
      data: {
        seasonId,
        teamSubmissionId: submission.id,
        isLocked: lockRoster,
        submittedAt: new Date(now.getTime() - days(10)),
        lockedAt: lockRoster ? new Date(now.getTime() - days(9)) : null,
        players: { create: rosterRows.map((r: any) => ({ playerId: r.playerId, jerseyNumber: r.jerseyNumber })) },
      },
    })
    return submission
  }

  // ── D1 / NPA / WNPA: fully approved + schedule-ready ──
  const d1League = await mkLeague(D1_LEAGUE, "NPH's development circuit — Junior/Senior Girls, Junior Boys, Scholastic and Academy divisions.")
  const d1Season = await mkSeason(d1League.id, SL_SEASON, "FINALIZED", 10)
  const d1Divs = await mkDivisions(d1Season.id, "D1")
  // Haber is in D1's pool but on none of its weekends — nobody has booked it.
  await buildSessions(d1Season.id, D1_WEEKENDS, ["playground"], null, 2, ["haber"])

  const npaLeague = await mkLeague(NPA_LEAGUE, "National Prep Association — Canada's national prep circuit.")
  const npaSeason = await mkSeason(npaLeague.id, "Season 8", "FINALIZED", 6)
  const npaDivs = await mkDivisions(npaSeason.id, "NPA")
  // NPA plays its prep weekends at Six Park, which NPH rents — so this season
  // deliberately has no home gym, and step 2 saying so is the truth about it.
  await buildSessions(npaSeason.id, PREP_WEEKENDS, ["sixpark"], { sixpark: 3 }, 2)

  const wnpaLeague = await mkLeague(WNPA_LEAGUE, "Women's National Prep Association — Season 3.")
  const wnpaSeason = await mkSeason(wnpaLeague.id, "Season 3", "FINALIZED", 6)
  const wnpaDivs = await mkDivisions(wnpaSeason.id, "WNPA")
  await buildSessions(wnpaSeason.id, PREP_WEEKENDS, ["playground"], null, 2)

  const teamIdByEntry = new Map<NphCensusEntry, string>()
  for (const e of entries) {
    const team = await mkTeamWithRoster(e)
    teamIdByEntry.set(e, team.id)
    if (e.league === "D1") await submitTeam(d1Season.id, d1Divs.get(divisionName(e))!, team.id, "APPROVED", true)
    if (e.league === "NPA") await submitTeam(npaSeason.id, npaDivs.get(divisionName(e))!, team.id, "APPROVED", true)
    if (e.league === "WNPA") await submitTeam(wnpaSeason.id, wnpaDivs.get(divisionName(e))!, team.id, "APPROVED", true)
  }
  console.log("✓ D1 (60) + NPA (14) + WNPA (10) fully approved, sessions + venues ready")

  // ── Showcase League: mid-registration ──
  const slLeague = await mkLeague(SL_LEAGUE, "NPH's flagship grade-based circuit: ARETE, DMV CHILL, GAME SPEAKS and PRIME conferences, Grade 7 through 12 plus Junior Girls.")
  const slSeason = await mkSeason(slLeague.id, SL_SEASON, "REGISTRATION", 10)
  const slDivs = await mkDivisions(slSeason.id, "SL")
  // Division ids per grade → unit keys for each weekend's allow-list.
  const gradeOfDivName = (name: string): string =>
    name.startsWith("Junior Girls") ? "JrGirls" : `Gr${/Grade (\d+)/.exec(name)?.[1] ?? "?"}`
  const unitKeysForGrades = (grades: string[]): string[] =>
    [...slDivs.entries()]
      .filter(([name]) => grades.includes(gradeOfDivName(name)))
      .map(([, id]) => `division:${id}`)
  // Sessions carry their grade tracks from day one; venues attach at
  // stage 3 (both gyms at full strength, 10:00-22:00 — owner 2026-08-02).
  for (const [i, track] of SL_TRACKS.entries()) {
    const label = new Date(`${track.sat}T12:00:00Z`).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    const session = await p.seasonSession.create({
      data: {
        seasonId: slSeason.id,
        label: `Weekend ${i + 1} · ${label} (${track.grades.join(", ")})`,
        phase: "REGULAR",
        targetGamesPerTeam: 2,
        unitKeys: unitKeysForGrades(track.grades),
      },
      select: { id: true },
    })
    for (const offset of [0, 1]) {
      // LOCAL midnight, no Z (QA T-015): see the session-day law above.
      const date = new Date(`${track.sat}T00:00:00`)
      date.setDate(date.getDate() + offset)
      await p.seasonSessionDay.create({ data: { sessionId: session.id, date } })
    }
  }
  for (const fin of SL_FINALS) {
    const session = await p.seasonSession.create({
      data: { seasonId: slSeason.id, label: fin.label, phase: "PLAYOFF" },
      select: { id: true },
    })
    for (const offset of [0, 1]) {
      // LOCAL midnight, no Z (QA T-015): see the session-day law above.
      const date = new Date(`${fin.sat}T00:00:00`)
      date.setDate(date.getDate() + offset)
      await p.seasonSessionDay.create({ data: { sessionId: session.id, date } })
    }
  }

  // The demo FAMILY (run-sheet beats 9-14): a coach and a parent with a
  // named kid on Royal Crown's Grade 10 PRIME team — the second-screen
  // logins that watch the schedule publish, notifications, and stat cards.
  const rcEntry = entries.find(
    (e) => e.club === "Royal Crown" && e.league === "SL" && e.division === "Gr10"
  )
  if (rcEntry) {
    const rcTeamId = teamIdByEntry.get(rcEntry)!
    const coach = await mkUser(`coach-journey@${EMAIL_DOMAIN}`, "Coreen", "Baptiste")
    await p.userRole.create({
      data: { userId: coach.id, role: "Staff", teamId: rcTeamId, designation: "HeadCoach" },
    })
    const parent = await mkUser(`parent-journey@${EMAIL_DOMAIN}`, "Priya", "Reyes")
    await p.userRole.create({ data: { userId: parent.id, role: "Parent" } })
    const kid = await p.player.create({
      data: {
        firstName: "Jordan",
        lastName: "Reyes",
        dateOfBirth: new Date(Date.UTC(2011, 3, 14)),
        gender: "MALE",
        isMinor: true,
        parentId: parent.id,
        position: "Guard",
        mediaConsent: "GRANTED",
      },
      select: { id: true },
    })
    await p.teamPlayer.create({
      data: { teamId: rcTeamId, playerId: kid.id, jerseyNumber: 7, status: "ACTIVE" },
    })
    console.log("✓ demo family: coach-journey@ + parent-journey@ (Jordan Reyes #7, Royal Crown Gr10 PRIME)")
  }

  // ~25 of 146 submitted: every Gr7 club (12) + a spread of Gr9/Gr10 —
  // statuses mixed so the approvals screen has work to show.
  const slEntries = entries.filter((e) => e.league === "SL")
  const early = [
    ...slEntries.filter((e) => e.division === "Gr7"),
    ...slEntries.filter((e) => e.division === "Gr9").slice(0, 7),
    ...slEntries.filter((e) => e.division === "Gr10").slice(0, 6),
  ]
  // Flagship clubs are never shown rejected (owner 2026-08-01: "Royal
  // Crown is one of the top clubs"); Royal Crown's entries land APPROVED.
  const NEVER_REJECT = new Set([
    "Royal Crown",
    "Ottawa Elite (incl. Prep)",
    "Dragons de Gatineau",
    "Capital Courts",
    "Orillia Lakers",
  ])
  let k = 0
  for (const e of early) {
    k++
    let status = k % 5 === 0 ? "PENDING" : k % 11 === 0 ? "REJECTED" : "APPROVED"
    if (e.club === "Royal Crown") status = "APPROVED"
    else if (status === "REJECTED" && NEVER_REJECT.has(e.club)) status = "APPROVED"
    await submitTeam(slSeason.id, slDivs.get(divisionName(e))!, teamIdByEntry.get(e)!, status as any, status === "APPROVED")
  }
  console.log(`✓ Showcase League mid-registration: ${early.length} of ${slEntries.length} submitted`)

  await writeDemoState("nph-pitch-journey", 1)
  console.log("✓ journey stage 1 complete")
}

// ═════════════════════════ STAGE 2 ═════════════════════════════════════
export async function seedJourneyStage2() {
  const season = await journeySeason(SL_LEAGUE)
  const allEntries = withBalancedConferences(NPH_CENSUS)
  const nameByEntry = buildTeamNames(allEntries)
  const entries = allEntries.filter((e) => e.league === "SL")
  const divisions = await p.division.findMany({ where: { seasonId: season.id }, select: { id: true, name: true } })
  const divByName = new Map<string, string>(divisions.map((d: any) => [d.name, d.id]))

  let added = 0
  for (const e of entries) {
    const tenant = await p.tenant.findFirst({ where: { name: e.club }, select: { id: true } })
    if (!tenant) continue
    const team = await p.team.findFirst({
      // ageGroup disambiguates: a club fielding Gr7 AND Gr11 has two teams
      // both named plain "<Club>" — name alone matched the wrong one and
      // silently skipped 30+ entries.
      where: {
        tenantId: tenant.id,
        name: nameByEntry.get(e)!,
        ageGroup: /Gr(\d+)/.test(e.division) ? `Grade ${/Gr(\d+)/.exec(e.division)![1]}` : e.division,
        season: SL_SEASON,
      },
      select: { id: true },
    })
    if (!team) continue
    const existing = await p.teamSubmission.findFirst({
      where: { seasonId: season.id, teamId: team.id },
      select: { id: true },
    })
    if (existing) continue // live demo actions + stage-1 rows survive
    const submission = await p.teamSubmission.create({
      data: { seasonId: season.id, divisionId: divByName.get(divisionName(e)), teamId: team.id, status: "PENDING", paymentStatus: "UNPAID" },
      select: { id: true },
    })
    const rosterRows = await p.teamPlayer.findMany({ where: { teamId: team.id }, select: { playerId: true, jerseyNumber: true } })
    await p.seasonRoster.create({
      data: {
        seasonId: season.id,
        teamSubmissionId: submission.id,
        isLocked: false,
        submittedAt: new Date(),
        players: { create: rosterRows.map((r: any) => ({ playerId: r.playerId, jerseyNumber: r.jerseyNumber })) },
      },
    })
    added++
  }
  await writeDemoState("nph-pitch-journey", 2)
  console.log(`✓ journey stage 2: ${added} additional submissions (everyone's in)`)
}

// ══════════════ Six Park's NJC/NSC weekends (owner 2026-08-02) ══════════
export interface NjcDefaultsReport {
  /** Saturdays that now carry a mark (new ones listed in `created`). */
  marked: string[]
  created: string[]
  /** Saturdays where the gym was actually released off the calendar. */
  detached: string[]
  /** Saturdays that kept the gym because a game is already scheduled. */
  blocked: string[]
}

/**
 * Six Park East is not ours on six 2026-27 weekends. Marking one is only
 * half the job: a weekend the season already wired the gym onto has to be
 * released too, or the grid would read "on" and the mark would be invisible.
 * A weekend with games on it is never yanked out from under them — it is
 * reported instead, the same way a one-weekend release behaves.
 *
 * Idempotent by construction: the mark upserts, and the release skips a
 * weekend the gym is already off.
 */
export async function applyNjcDefaults(seasonId: string): Promise<NjcDefaultsReport> {
  const { markVenueUnavailable, detachVenueFromSession } = await import(
    "../apps/web/src/lib/seasons/venue-propagation"
  )
  const report: NjcDefaultsReport = { marked: [], created: [], detached: [], blocked: [] }
  const sixpark = await p.venue.findFirst({
    where: { name: "Six Park East" },
    select: { id: true },
  })
  if (!sixpark) return report

  for (const sat of SIXPARK_TAKEN_SATS) {
    const satDate = new Date(`${sat}T00:00:00Z`)
    const mark = await markVenueUnavailable(seasonId, sixpark.id, satDate, SIXPARK_TAKEN_REASON)
    if (!mark) continue
    report.marked.push(sat)
    if (mark.created) report.created.push(sat)

    // Every session sitting on that weekend (Sat or Sun) lets the gym go.
    const monday = new Date(satDate.getTime() + days(2))
    const sessions = await p.seasonSession.findMany({
      where: { seasonId, days: { some: { date: { gte: satDate, lt: monday } } } },
      select: { id: true },
    })
    for (const session of sessions) {
      const res = await detachVenueFromSession(seasonId, session.id, sixpark.id)
      if (res.gamesBlocking > 0) {
        if (!report.blocked.includes(sat)) report.blocked.push(sat)
      } else if (res.daysReleased > 0 && !report.detached.includes(sat)) {
        report.detached.push(sat)
      }
    }
  }
  return report
}

// ═════════════════════════ STAGE 3 ═════════════════════════════════════
/**
 * WHICH BUILDING EACH GRADE PLAYS IN, weekend by weekend.
 *
 * The sessions have carried their grade tracks since stage 1 (unitKeys). This
 * is the other half of the same calendar: SeasonSession.unitVenues, the column
 * the planner board draws its coloured grade boxes from and the one
 * ensureImportedPlan() snapshots into the season's reference plan. Leave it
 * null and the board renders its structure with every cell saying "No gym on
 * this date yet" — which is exactly how the deck's slide 4 photographed empty.
 *
 * The rule is the one an operator uses, not a hand-tuned map:
 *   · only buildings actually booked on that weekend are candidates, so the six
 *     weekends the NJC/NSC circuits hold Six Park place everything in the
 *     Playground on their own;
 *   · the grade with the most teams is placed first;
 *   · each grade lands in whichever building has the most room left PER COURT,
 *     which keeps Grade 10's 42 teams out of the three-court gym.
 *
 * Deterministic: gyms are ordered by courts then id, and grade ties break on
 * the unit key, so a reseed places every grade in the same building.
 */
async function placeGradesInGyms(seasonId: string) {
  const grouped = await p.teamSubmission.groupBy({
    by: ["divisionId"],
    where: { seasonId, status: "APPROVED" },
    _count: { _all: true },
  })
  const teamsIn = new Map<string, number>()
  for (const g of grouped) if (g.divisionId) teamsIn.set(g.divisionId, g._count._all)

  const seasonVenues = await p.seasonVenue.findMany({
    where: { seasonId },
    select: { venueId: true, courtsAvailable: true },
  })
  const courtsAt = new Map<string, number>()
  for (const sv of seasonVenues) courtsAt.set(sv.venueId, Math.max(1, sv.courtsAvailable ?? 1))

  const sessions = await p.seasonSession.findMany({
    where: { seasonId, phase: "REGULAR" },
    select: {
      id: true,
      unitKeys: true,
      days: { select: { dayVenues: { select: { venueId: true } } } },
    },
  })

  let placements = 0
  let weekends = 0
  for (const s of sessions) {
    const units: string[] = (s.unitKeys ?? []).filter((k: string) => k.startsWith("division:"))
    if (units.length === 0) continue

    // Only what is BOOKED on this weekend — after the NJC/NSC releases.
    const gyms = [
      ...new Set<string>(
        s.days.flatMap((d: any) => d.dayVenues.map((dv: any) => dv.venueId as string))
      ),
    ].sort((a, b) => (courtsAt.get(b) ?? 1) - (courtsAt.get(a) ?? 1) || (a < b ? -1 : 1))
    if (gyms.length === 0) continue

    const load = new Map<string, number>(gyms.map((id) => [id, 0]))
    const ordered = [...units].sort((a, b) => {
      const ta = teamsIn.get(a.slice(9)) ?? 0
      const tb = teamsIn.get(b.slice(9)) ?? 0
      return tb - ta || (a < b ? -1 : 1)
    })

    const unitVenues: Record<string, string> = {}
    for (const key of ordered) {
      const teams = teamsIn.get(key.slice(9)) ?? 0
      const best = gyms.reduce((a, b) =>
        (load.get(b)! + teams) / courtsAt.get(b)! < (load.get(a)! + teams) / courtsAt.get(a)! ? b : a
      )
      unitVenues[key] = best
      load.set(best, load.get(best)! + teams)
      placements++
    }
    await p.seasonSession.update({ where: { id: s.id }, data: { unitVenues } })
    weekends++
  }
  return { placements, weekends }
}

export async function seedJourneyStage3() {
  const season = await journeySeason(SL_LEAGUE)

  // Approve everything still pending; settle fees.
  const updated = await p.teamSubmission.updateMany({
    where: { seasonId: season.id, status: "PENDING" },
    data: { status: "APPROVED", paymentStatus: "PAID_MANUAL" },
  })
  await p.seasonRoster.updateMany({
    where: { seasonId: season.id, isLocked: false },
    data: { isLocked: true, lockedAt: new Date() },
  })

  // The two gyms the season HAS are on every weekend at full strength,
  // 10:00-22:00 (owner 2026-08-02: "by default I shouldn't have to edit it" —
  // the old one-court-short beat is retired). Roles are venue model v2 (owner
  // 2026-08-03): the Playground is the home gym, so its weekends cost nothing;
  // Six Park is rented by the court-day.
  //
  // Haber joins the POOL and is on NO weekend. A rented gym's weekend
  // availability is the operator's knowledge, never the seed's — so the row is
  // there for the owner to switch on for the short weekends himself, and until
  // he does, the season is honest that nobody has booked it.
  const gyms = [
    { name: "Six Park East", courts: 6, role: "pool", weekends: true },
    { name: "The Playground Burlington", courts: 3, role: "home", weekends: true },
    { name: "Haber Recreation Centre", courts: 6, role: "pool", weekends: false },
  ]
  const daysRows = await p.seasonSessionDay.findMany({
    where: { session: { seasonId: season.id } },
    select: { id: true, dayVenues: { select: { id: true, venueId: true } } },
  })
  for (const gym of gyms) {
    const venue = await p.venue.findFirst({ where: { name: gym.name }, select: { id: true } })
    await p.seasonVenue.upsert({
      where: { seasonId_venueId: { seasonId: season.id, venueId: venue.id } },
      create: {
        seasonId: season.id,
        venueId: venue.id,
        courtsAvailable: gym.courts,
        role: gym.role,
      },
      update: { courtsAvailable: gym.courts, role: gym.role },
    })
    if (!gym.weekends) continue
    const courts = await p.court.findMany({
      where: { venueId: venue.id },
      orderBy: { displayOrder: "asc" },
      take: gym.courts,
      select: { id: true },
    })
    for (const day of daysRows) {
      if (day.dayVenues.some((dv: any) => dv.venueId === venue.id)) continue // idempotent
      const dayVenue = await p.seasonSessionDayVenue.create({
        // Seeded weekends are bookings the league has, not a solver's guess.
        data: {
          dayId: day.id,
          venueId: venue.id,
          startTime: "10:00",
          endTime: "22:00",
          bookingStatus: "confirmed",
        },
        select: { id: true },
      })
      let order = 0
      for (const c of courts) {
        await p.seasonSessionDayVenueCourt.create({ data: { dayVenueId: dayVenue.id, courtId: c.id, order: order++ } })
      }
    }
  }

  // ...except the six weekends the NJC/NSC circuits have the building: those
  // are marked with the reason and released again, so step 2 says WHY rather
  // than showing a weekend nobody got to yet.
  const njc = await applyNjcDefaults(season.id)
  console.log(
    `✓ Six Park unavailable on ${njc.marked.length} NJC/NSC weekends (${njc.detached.length} released${
      njc.blocked.length > 0 ? `, ${njc.blocked.length} kept — games already scheduled` : ""
    })`
  )

  /**
   * THE BACKUP GYM, ON THE WEEKENDS THE MAIN ONE IS GONE.
   *
   * Six Park is released on the six weekends the NJC/NSC circuits hold it,
   * which leaves those dates with nothing but the Playground's three courts —
   * 48 slots against grades that need far more. The board drew them red, and
   * four red weekends is not a plan a league would ever publish. It is also
   * not the story: the owner's own scheduling demo shows ONE weekend under
   * pressure and then the fix (docs/roadmap/season-story-numbers.md, the
   * 2026-08-16 deltas — "no ambush; the tension lives on the board").
   *
   * So the league does what a league does when its building is taken: it books
   * the backup. Haber joins exactly the weekends Six Park left, and nothing
   * else — it stays off every other date, which is what makes it visibly a
   * rental rather than a third home.
   */
  const haber = await p.venue.findFirst({
    where: { name: "Haber Recreation Centre" },
    select: { id: true },
  })
  let haberWeekends = 0
  if (haber && njc.detached.length > 0) {
    const haberCourts = await p.court.findMany({
      where: { venueId: haber.id },
      orderBy: { displayOrder: "asc" },
      take: 6,
      select: { id: true },
    })
    for (const sat of njc.detached) {
      const satDate = new Date(`${sat}T00:00:00Z`)
      const monday = new Date(satDate.getTime() + days(2))
      const dayRows = await p.seasonSessionDay.findMany({
        where: { session: { seasonId: season.id }, date: { gte: satDate, lt: monday } },
        select: { id: true, dayVenues: { select: { venueId: true } } },
      })
      for (const day of dayRows) {
        if (day.dayVenues.some((dv: any) => dv.venueId === haber.id)) continue
        const dayVenue = await p.seasonSessionDayVenue.create({
          data: {
            dayId: day.id,
            venueId: haber.id,
            startTime: "10:00",
            endTime: "22:00",
            bookingStatus: "confirmed",
          },
          select: { id: true },
        })
        let order = 0
        for (const c of haberCourts) {
          await p.seasonSessionDayVenueCourt.create({
            data: { dayVenueId: dayVenue.id, courtId: c.id, order: order++ },
          })
        }
      }
      haberWeekends++
    }
    console.log(`✓ Haber booked on the ${haberWeekends} weekends Six Park was released`)
  }

  // Now that the weekends know which buildings they actually have, place each
  // grade in one of them. This is what the planner board photographs.
  const board = await placeGradesInGyms(season.id)
  console.log(
    `✓ grades placed in buildings: ${board.placements} across ${board.weekends} weekends`
  )

  // League finalized — schedule creation is the live act.
  await p.season.update({ where: { id: season.id }, data: { status: "FINALIZED" } })

  // Far-team requests (real Ottawa-region clubs): 2 approved + 1 pending.
  const nphOwnerId = season.ownerId
  const reqSpecs = [
    { club: FAR_REQUEST_CLUBS[0], kind: "WINDOW", status: "APPROVED", dayOfWeek: 0, latestStart: "12:00", reason: "Driving back to Ottawa — we need to leave by early Sunday afternoon." },
    { club: FAR_REQUEST_CLUBS[1], kind: "WINDOW", status: "APPROVED", dayOfWeek: 6, earliestStart: "11:00", reason: "Coming in from Ottawa Saturday morning — we can't make an early tip." },
    { club: FAR_REQUEST_CLUBS[2], kind: "WINDOW", status: "PENDING", dayOfWeek: 0, latestStart: "12:30", reason: "Gatineau drive home — early Sunday games please." },
  ]
  for (const spec of reqSpecs) {
    const sub = await p.teamSubmission.findFirst({
      where: { seasonId: season.id, team: { tenant: { name: spec.club } } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    if (!sub) continue
    await p.teamSubmission.update({ where: { id: sub.id }, data: { scheduleRequestsEnabled: true } })
    await p.teamScheduleRequest.create({
      data: {
        submissionId: sub.id,
        kind: spec.kind,
        status: spec.status,
        dayOfWeek: spec.dayOfWeek,
        earliestStart: (spec as any).earliestStart ?? null,
        latestStart: (spec as any).latestStart ?? null,
        reason: spec.reason,
        requestedById: nphOwnerId,
        ...(spec.status === "APPROVED"
          ? { decidedById: nphOwnerId, decidedAt: new Date(), decisionNote: "Approved — best effort, never guaranteed." }
          : {}),
      },
    })
  }

  // A pending withdrawal (fuel for the drop-out beat, decided live AFTER
  // the schedule is committed).
  const wSub = await p.teamSubmission.findFirst({
    where: { seasonId: season.id, team: { tenant: { name: WITHDRAWAL_CLUB } } },
    select: { id: true },
  })
  if (wSub) {
    await p.withdrawalRequest.create({
      data: {
        type: "CLUB_FROM_LEAGUE",
        status: "PENDING",
        reason: "Not enough committed players to travel this winter — we have to pull out.",
        requestedById: nphOwnerId,
        submissionId: wSub.id,
      },
    })
  }

  await writeDemoState("nph-pitch-journey", 3)
  console.log(
    `✓ journey stage 3: ${updated.count} approvals finalized · Playground (home) + Six Park (pool) full strength 10:00-22:00 · Haber booked on ${haberWeekends} released weekends · ${board.placements} grade placements on ${board.weekends} weekends · requests + withdrawal staged`
  )
}

// ═════════════════════════ STAGE 4 ═════════════════════════════════════
/**
 * Game day: several completed weekends with scores + player stats, a
 * referee assigned to today's slate, one game queued for the LIVE scoring
 * demo. Self-sufficient: if the owner never committed a schedule live, it
 * adds Six Park Court 6 (the capacity fix) and commits one itself.
 */
export async function seedJourneyStage4() {
  const season = await journeySeason(SL_LEAGUE)
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  let games = await p.game.findMany({
    where: { seasonId: season.id, phase: "REGULAR" },
    select: { id: true, homeTeamId: true, awayTeamId: true, scheduledAt: true },
    orderBy: { scheduledAt: "asc" },
  })
  if (games.length === 0) {
    // Live commit never happened — do the capacity fix + commit ourselves.
    const sixpark = await p.venue.findFirst({ where: { name: "Six Park East" }, select: { id: true } })
    const court6 = await p.court.findFirst({
      where: { venueId: sixpark.id, name: "Court 6" },
      select: { id: true },
    })
    const dayVenues = await p.seasonSessionDayVenue.findMany({
      where: { venueId: sixpark.id, day: { session: { seasonId: season.id } } },
      select: { id: true, courts: { select: { courtId: true } } },
    })
    for (const dv of dayVenues) {
      if (dv.courts.some((c: any) => c.courtId === court6.id)) continue
      await p.seasonSessionDayVenueCourt.create({
        data: { dayVenueId: dv.id, courtId: court6.id, order: 5 },
      })
    }
    /**
     * THE SAME SOLVER THE OWNER'S OWN BUTTON RUNS. "Generate" on the plan
     * wizard is api/seasons/[id]/plans/[planId]/generate, and it calls
     * solveSeasonV2 + applyProposal — the v2 engine with the burden ledger,
     * which spreads a team's games, keeps them out of back-to-backs and off
     * five-hour waits, and fills every team's game count.
     *
     * This used to call the v1 generateSchedule, and the difference is the
     * whole fairness table: v1 left 23 teams under the 10-game guarantee and
     * handed out back-to-backs, so the seeded world scored far worse than
     * anything the owner produces by hand. A demo world must be at least as
     * good as the product, never worse.
     */
    const { solveSeasonV2, applyProposal } = await import("../apps/web/src/lib/scheduler-v2")
    const solved = await solveSeasonV2(season.id)
    if (solved.errors.length > 0) {
      throw new Error(`stage 4: solver refused — ${solved.errors.join(" · ")}`)
    }
    const blocks = solved.findings.filter((f: any) => f.severity === "BLOCK")
    if (blocks.length > 0 || !solved.proposal) {
      throw new Error(
        `stage 4: solver blocked — ${blocks.map((b: any) => b.message).join(" · ") || "no proposal"}`
      )
    }
    await applyProposal(season.id, solved.proposal)
    // Seeded games are the live demo world, not drafts.
    await p.game.updateMany({
      where: { seasonId: season.id, phase: "REGULAR", publishedAt: null },
      data: { publishedAt: new Date() },
    })
    games = await p.game.findMany({
      where: { seasonId: season.id, phase: "REGULAR" },
      select: { id: true, homeTeamId: true, awayTeamId: true, scheduledAt: true },
      orderBy: { scheduledAt: "asc" },
    })
    console.log(
      `  · committed ${games.length} games via scheduler-v2 (Court 6 added) · ` +
        `back-to-backs ${solved.proposal.stats.backToBacks ?? "?"}`
    )
  }

  // Complete the first two weekends with scores + player stat lines.
  const byDate = new Map<string, any[]>()
  for (const g of games) {
    const dk = new Date(g.scheduledAt).toISOString().slice(0, 10)
    if (!byDate.has(dk)) byDate.set(dk, [])
    byDate.get(dk)!.push(g)
  }
  const dates = [...byDate.keys()].sort()
  const completeDates = dates.slice(0, 4) // two weekends
  let completed = 0
  for (const dk of completeDates) {
    for (const g of byDate.get(dk)!) {
      const homeScore = 45 + Math.floor(rnd() * 40)
      let awayScore = 45 + Math.floor(rnd() * 40)
      if (awayScore === homeScore) awayScore++
      await p.game.update({
        where: { id: g.id },
        data: { status: "COMPLETED", homeScore, awayScore },
      })
      for (const teamId of [g.homeTeamId, g.awayTeamId]) {
        const teamScore = teamId === g.homeTeamId ? homeScore : awayScore
        const roster = await p.teamPlayer.findMany({
          where: { teamId, status: "ACTIVE" },
          select: { playerId: true },
          take: 8,
        })
        let remaining = teamScore
        for (let i = 0; i < roster.length; i++) {
          const share = i === roster.length - 1 ? remaining : Math.min(remaining, Math.floor(rnd() * 16))
          remaining -= share
          // PlayerStat is keyed (gameId, playerId) and holds NO teamId — the
          // team comes from the player's roster row. Passing one made every
          // insert throw into the swallowed catch below, which is how this
          // stage reported "games with stats" while writing none.
          await p.playerStat
            .create({
              data: {
                gameId: g.id,
                playerId: roster[i].playerId,
                points: share,
                rebounds: Math.floor(rnd() * 8),
                assists: Math.floor(rnd() * 6),
                steals: Math.floor(rnd() * 3),
                blocks: Math.floor(rnd() * 2),
              },
            })
            // A re-run hits the (gameId, playerId) unique and that is fine;
            // anything else is a real fault and must not be swallowed again.
            .catch((e: any) => {
              if (e?.code !== "P2002") throw e
            })
          if (remaining <= 0 && i < roster.length - 1) remaining = 0
        }
      }
      completed++
    }
  }

  // Referee: ref-mike@ assigned to the NEXT upcoming slate + the live game.
  let ref = await p.user.findFirst({ where: { email: `ref-mike@${EMAIL_DOMAIN}` }, select: { id: true } })
  if (!ref) {
    ref = await p.user.create({
      data: {
        email: `ref-mike@${EMAIL_DOMAIN}`,
        passwordHash,
        firstName: "Mike",
        lastName: "Whistler",
        phoneNumber: "416-555-0142",
        onboardedAt: new Date(),
        city: "Toronto",
        state: "ON",
      },
      select: { id: true },
    })
    await p.userRole.create({ data: { userId: ref.id, role: "Referee" } })
    // Same shape the everyday seeder uses: PIN 1234 is hashed into
    // signoffPinHash (there is no `pin` column), and standardFee is required.
    await p.refereeProfile.create({
      data: {
        userId: ref.id,
        certificationLevel: "Level 2",
        availableRegions: ["Ontario"],
        standardFee: 45,
        gamesRefereed: 38,
        signoffPinHash: await bcrypt.hash("1234", 10),
      },
    })
  }
  const upcoming = games.filter((g: any) => !completeDates.includes(new Date(g.scheduledAt).toISOString().slice(0, 10)))
  const slate = upcoming.slice(0, 6)
  for (const g of slate) {
    const existing = await p.userRole.findFirst({
      where: { userId: ref.id, role: "Referee", gameId: g.id },
      select: { id: true },
    })
    if (!existing) {
      await p.userRole.create({ data: { userId: ref.id, role: "Referee", gameId: g.id } })
    }
  }
  console.log(`✓ journey stage 4: ${completed} games completed with stats · ref assigned to ${slate.length} upcoming games`)
  await writeDemoState("nph-pitch-journey", 4)
}

export async function runJourneyStage(stage: number) {
  if (stage === 1) return seedJourneyStage1()
  const state = await readDemoState()
  if (!state || state.scenario !== "nph-pitch-journey") {
    throw new Error("Fast-forward needs the journey world loaded — run stage 1 first")
  }
  if (stage <= state.stage) {
    console.log(`✓ already at stage ${state.stage} — nothing to do`)
    return
  }
  for (let s = state.stage + 1; s <= stage; s++) {
    if (s === 2) await seedJourneyStage2()
    else if (s === 3) await seedJourneyStage3()
    else if (s === 4) await seedJourneyStage4()
    else throw new Error(`Unknown journey stage ${s}`)
  }
}
