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
 *   3  Ready to schedule — all approved, fees settled, league FINALIZED,
 *      venues attached ONE COURT SHORT on purpose (Six Park 5 of 6),
 *      far-team requests + a pending withdrawal seeded. Zero games.
 *   4  Game day — (wave 4, not yet implemented).
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
const JOURNEY_VENUES = [
  { key: "sixpark", name: "Six Park East", address: "1000 Thornton Rd S", city: "Oshawa", zipCode: "L1J 7E2", courts: 6 },
  { key: "playground", name: "The Playground Burlington", address: "952 Century Dr", city: "Burlington", zipCode: "L7L 5P2", courts: 3 },
  { key: "haber", name: "Haber Recreation Centre", address: "3040 Tim Dobbie Dr", city: "Burlington", zipCode: "L7M 0M3", courts: 2 },
  { key: "carleton", name: "Carleton University Raven's Nest", address: "1125 Colonel By Dr", city: "Ottawa", zipCode: "K1S 5B6", courts: 2 },
  { key: "lisgar", name: "Lisgar Collegiate Institute", address: "29 Lisgar St", city: "Ottawa", zipCode: "K2P 0B9", courts: 1 },
  { key: "turner", name: "Turner Fenton Secondary School", address: "7935 Kennedy Rd S", city: "Brampton", zipCode: "L6W 4T5", courts: 2 },
  { key: "ndl", name: "Complexe NDL", address: "820 Rue Marie-Victorin", city: "Longueuil", zipCode: "J4G 1A9", courts: 2 },
]

const SL_LEAGUE = "NPH Showcase League"
const SL_SEASON = "Fall/Winter 2026-27"
const D1_LEAGUE = "NPH D1 League"
const NPA_LEAGUE = "NPA"
const WNPA_LEAGUE = "WNPA"
export const JOURNEY_LEAGUES = [SL_LEAGUE, D1_LEAGUE, NPA_LEAGUE, WNPA_LEAGUE]

// SL weekends (Sat/Sun), Nov 2026 → Mar 2027; D1 alternates weekends.
const SL_WEEKENDS = ["2026-11-07", "2026-12-05", "2027-01-09", "2027-02-06", "2027-03-06"]
const D1_WEEKENDS = ["2026-11-14", "2026-12-12", "2027-01-16", "2027-02-13", "2027-03-13"]
const PREP_WEEKENDS = ["2026-11-21", "2027-01-23", "2027-02-27"]

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
    const grade = e.division.startsWith("Gr")
      ? `Grade ${e.division.slice(2)} Boys`
      : "Junior Girls"
    return e.conference ? `${grade} · ${e.conference}` : grade
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
  }
  console.log(`✓ ${JOURNEY_VENUES.length} real venues (Six Park 6 courts, Playground 3, Haber 2 + satellites)`)

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
        defaultVenueOpenTime: "08:00",
        defaultVenueCloseTime: "20:00",
        teamFee: 3950,
        rosterChangePolicy: "REQUEST_ONLY",
      },
      select: { id: true },
    })

  const buildSessions = async (
    seasonId: string,
    weekends: string[],
    venueKeys: string[],
    courtsPerVenue: Record<string, number> | null,
    targetGamesPerTeam: number
  ) => {
    for (const key of venueKeys) {
      const v = venueByKey.get(key)!
      await p.seasonVenue.upsert({
        where: { seasonId_venueId: { seasonId, venueId: v.id } },
        create: { seasonId, venueId: v.id, courtsAvailable: courtsPerVenue?.[key] ?? v.courtIds.length },
        update: {},
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
        const date = new Date(`${sat}T00:00:00Z`)
        date.setUTCDate(date.getUTCDate() + offset)
        const day = await p.seasonSessionDay.create({ data: { sessionId: session.id, date }, select: { id: true } })
        for (const key of venueKeys) {
          const v = venueByKey.get(key)!
          const useCourts = v.courtIds.slice(0, courtsPerVenue?.[key] ?? v.courtIds.length)
          const dayVenue = await p.seasonSessionDayVenue.create({
            data: { dayId: day.id, venueId: v.id, startTime: "08:00", endTime: "20:00" },
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
    const names = [...new Set(entries.filter((e) => e.league === league).map((e) => divisionName(e)))]
    const map = new Map<string, string>()
    for (const name of names.sort()) {
      const div = await p.division.create({
        data: {
          seasonId,
          name,
          ageGroup: /Grade (\d+)/.exec(name)?.[0] ?? name,
          gender: /girls/i.test(name) ? "FEMALE" : "MALE",
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
  await buildSessions(d1Season.id, D1_WEEKENDS, ["playground", "haber"], null, 2)

  const npaLeague = await mkLeague(NPA_LEAGUE, "National Prep Association — Canada's national prep circuit.")
  const npaSeason = await mkSeason(npaLeague.id, "Season 8", "FINALIZED", 6)
  const npaDivs = await mkDivisions(npaSeason.id, "NPA")
  await buildSessions(npaSeason.id, PREP_WEEKENDS, ["carleton", "turner"], null, 2)

  const wnpaLeague = await mkLeague(WNPA_LEAGUE, "Women's National Prep Association — Season 3.")
  const wnpaSeason = await mkSeason(wnpaLeague.id, "Season 3", "FINALIZED", 6)
  const wnpaDivs = await mkDivisions(wnpaSeason.id, "WNPA")
  await buildSessions(wnpaSeason.id, PREP_WEEKENDS, ["ndl", "lisgar"], null, 2)

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
  const slLeague = await mkLeague(SL_LEAGUE, "NPH's flagship grade-based circuit — ARETE, DMV CHILL, GAME SPEAKS and PRIME conferences, Grade 7 through 12 plus Junior Girls.")
  const slSeason = await mkSeason(slLeague.id, SL_SEASON, "REGISTRATION", 10)
  const slDivs = await mkDivisions(slSeason.id, "SL")
  // Sessions exist from day one; venues attach at stage 3 (one court short).
  let si = 0
  for (const sat of SL_WEEKENDS) {
    si++
    const session = await p.seasonSession.create({
      data: { seasonId: slSeason.id, label: `Session ${si}`, phase: "REGULAR", targetGamesPerTeam: 2 },
      select: { id: true },
    })
    for (const offset of [0, 1]) {
      const date = new Date(`${sat}T00:00:00Z`)
      date.setUTCDate(date.getUTCDate() + offset)
      await p.seasonSessionDay.create({ data: { sessionId: session.id, date } })
    }
  }

  // ~25 of 146 submitted: every Gr7 club (12) + a spread of Gr9/Gr10 —
  // statuses mixed so the approvals screen has work to show.
  const slEntries = entries.filter((e) => e.league === "SL")
  const early = [
    ...slEntries.filter((e) => e.division === "Gr7"),
    ...slEntries.filter((e) => e.division === "Gr9").slice(0, 7),
    ...slEntries.filter((e) => e.division === "Gr10").slice(0, 6),
  ]
  let k = 0
  for (const e of early) {
    k++
    const status = k % 5 === 0 ? "PENDING" : k % 11 === 0 ? "REJECTED" : "APPROVED"
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

// ═════════════════════════ STAGE 3 ═════════════════════════════════════
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

  // Attach venues ONE COURT SHORT (Six Park 5 of 6 + Playground 3): the
  // whole-season run FAILS with the actionable capacity message until the
  // owner adds Court 6 live. Haber stays unattached (an "add a venue" out).
  const sixpark = await p.venue.findFirst({ where: { name: "Six Park East" }, select: { id: true } })
  const playground = await p.venue.findFirst({ where: { name: "The Playground Burlington" }, select: { id: true } })
  for (const v of [sixpark, playground]) {
    await p.seasonVenue.upsert({
      where: { seasonId_venueId: { seasonId: season.id, venueId: v.id } },
      create: { seasonId: season.id, venueId: v.id, courtsAvailable: v.id === sixpark.id ? 5 : 3 },
      update: {},
    })
  }
  const courtRows = async (venueId: string, take: number) =>
    p.court.findMany({ where: { venueId }, orderBy: { displayOrder: "asc" }, take, select: { id: true } })
  const sixCourts = await courtRows(sixpark.id, 5)
  const pgCourts = await courtRows(playground.id, 3)
  const daysRows = await p.seasonSessionDay.findMany({
    where: { session: { seasonId: season.id } },
    select: { id: true, dayVenues: { select: { id: true } } },
  })
  for (const day of daysRows) {
    if (day.dayVenues.length > 0) continue // already attached (idempotent)
    for (const [venue, courts] of [
      [sixpark, sixCourts],
      [playground, pgCourts],
    ] as const) {
      const dayVenue = await p.seasonSessionDayVenue.create({
        data: { dayId: day.id, venueId: venue.id, startTime: "08:00", endTime: "20:00" },
        select: { id: true },
      })
      let order = 0
      for (const c of courts) {
        await p.seasonSessionDayVenueCourt.create({ data: { dayVenueId: dayVenue.id, courtId: c.id, order: order++ } })
      }
    }
  }

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
  console.log(`✓ journey stage 3: ${updated.count} approvals finalized · venues one court short · requests + withdrawal staged`)
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
    const { loadSchedulerInput } = await import("../apps/web/src/lib/scheduler/load")
    const { generateSchedule } = await import("../apps/web/src/lib/scheduler/generate")
    const { input } = await loadSchedulerInput(season.id)
    if (!input) throw new Error("stage 4: cannot load scheduler input")
    const result = generateSchedule(input)
    for (const g of result.games) {
      await p.game.create({
        data: {
          seasonId: season.id,
          sessionId: g.sessionId,
          dayVenueId: g.dayVenueId,
          homeTeamId: g.homeTeamId,
          awayTeamId: g.awayTeamId,
          venueId: g.venueId,
          courtId: g.courtId,
          scheduledAt: new Date(g.scheduledAt),
          duration: g.duration,
          status: "SCHEDULED",
          phase: "REGULAR",
          publishedAt: new Date(),
        },
      })
    }
    games = await p.game.findMany({
      where: { seasonId: season.id, phase: "REGULAR" },
      select: { id: true, homeTeamId: true, awayTeamId: true, scheduledAt: true },
      orderBy: { scheduledAt: "asc" },
    })
    console.log(`  · committed ${games.length} games (Court 6 added + schedule generated)`)
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
          await p.playerStat.create({
            data: {
              gameId: g.id,
              playerId: roster[i].playerId,
              teamId,
              points: share,
              rebounds: Math.floor(rnd() * 8),
              assists: Math.floor(rnd() * 6),
              steals: Math.floor(rnd() * 3),
              blocks: Math.floor(rnd() * 2),
            },
          }).catch(() => {})
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
    await p.refereeProfile.create({ data: { userId: ref.id, pin: "1234" } }).catch(() => {})
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
