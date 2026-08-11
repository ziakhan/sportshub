/**
 * NATIONAL CIRCUIT SEEDER — the real NJC + NSC worlds as playable demo
 * leagues, LOCAL ONLY. Additive to whatever demo world is loaded (journey
 * or pitch): it never touches the NPH Showcase League's data.
 *
 * Source data (do not invent teams):
 *   docs/research/census-njc-nsc-2025-26.md  — every real 2025-26 team entry
 *   docs/research/nph-operations-intel-2026-08.md — how the circuits run:
 *     both book Six Park East (Oshawa, courts 1-6) for the SAME Fri-Sun
 *     blocks, 5 weekend sessions + a National Championship, FIBA 4x10,
 *     observed ~10-11 games per team across the season.
 *
 * Modeling choices (documented for the report):
 *   - One competitive unit per league: prep programs field ONE junior and
 *     ONE senior team (owner framing), so each season has a single division
 *     labeled "Junior" (NJC) / "Senior" (NSC). Division.ageGroup carries the
 *     same label — the schema takes arbitrary strings.
 *   - 2026-27 session blocks follow the research calendar where Six Park is
 *     actually free in THIS world's data: Oct 16-18, Jan 15-17, Feb 12-14
 *     and Mar 12-14 (championship) are the real blocks; the November and
 *     December sessions move one/two weeks (Nov 27-29, Dec 18-20) because
 *     the seeded NPH Showcase schedule already holds Six Park on the real
 *     Nov 14-15 / Dec 12-13 weekends. The scheduler's shared-venue busy
 *     bookings keep the two circuits (and NPH) off each other's courts.
 *   - NJC schedules first; NSC's generator then sees NJC's games as busy
 *     court bookings (the product's own shared-venue mechanism in
 *     lib/scheduler/load.ts) — one building, two leagues, zero collisions.
 *
 * Idempotent: leagues/teams/tenants/players find-or-create; each run wipes
 * and rebuilds ONLY the two circuit seasons' substrate + games.
 *
 * Run (arm64 node!):  npx tsx scripts/seed-national-circuit.ts
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

// ── The 2026-27 circuit calendar (see header for the two date shifts) ───
// Each block is Fri-Sun; the Saturday anchors the weekend.
const SESSION_SATS = ["2026-10-17", "2026-11-28", "2026-12-19", "2027-01-16", "2027-02-13"]
const CHAMPIONSHIP_SAT = "2027-03-13"
const sessionLabel = (sat: string, i: number): string => {
  const d = new Date(`${sat}T12:00:00Z`)
  const fri = new Date(d.getTime() - 86400_000)
  const sun = new Date(d.getTime() + 86400_000)
  const mon = fri.toLocaleDateString("en-CA", { month: "short", timeZone: "UTC" })
  return `Session ${i + 1} · ${mon} ${fri.getUTCDate()}-${sun.getUTCDate()}`
}

const SEASON_LABEL = "2026-27"
const VENUE_NAME = "Six Park East"

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

interface LeagueSpec {
  key: "NJC" | "NSC"
  name: string
  description: string
  unit: "Junior" | "Senior"
  birthYears: number[]
}

const LEAGUES: LeagueSpec[] = [
  {
    key: "NJC",
    name: "National Junior Circuit",
    description:
      "National club circuit for grade 9 and 10 prep juniors. Five weekend sessions plus a national championship, played at Six Park East in Oshawa.",
    unit: "Junior",
    birthYears: [2011, 2012],
  },
  {
    key: "NSC",
    name: "National Senior Circuit",
    description:
      "National club circuit for grade 11 and 12 prep seniors. Five weekend sessions plus a national championship, played at Six Park East in Oshawa.",
    unit: "Senior",
    birthYears: [2009, 2010],
  },
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

  // The operator: owner-nph runs both circuits in this demo world.
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

  const summary: Array<{ league: string; leagueId: string; seasonId: string; teams: number; games: number; weekends: number; perTeam: string; unscheduled: number }> = []

  for (const spec of LEAGUES) {
    // League: find by name and upgrade, else create (the pitch world lists
    // these as name-only directory entries; this world may not have them).
    let league = await p.league.findFirst({ where: { name: spec.name }, select: { id: true } })
    if (!league) {
      league = await p.league.create({
        data: {
          name: spec.name,
          description: spec.description,
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
        data: { description: spec.description, ownerId: nph.id, organizationId: org?.id ?? undefined },
      })
    }
    const ownerRole = await p.userRole.findFirst({ where: { userId: nph.id, role: "LeagueOwner", leagueId: league.id }, select: { id: true } })
    if (!ownerRole) await p.userRole.create({ data: { userId: nph.id, role: "LeagueOwner", leagueId: league.id } })

    // Season: reuse the row (keeps the /league/<seasonId> URL stable across
    // re-runs), wipe ONLY this season's substrate + games, rebuild.
    let season = await p.season.findFirst({ where: { leagueId: league.id, label: SEASON_LABEL }, select: { id: true } })
    if (season) {
      await p.game.deleteMany({ where: { seasonId: season.id } })
      await p.seasonRoster.deleteMany({ where: { seasonId: season.id } })
      await p.teamSubmission.deleteMany({ where: { seasonId: season.id } })
      await p.division.deleteMany({ where: { seasonId: season.id } })
      await p.seasonSession.deleteMany({ where: { seasonId: season.id } })
      await p.seasonVenue.deleteMany({ where: { seasonId: season.id } })
    }
    const seasonData = {
      label: SEASON_LABEL,
      status: "FINALIZED",
      type: "FALL_WINTER",
      startDate: new Date("2026-10-16T00:00:00Z"),
      endDate: new Date("2027-03-14T00:00:00Z"),
      registrationDeadline: new Date("2026-10-01T00:00:00Z"),
      gamesGuaranteed: 10, // 2 per session across 5 sessions (matches the circuits' observed ~10-11)
      gameSlotMinutes: 90,
      gameLengthMinutes: 40, // FIBA 4x10 (research)
      gamePeriods: "QUARTERS",
      periodLengthMinutes: 10,
      defaultWeekendStyle: "SAME_DAY",
      defaultVenueOpenTime: "09:00",
      defaultVenueCloseTime: "18:00",
      teamFee: 5150, // all-in five sessions + championship (research pricing)
      rosterChangePolicy: "REQUEST_ONLY",
    }
    if (!season) {
      season = await p.season.create({ data: { leagueId: league.id, ...seasonData }, select: { id: true } })
    } else {
      await p.season.update({ where: { id: season.id }, data: seasonData })
    }

    // ONE competitive unit (owner framing: no per-grade split).
    const division = await p.division.create({
      data: { seasonId: season.id, name: spec.unit, ageGroup: spec.unit, gender: "MALE", tier: 1 },
      select: { id: true },
    })

    // Venue + the six Fri-Sun blocks at Six Park East, whole building.
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
    for (const [i, sat] of SESSION_SATS.entries()) await mkBlock(sat, sessionLabel(sat, i), "REGULAR", 2)
    await mkBlock(CHAMPIONSHIP_SAT, "National Championship · Mar 12-14", "PLAYOFF", null)

    // Teams: every real census entry, with a fictional roster, submitted
    // APPROVED with a locked season roster.
    let teamCount = 0
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
            data: { tenantId: tenant.id, name: entryName, ageGroup: spec.unit, gender: "MALE", season: SEASON_LABEL, description: MARKER },
            select: { id: true },
          })
        }
        const rosterCount = await p.teamPlayer.count({ where: { teamId: team.id } })
        if (rosterCount === 0) {
          const size = 10 + (teamCount % 4) // 10-13, census average is ~12
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
            submittedAt: new Date("2026-09-20T00:00:00Z"),
            lockedAt: new Date("2026-09-25T00:00:00Z"),
            players: { create: rosterRows.map((r: any) => ({ playerId: r.playerId, jerseyNumber: r.jerseyNumber })) },
          },
        })
        teamCount++
      }
    }
    console.log(`✓ ${spec.name}: ${teamCount} teams submitted + approved`)

    // Schedule with the REAL engine. NJC runs first; when NSC loads, NJC's
    // games (same courts, other season) surface as busy bookings and the
    // engine schedules around them — the product's shared-venue mechanism.
    const { input, errors } = await loadSchedulerInput(season.id)
    if (!input) throw new Error(`${spec.name}: scheduler input failed: ${errors.join("; ")}`)
    const result = generateSchedule(input)
    if (result.warnings.length) for (const w of result.warnings) console.log(`  ! ${w}`)
    const publishedAt = new Date()
    for (const g of result.games) {
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
          status: "SCHEDULED",
          isLocked: false,
          publishedAt, // published: public pages show the schedule
        },
      })
    }
    if (result.unscheduled.length > 0) {
      console.log(`  ! ${spec.name}: ${result.unscheduled.length} matchups unscheduled`)
      for (const u of result.unscheduled.slice(0, 5)) console.log(`    - ${u.reason}`)
    }

    // Gates: per-team counts + weekend spread.
    const games = await p.game.findMany({ where: { seasonId: season.id }, select: { homeTeamId: true, awayTeamId: true, scheduledAt: true } })
    const perTeam = new Map<string, number>()
    for (const g of games) {
      perTeam.set(g.homeTeamId, (perTeam.get(g.homeTeamId) ?? 0) + 1)
      perTeam.set(g.awayTeamId, (perTeam.get(g.awayTeamId) ?? 0) + 1)
    }
    const counts = [...perTeam.values()]
    const min = Math.min(...counts)
    const max = Math.max(...counts)
    const weekends = new Set(games.map((g: any) => sessionSatFor(new Date(g.scheduledAt)))).size
    console.log(`✓ ${spec.name}: ${games.length} games published across ${weekends} weekends · per-team ${min}-${max}`)
    summary.push({ league: spec.name, leagueId: league.id, seasonId: season.id, teams: teamCount, games: games.length, weekends, perTeam: `${min}-${max}`, unscheduled: result.unscheduled.length })
  }

  console.log("\n══════════════════════════════════════════════════════════")
  console.log(` NATIONAL CIRCUITS — login owner-nph@${EMAIL_DOMAIN} / ${PASSWORD}`)
  for (const s of summary) {
    console.log(` ${s.league}`)
    console.log(`   teams ${s.teams} · games ${s.games} · weekends ${s.weekends} · per-team ${s.perTeam} · unscheduled ${s.unscheduled}`)
    console.log(`   manage: /manage/leagues/${s.leagueId}/seasons/${s.seasonId}/manage`)
    console.log(`   public: /league/${s.seasonId}`)
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
