/**
 * NATIONAL CIRCUIT SEEDER — the real NJC + NSC worlds as ONE playable demo
 * league, LOCAL ONLY. Additive to whatever demo world is loaded (journey
 * or pitch): it never touches the NPH Showcase League's data.
 *
 * MODEL (owner ruling 2026-08-11): the National Circuit is ONE league under
 * the NPH org; NJC and NSC are its AGE DIVISIONS, exactly like the
 * Showcase's grade groups. Two Division rows per season — name carries the
 * circuit branding ("Junior (NJC)"), ageGroup carries the short unit label
 * ("Junior") because the plan wizard/board build unit chips from ageGroup
 * (lib/scheduler/planner.ts: key `age:<ageGroup>`, label = ageGroup).
 * Earlier two-league staging is superseded; this seed deletes the legacy
 * "National Junior Circuit" / "National Senior Circuit" leagues if present.
 *
 * TWO SEASONS, mirroring the Showcase demo convention:
 *   - "Fall/Winter 2026-27" → PRE-SEASON AT THE PLANNING GATE (the Showcase
 *     upcoming season's state: REGISTRATION — FINALIZED/IN_PROGRESS lock
 *     the planner, lib/seasons/season-lock.ts — with planning fields
 *     cleared): all 83 teams approved + paid with locked rosters under
 *     their unit, NO sessions, NO season venues, NO games, NO saved plans.
 *     The owner opens Plan Your Season and both unit chips (Junior 51,
 *     Senior 32) are there at step 1.
 *   - "Fall/Winter 2025-26 (completed)" → END OF SEASON twin (the Showcase
 *     twin's "(completed)" label convention + IN_PROGRESS status): the full
 *     prior regular season for BOTH units on the circuits' REAL 2025-26
 *     Fri-Sun blocks at Six Park East (Oct 10-12, Nov 14-16, Dec 12-14,
 *     Jan 16-18, Feb 13-15; research doc), every game COMPLETED with
 *     deterministic prep-level scores (endseason-twin hash pattern, no
 *     ties), per-unit standings, the Mar 13-15 National Championship
 *     session present with zero games and playoffs unplanned so the
 *     Playoffs tab offers planning.
 *
 * Source data (do not invent teams):
 *   docs/research/census-njc-nsc-2025-26.md  — every real 2025-26 team entry
 *   docs/research/nph-operations-intel-2026-08.md — how the circuits run:
 *     one building (Six Park East, courts 1-6), shared Fri-Sun blocks,
 *     5 sessions + championship, FIBA 4x10, ~10-11 games per team.
 *
 * Idempotent: league/teams/tenants/players find-or-create; each run wipes
 * and rebuilds ONLY the National Circuit seasons' substrate + games.
 *
 * Run (arm64 node, the app's timezone — the engine sets slot times with
 * local setHours, so day rows are written as LOCAL-midnight instants):
 *   TZ=America/Toronto npx tsx scripts/seed-national-circuit.ts
 */
import bcrypt from "bcryptjs"
import { prisma } from "@youthbasketballhub/db"
import { loadSchedulerInput } from "../apps/web/src/lib/scheduler/load"
import { generateSchedule } from "../apps/web/src/lib/scheduler/generate"
import { EMAIL_DOMAIN, MARKER, PASSWORD } from "./demo-shared"

const p = prisma as any

// ── Deterministic RNG ───────────────────────────────────────────────────
let rndState = 20260811
const rnd = () => {
  rndState = (rndState * 1103515245 + 12345) % 2147483648
  return rndState / 2147483648
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]

const BOY_NAMES = ["Aiden", "Marcus", "Jalen", "Owen", "Theo", "Malik", "Devin", "Noah", "Isaiah", "Cole", "Darius", "Evan", "Kadeem", "Lucas", "Micah", "Nate", "Quincy", "Rohan", "Sami", "Tristan", "Zion", "Andre", "Blake", "Cameron", "Mateo", "Ibrahim", "Josiah", "Xavier"]
const LAST_NAMES = ["Ali", "Bennett", "Chen", "Diallo", "Evans", "Fofana", "Grant", "Hughes", "Ibrahim", "Jackson", "Kelly", "Lam", "Mensah", "Nguyen", "Okafor", "Persaud", "Quinn", "Robinson", "Singh", "Thomas", "Umar", "Vieira", "Walker", "Young", "Zhang", "Osei", "Baptiste", "Cruz", "Tremblay", "Gagnon", "Roy", "Cote"]
const ADULT_NAMES = ["Andre", "Bianca", "Carlos", "Dawn", "Errol", "Farah", "Glen", "Hodan", "Ivan", "Jasmine", "Kwame", "Leila", "Marco", "Nadia", "Omar", "Paula", "Quentin", "Rosa", "Stefan", "Tanya"]

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48)

const LEAGUE_NAME = "National Circuit"
const LEGACY_LEAGUE_NAMES = ["National Junior Circuit", "National Senior Circuit"]
const LEAGUE_DESCRIPTION =
  "National club circuit for prep programs. Junior (grades 9 and 10) and senior (grades 11 and 12) divisions play five weekend sessions plus a national championship at Six Park East in Oshawa."
const VENUE_NAME = "Six Park East"

/** "Session N · Oct 10-12" from the block's Saturday anchor. */
const sessionLabel = (sat: string, i: number): string => {
  const d = new Date(`${sat}T12:00:00Z`)
  const fri = new Date(d.getTime() - 86400_000)
  const sun = new Date(d.getTime() + 86400_000)
  const mon = fri.toLocaleDateString("en-CA", { month: "short", timeZone: "UTC" })
  return `Session ${i + 1} · ${mon} ${fri.getUTCDate()}-${sun.getUTCDate()}`
}
const championshipLabel = (sat: string): string => {
  const d = new Date(`${sat}T12:00:00Z`)
  const fri = new Date(d.getTime() - 86400_000)
  const sun = new Date(d.getTime() + 86400_000)
  const mon = fri.toLocaleDateString("en-CA", { month: "short", timeZone: "UTC" })
  return `National Championship · ${mon} ${fri.getUTCDate()}-${sun.getUTCDate()}`
}

// ── The two age units (the census's circuits) ───────────────────────────
interface UnitSpec {
  key: "NJC" | "NSC"
  /** ageGroup = the short unit chip ("Junior"), exactly like "Grade 9". */
  unit: "Junior" | "Senior"
  /** Division display name carries the circuit branding. */
  divisionName: string
  birthYears: number[]
}
const UNITS: UnitSpec[] = [
  { key: "NJC", unit: "Junior", divisionName: "Junior (NJC)", birthYears: [2011, 2012] },
  { key: "NSC", unit: "Senior", divisionName: "Senior (NSC)", birthYears: [2009, 2010] },
]

// ── The two seasons ─────────────────────────────────────────────────────
interface SeasonSpec {
  label: string
  stage: "PLANNING_GATE" | "END_OF_REGULAR"
  startDate: string
  endDate: string
  registrationDeadline: string
  /** Saturday anchors of the five Fri-Sun session blocks (END_OF_REGULAR). */
  sessionSats: string[]
  championshipSat: string
  rosterStamp: string // submittedAt for the season's rosters
}
const SEASONS: SeasonSpec[] = [
  {
    // The end-of-season twin FIRST so the gate season is the league's
    // newest (directory cards and "latest season" lookups pick it up).
    // Real 2025-26 blocks (ops-intel doc): all six at Six Park courts 1-6.
    label: "Fall/Winter 2025-26 (completed)",
    stage: "END_OF_REGULAR",
    startDate: "2025-10-10",
    endDate: "2026-03-15",
    registrationDeadline: "2025-10-01",
    sessionSats: ["2025-10-11", "2025-11-15", "2025-12-13", "2026-01-17", "2026-02-14"],
    championshipSat: "2026-03-14",
    rosterStamp: "2025-09-20",
  },
  {
    label: "Fall/Winter 2026-27",
    stage: "PLANNING_GATE",
    startDate: "2026-10-16",
    endDate: "2027-03-14",
    registrationDeadline: "2026-10-01",
    sessionSats: [],
    championshipSat: "",
    rosterStamp: "2026-09-20",
  },
]

// ── The census (docs/research/census-njc-nsc-2025-26.md, entry names
// verbatim; Simcoe United and Wiggins Elite entries carry the club prefix
// because their raw TeamLinkt labels are bare "Gr 9" / "G10 Prep A") ─────
interface CircuitClub {
  club: string
  aliases?: string[] // existing tenant names to adopt, tried in order
  city?: string
  state?: string
  njc?: string[]
  nsc?: string[]
}

const CLUBS: CircuitClub[] = [
  { club: "506 Elite Jr Academy", city: "Moncton", state: "NB", njc: ["506 Elite Jr Academy"] },
  { club: "Against The Six Prep", aliases: ["Against the Six"], city: "Toronto", njc: ["Against The Six Prep"] },
  { club: "Alpha Elite", city: "Mississauga", njc: ["Alpha Elite"] },
  { club: "Brampton City Prep", city: "Brampton", njc: ["BCP North", "BCP South"], nsc: ["BCP Regional"] },
  { club: "Brotherhood Elite", city: "Toronto", nsc: ["Brotherhood Elite"] },
  { club: "C.O.D.E Academy", city: "Whitby", njc: ["C.O.D.E Academy"] },
  { club: "Cali Prep", aliases: ["CALI Prep Academy"], city: "Pickering", njc: ["Cali Prep Red"], nsc: ["CALI Prep"] },
  { club: "Canada Topflight Academy", aliases: ["Canada Topflight Academy (CTA)"], city: "Ottawa", njc: ["Canada Topflight Academy"] },
  { club: "City Above Elite", city: "Toronto", njc: ["City Above Elite"] },
  { club: "CKATT", aliases: ["CKATT Basketball", "CKATT (Cooksville)"], city: "Mississauga", njc: ["CKATT 2010"] },
  { club: "Collective Elite Academy", city: "Brampton", njc: ["Collective Elite Academy"] },
  { club: "Compass Academy", njc: ["Compass Junior Academy"], nsc: ["Compass Senior Academy"] },
  { club: "Cooksville We>Me", aliases: ["Cooksville We>Me 2030"], city: "Mississauga", njc: ["Cooksville We>Me 2030"] },
  { club: "Dynamic Basketball", city: "Toronto", nsc: ["Dynamic Basketball"] },
  { club: "Eastern Basketball Academy", city: "Whitby", njc: ["Eastern Basketball Academy"] },
  { club: "Elton Academy", city: "Richmond Hill", nsc: ["Elton Academy"] },
  { club: "F.O.R.M. Basketball Academy", city: "Vancouver", state: "BC", nsc: ["F.O.R.M. Team Gold (National)"] },
  { club: "Full Circle Basketball Academy", city: "Courtice", njc: ["Full Circle Basketball Academy"], nsc: ["Full Circle Basketball Academy"] },
  { club: "Future Hope Academy", city: "Scarborough", njc: ["Future Hope Academy"] },
  { club: "G2S Game Changers", city: "North York", njc: ["G2S Game Changers"] },
  { club: "Gators Basketball Academy", city: "Markham", nsc: ["Gators Basketball Academy"] },
  { club: "GBU", city: "Newmarket", nsc: ["GBU"] },
  { club: "HQ Prep", aliases: ["HQ Elite"], city: "Hamilton", njc: ["HQ Prep Black", "HQ Prep Grey"] },
  { club: "Ignite Academy", njc: ["Ignite Academy"] },
  { club: "Jungle Prep", city: "Pickering", njc: ["Jungle Prep"], nsc: ["Jungle Prep (Regional)"] },
  { club: "Kings Court Academy", aliases: ["Kings Court Basketball"], city: "Hamilton", njc: ["Kings Court Academy"] },
  { club: "LBA", city: "London", njc: ["LBA JR Provincial"], nsc: ["LBA SR Provincial"] },
  { club: "London Ramblers", city: "London", njc: ["Ramblers Blue (U15/U16)", "Ramblers Red (U16)"] },
  { club: "M&R Basketball", city: "Markham", nsc: ["M&R Basketball"] },
  { club: "Mississauga Monarchs", aliases: ["Monarchs Basketball (Rep/AAU)"], city: "Mississauga", nsc: ["Monarchs"] },
  { club: "NSE Select Academy", njc: ["NSE Select Academy"] },
  { club: "ONL-X", aliases: ["ONL-X Basketball"], city: "Ottawa", njc: ["ONL-X Junior"], nsc: ["ONL-X RISE"] },
  { club: "Orangeville Prep", city: "Mono", nsc: ["Orangeville Prep Varsity"] },
  { club: "Project Excellence", city: "Scarborough", njc: ["Project excellence"], nsc: ["Project excellence"] },
  { club: "RSB Elite", city: "Toronto", njc: ["RSB Elite"] },
  { club: "RWI519", aliases: ["RWI", "RWI Basketball"], city: "London", njc: ["RWI519"] },
  { club: "SBA Premier", aliases: ["Scarborough Basketball Association (SBA)"], city: "Scarborough", njc: ["SBA Premier Blue"], nsc: ["SBA Premier"] },
  { club: "SC Academy Prep", aliases: ["SC Academy"], city: "Vaughan", njc: ["SC Academy Prep"], nsc: ["SC Academy Prep", "SC Academy Prep Black"] },
  { club: "SCI Spartans", njc: ["SCI Spartans"] },
  { club: "Simcoe United", aliases: ["Simcoe United Spartans"], city: "Barrie", njc: ["Simcoe United Gr 9", "Simcoe United Gr 10"], nsc: ["Simcoe United Gr 11", "Simcoe United Gr 12"] },
  { club: "SSF Blizzard", city: "Saint-Augustin-de-Desmaures", state: "QC", njc: ["SSF Blizzard", "SSF Blizzard White"], nsc: ["SSF Blizzard"] },
  { club: "Ste Cecile Academy", city: "Windsor", nsc: ["Ste Cecile Academy"] },
  { club: "Strive Hoops", city: "London", njc: ["Strive Hoops"] },
  { club: "Team Sanctuary", city: "Scarborough", njc: ["Team Sanctuary"] },
  { club: "Team Thetford", city: "Thetford Mines", state: "QC", nsc: ["Team Thetford"] },
  { club: "Top Left", njc: ["Top Left"] },
  { club: "Top Notch Prep", city: "Vaughan", njc: ["TNP JVR", "TNP Rusty"] },
  { club: "Toronto Lords", aliases: ["Toronto Lords Basketball"], city: "Toronto", nsc: ["Toronto Lords Senior Prep Academy"] },
  { club: "Tri-City Prep", aliases: ["Tri-City (Prep/Academy)", "Tri-City Basketball"], city: "Kitchener", njc: ["Tri-City Prep"] },
  { club: "Triple Balance", aliases: ["Triple Balance Academy"], city: "Scarborough", nsc: ["Triple Balance-Courtenay/Nick"] },
  { club: "Tru Balance", city: "Toronto", njc: ["Tru Balance"] },
  { club: "UEWB", city: "Toronto", njc: ["UEWB"] },
  { club: "Vanguard North", aliases: ["Vanguard North Prep"], city: "Vaughan", njc: ["Vanguard Junior Prep"], nsc: ["Vanguard North U17", "Vanguard North Sr Prep"] },
  { club: "Westfield Prep", aliases: ["Westfield Secondary"], city: "Toronto", njc: ["Westfield prep"], nsc: ["Westfield prep"] },
  { club: "Wiggins Elite", city: "Toronto", njc: ["Wiggins Elite G10 Prep A", "Wiggins Elite G10 Prep B"], nsc: ["Wiggins Elite G11 Prep"] },
  { club: "William Academy", aliases: ["William Prep"], city: "Toronto", njc: ["William Academy"] },
  { club: "Wolverines Elite", aliases: ["Waterloo Wolverines Elite", "Waterloo Wolverines"], city: "Kitchener", njc: ["Wolverines Elite"], nsc: ["Wolverines Elite Sr"] },
]

// ── Local-only rail: this seed NEVER runs against a remote database ─────
async function guardLocalOnly() {
  const url = process.env.DATABASE_URL || ""
  const host = url.match(/@([^/:]+)/)?.[1] ?? "localhost"
  const [{ current_database: db }] = (await p.$queryRaw`SELECT current_database()`) as any[]
  console.log(`Database: ${db} @ ${host}`)
  if (host !== "localhost" && host !== "127.0.0.1") {
    console.error("This seed is LOCAL ONLY. Refusing to touch a remote database.")
    process.exit(1)
  }
}

async function main() {
  await guardLocalOnly()
  const t0 = Date.now()
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  // The operator: owner-nph runs the circuit in this demo world.
  let nph = await p.user.findFirst({ where: { email: `owner-nph@${EMAIL_DOMAIN}` }, select: { id: true } })
  if (!nph) {
    nph = await p.user.create({
      data: { email: `owner-nph@${EMAIL_DOMAIN}`, passwordHash, firstName: "Nathan", lastName: "Hoops", phoneNumber: "416-555-0142", onboardedAt: new Date(), city: "Toronto", state: "ON" },
      select: { id: true },
    })
  }
  const org = await p.organization.findFirst({ where: { slug: "north-pole-hoops" }, select: { id: true } })

  // Six Park East — reuse the existing global venue row, 6 courts.
  let venue = await p.venue.findFirst({ where: { name: VENUE_NAME }, select: { id: true } })
  if (!venue) {
    venue = await p.venue.create({
      data: { name: VENUE_NAME, address: "1000 Thornton Rd S", city: "Oshawa", zipCode: "L1J 7E2", state: "ON", country: "CA" },
      select: { id: true },
    })
  }
  const courtIds: string[] = []
  for (let c = 1; c <= 6; c++) {
    let court = await p.court.findFirst({ where: { venueId: venue.id, name: `Court ${c}` }, select: { id: true } })
    if (!court) court = await p.court.create({ data: { venueId: venue.id, name: `Court ${c}`, displayOrder: c }, select: { id: true } })
    courtIds.push(court.id)
  }
  console.log(`✓ venue: ${VENUE_NAME} (courts 1-6)`)

  // Retire the superseded two-league model (owner ruling 2026-08-11):
  // the circuit is ONE league; NJC/NSC live on as its age divisions.
  for (const name of LEGACY_LEAGUE_NAMES) {
    const legacy = await p.league.findFirst({ where: { name }, select: { id: true } })
    if (!legacy) continue
    await p.game.deleteMany({ where: { season: { leagueId: legacy.id } } })
    await p.league.delete({ where: { id: legacy.id } }) // seasons + roles cascade
    console.log(`✓ retired legacy league: ${name}`)
  }

  // The ONE league.
  let league = await p.league.findFirst({ where: { name: LEAGUE_NAME }, select: { id: true } })
  if (!league) {
    league = await p.league.create({
      data: {
        name: LEAGUE_NAME,
        description: LEAGUE_DESCRIPTION,
        ownerId: nph.id,
        statDepth: "STANDARD",
        periodType: "QUARTERS",
        organizationId: org?.id ?? undefined,
      },
      select: { id: true },
    })
  } else {
    await p.league.update({
      where: { id: league.id },
      data: { description: LEAGUE_DESCRIPTION, ownerId: nph.id, organizationId: org?.id ?? undefined },
    })
  }
  const ownerRole = await p.userRole.findFirst({ where: { userId: nph.id, role: "LeagueOwner", leagueId: league.id }, select: { id: true } })
  if (!ownerRole) await p.userRole.create({ data: { userId: nph.id, role: "LeagueOwner", leagueId: league.id } })
  console.log(`✓ league: ${LEAGUE_NAME} (owner-nph, NPH org)`)

  // Clubs: adopt existing tenants by name (journey/import worlds already
  // carry many of these programs) or create; one guardian per club carries
  // the fictional rosters (owner ruling: real players are minors).
  const tenantByClub = new Map<string, { id: string; parentId: string }>()
  let clubSeq = 0
  for (const club of CLUBS) {
    clubSeq++
    let tenant: { id: string } | null = null
    for (const alias of [club.club, ...(club.aliases ?? [])]) {
      tenant = await p.tenant.findFirst({ where: { name: alias }, select: { id: true }, orderBy: { createdAt: "asc" } })
      if (tenant) break
    }
    if (!tenant) {
      tenant = await p.tenant.create({
        data: {
          slug: `njc-${slugify(club.club)}`,
          name: club.club,
          status: "ACTIVE",
          city: club.city ?? null,
          state: club.state ?? (club.city ? "ON" : null),
          country: "CA",
          currency: "CAD",
          timezone: "America/Toronto",
        },
        select: { id: true },
      })
    }
    const guardianEmail = `circuit-guardian-${String(clubSeq).padStart(2, "0")}@${EMAIL_DOMAIN}`
    let guardian = await p.user.findFirst({ where: { email: guardianEmail }, select: { id: true } })
    if (!guardian) {
      guardian = await p.user.create({
        data: { email: guardianEmail, passwordHash, firstName: pick(ADULT_NAMES), lastName: pick(LAST_NAMES), phoneNumber: "416-555-0142", onboardedAt: new Date(), city: club.city ?? "Toronto", state: club.state ?? "ON" },
        select: { id: true },
      })
      await p.userRole.create({ data: { userId: guardian.id, role: "Parent" } })
    }
    tenantByClub.set(club.club, { id: tenant.id, parentId: guardian.id })
  }
  console.log(`✓ ${CLUBS.length} club tenants resolved (adopted or created)`)

  // Teams (find-or-create, keyed tenant+name+ageGroup — one Team row per
  // census entry, shared by both seasons like the Showcase twin shares
  // clubs), with fictional rosters.
  const teamsByUnit = new Map<string, Array<{ id: string }>>()
  for (const spec of UNITS) {
    const rows: Array<{ id: string }> = []
    let teamSeq = 0
    for (const club of CLUBS) {
      const entries = (spec.key === "NJC" ? club.njc : club.nsc) ?? []
      if (entries.length === 0) continue
      const tenant = tenantByClub.get(club.club)!
      for (const entryName of entries) {
        let team = await p.team.findFirst({
          where: { tenantId: tenant.id, name: entryName, ageGroup: spec.unit },
          select: { id: true },
        })
        if (!team) {
          team = await p.team.create({
            data: { tenantId: tenant.id, name: entryName, ageGroup: spec.unit, gender: "MALE", season: "Fall/Winter 2026-27", description: MARKER },
            select: { id: true },
          })
        }
        const rosterCount = await p.teamPlayer.count({ where: { teamId: team.id } })
        if (rosterCount === 0) {
          const size = 10 + (teamSeq % 4) // 10-13, census average is ~12
          const jerseys = new Set<number>()
          for (let i = 0; i < size; i++) {
            const player = await p.player.create({
              data: {
                firstName: pick(BOY_NAMES),
                lastName: pick(LAST_NAMES),
                dateOfBirth: new Date(Date.UTC(pick(spec.birthYears), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28))),
                gender: "MALE",
                isMinor: true,
                parentId: tenant.parentId,
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
        }
        rows.push({ id: team.id })
        teamSeq++
      }
    }
    teamsByUnit.set(spec.unit, rows)
    console.log(`✓ ${spec.unit} (${spec.key}): ${rows.length} teams ready`)
  }

  const summary: Array<{ label: string; stage: string; seasonId: string; teams: number; games: number; weekends: number; perTeam: string }> = []

  for (const sspec of SEASONS) {
    // Season: reuse the row (stable URLs across re-runs), wipe ONLY this
    // season's substrate + games, rebuild.
    let season = await p.season.findFirst({ where: { leagueId: league.id, label: sspec.label }, select: { id: true } })
    if (season) {
      await p.game.deleteMany({ where: { seasonId: season.id } })
      await p.seasonRoster.deleteMany({ where: { seasonId: season.id } })
      await p.teamSubmission.deleteMany({ where: { seasonId: season.id } })
      await p.division.deleteMany({ where: { seasonId: season.id } })
      await p.seasonSession.deleteMany({ where: { seasonId: season.id } })
      await p.seasonVenue.deleteMany({ where: { seasonId: season.id } })
      await p.seasonPlan.deleteMany({ where: { seasonId: season.id } })
    }
    const seasonData = {
      label: sspec.label,
      // Gate = REGISTRATION, exactly like the Showcase upcoming season:
      // FINALIZED/IN_PROGRESS are LOCKED_SEASON_STATUSES and would 409 the
      // planner. End-of-season twin = IN_PROGRESS (the Showcase twin's
      // status, playoffs still to plan).
      status: sspec.stage === "PLANNING_GATE" ? "REGISTRATION" : "IN_PROGRESS",
      type: "FALL_WINTER",
      startDate: new Date(`${sspec.startDate}T00:00:00Z`),
      endDate: new Date(`${sspec.endDate}T00:00:00Z`),
      registrationDeadline: new Date(`${sspec.registrationDeadline}T00:00:00Z`),
      gamesGuaranteed: 10, // 2 per session across 5 sessions (the circuits' observed ~10-11)
      gameSlotMinutes: 90,
      gameLengthMinutes: 40, // FIBA 4x10 (research)
      gamePeriods: "QUARTERS",
      periodLengthMinutes: 10,
      defaultWeekendStyle: "SAME_DAY",
      defaultVenueOpenTime: "09:00",
      defaultVenueCloseTime: "18:00",
      teamFee: 5150, // all-in five sessions + championship (research pricing)
      rosterChangePolicy: "REQUEST_ONLY",
      // Nothing planned in either stage (collapse-preseason-divisions
      // clears the same three at the Showcase gate; the twin has not
      // planned playoffs, so its Playoffs tab must offer planning).
      gradeScheduling: {},
      playoffConfig: {},
      playoffPlan: null,
    }
    if (!season) {
      season = await p.season.create({ data: { leagueId: league.id, ...seasonData }, select: { id: true } })
    } else {
      await p.season.update({ where: { id: season.id }, data: seasonData })
    }

    // TWO age units, the Showcase grade-group mechanics: unit chip =
    // ageGroup, division name = branded label.
    let teamCount = 0
    for (const spec of UNITS) {
      const division = await p.division.create({
        data: { seasonId: season.id, name: spec.divisionName, ageGroup: spec.unit, gender: "MALE", tier: 1 },
        select: { id: true },
      })
      for (const team of teamsByUnit.get(spec.unit)!) {
        const submission = await p.teamSubmission.create({
          data: { seasonId: season.id, divisionId: division.id, teamId: team.id, status: "APPROVED", paymentStatus: "PAID_MANUAL" },
          select: { id: true },
        })
        const rosterRows = await p.teamPlayer.findMany({ where: { teamId: team.id }, select: { playerId: true, jerseyNumber: true } })
        await p.seasonRoster.create({
          data: {
            seasonId: season.id,
            teamSubmissionId: submission.id,
            isLocked: true,
            submittedAt: new Date(`${sspec.rosterStamp}T00:00:00Z`),
            lockedAt: new Date(`${sspec.rosterStamp}T00:00:00Z`),
            players: { create: rosterRows.map((r: any) => ({ playerId: r.playerId, jerseyNumber: r.jerseyNumber })) },
          },
        })
        teamCount++
      }
    }
    console.log(`✓ ${sspec.label}: ${teamCount} teams submitted + approved (both units)`)

    if (sspec.stage === "PLANNING_GATE") {
      const [g, s, v, pl] = await Promise.all([
        p.game.count({ where: { seasonId: season.id } }),
        p.seasonSession.count({ where: { seasonId: season.id } }),
        p.seasonVenue.count({ where: { seasonId: season.id } }),
        p.seasonPlan.count({ where: { seasonId: season.id } }),
      ])
      if (g + s + v + pl !== 0) throw new Error(`${sspec.label}: gate state not clean (games ${g}, sessions ${s}, venues ${v}, plans ${pl})`)
      console.log(`✓ ${sspec.label}: at the planning gate — nothing generated`)
      summary.push({ label: sspec.label, stage: sspec.stage, seasonId: season.id, teams: teamCount, games: 0, weekends: 0, perTeam: "-" })
      continue
    }

    // END_OF_REGULAR: substrate (whole building, Fri 17:00-22:00, Sat/Sun
    // 09:00-18:00), then the REAL engine schedules BOTH units together,
    // then every game completes with deterministic scores.
    await p.seasonVenue.create({
      data: { seasonId: season.id, venueId: venue.id, courtsAvailable: 6, role: "pool", isPrimary: true },
    })
    const mkBlock = async (sat: string, label: string, phase: "REGULAR" | "PLAYOFF", target: number | null) => {
      const session = await p.seasonSession.create({
        data: { seasonId: season!.id, label, phase, targetGamesPerTeam: target },
        select: { id: true },
      })
      for (const offset of [-1, 0, 1]) {
        // LOCAL midnight (no Z): the engine sets slot times with local
        // setHours over this instant (generate.ts atTimeOnDate), so a
        // UTC-midnight row under TZ=America/Toronto lands games a day
        // early. Run this seed with the app's timezone.
        const date = new Date(`${sat}T00:00:00`)
        date.setDate(date.getDate() + offset)
        const day = await p.seasonSessionDay.create({ data: { sessionId: session.id, date }, select: { id: true } })
        const friday = offset === -1
        const dayVenue = await p.seasonSessionDayVenue.create({
          data: {
            dayId: day.id,
            venueId: venue.id,
            startTime: friday ? "17:00" : "09:00",
            endTime: friday ? "22:00" : "18:00",
            bookingStatus: "confirmed",
          },
          select: { id: true },
        })
        let order = 0
        for (const courtId of courtIds) {
          await p.seasonSessionDayVenueCourt.create({ data: { dayVenueId: dayVenue.id, courtId, order: order++ } })
        }
      }
    }
    for (const [i, sat] of sspec.sessionSats.entries()) await mkBlock(sat, sessionLabel(sat, i), "REGULAR", 2)
    await mkBlock(sspec.championshipSat, championshipLabel(sspec.championshipSat), "PLAYOFF", null)

    const { input, errors } = await loadSchedulerInput(season.id)
    if (!input) throw new Error(`${sspec.label}: scheduler input failed: ${errors.join("; ")}`)
    const result = generateSchedule(input)
    if (result.warnings.length) for (const w of result.warnings) console.log(`  ! ${w}`)
    const publishedAt = new Date()
    const hash = (s: string): number => {
      let h = 7
      for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 1_000_003
      return h
    }
    for (const g of result.games) {
      const h = hash(`${g.homeTeamId}|${g.awayTeamId}|${g.scheduledAt}`)
      const home = 45 + (h % 40)
      let away = 45 + (Math.floor(h / 40) % 40)
      if (away === home) away += 3 // basketball never ties
      await p.game.create({
        data: {
          seasonId: season.id,
          phase: "REGULAR",
          sessionId: g.sessionId,
          dayId: g.dayId,
          dayVenueId: g.dayVenueId,
          courtId: g.courtId,
          venueId: g.venueId,
          homeTeamId: g.homeTeamId,
          awayTeamId: g.awayTeamId,
          scheduledAt: new Date(g.scheduledAt),
          duration: g.duration,
          status: "COMPLETED",
          homeScore: home,
          awayScore: away,
          isLocked: false,
          publishedAt, // published: public pages show the finals
        },
      })
    }
    if (result.unscheduled.length > 0) {
      console.log(`  ! ${sspec.label}: ${result.unscheduled.length} matchups unscheduled`)
      for (const u of result.unscheduled.slice(0, 5)) console.log(`    - ${u.reason}`)
      throw new Error(`${sspec.label}: schedule incomplete`)
    }

    // Gates: per-team counts, weekend spread, all-completed, empty champs.
    const games = await p.game.findMany({ where: { seasonId: season.id }, select: { homeTeamId: true, awayTeamId: true, scheduledAt: true, status: true, homeScore: true, awayScore: true } })
    const perTeam = new Map<string, number>()
    for (const g of games) {
      perTeam.set(g.homeTeamId, (perTeam.get(g.homeTeamId) ?? 0) + 1)
      perTeam.set(g.awayTeamId, (perTeam.get(g.awayTeamId) ?? 0) + 1)
    }
    const counts = [...perTeam.values()]
    const min = Math.min(...counts)
    const max = Math.max(...counts)
    const weekends = new Set(games.map((g: any) => sessionSatFor(new Date(g.scheduledAt)))).size
    const incomplete = games.filter((g: any) => g.status !== "COMPLETED" || g.homeScore == null || g.homeScore === g.awayScore).length
    const champGames = await p.game.count({ where: { seasonId: season.id, session: { phase: "PLAYOFF" } } })
    if (incomplete > 0 || champGames > 0) throw new Error(`${sspec.label}: end-of-season state wrong (incomplete ${incomplete}, championship games ${champGames})`)
    console.log(`✓ ${sspec.label}: ${games.length} games COMPLETED with scores across ${weekends} weekends · per-team ${min}-${max} · championship weekend empty`)
    summary.push({ label: sspec.label, stage: sspec.stage, seasonId: season.id, teams: teamCount, games: games.length, weekends, perTeam: `${min}-${max}` })
  }

  console.log("\n══════════════════════════════════════════════════════════")
  console.log(` NATIONAL CIRCUIT — login owner-nph@${EMAIL_DOMAIN} / ${PASSWORD}`)
  console.log(` league ${league.id}`)
  for (const s of summary) {
    console.log(` ${s.label} [${s.stage}]`)
    console.log(`   teams ${s.teams} · games ${s.games} · weekends ${s.weekends} · per-team ${s.perTeam}`)
    console.log(`   manage: /manage/leagues/${league.id}/seasons/${s.seasonId}/manage`)
    console.log(`   public: /league/${s.seasonId}`)
    if (s.stage === "PLANNING_GATE") {
      console.log(`   plan wizard: /manage/leagues/${league.id}/seasons/${s.seasonId}/plan`)
    } else {
      console.log(`   standings: /manage/leagues/${league.id}/seasons/${s.seasonId}/manage?tab=standings`)
      console.log(`   playoffs:  /manage/leagues/${league.id}/seasons/${s.seasonId}/manage?tab=playoffs`)
    }
  }
  console.log(`══════════════════════════════════════════════════════════`)
  console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`)
}

/** Saturday anchor (UTC) of the weekend containing d — for the gate only. */
function sessionSatFor(d: Date): string {
  const dow = d.getUTCDay() // Fri=5 Sat=6 Sun=0
  const shift = dow === 5 ? 1 : dow === 0 ? -1 : 0
  const sat = new Date(d.getTime())
  sat.setUTCDate(sat.getUTCDate() + shift)
  return sat.toISOString().slice(0, 10)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
