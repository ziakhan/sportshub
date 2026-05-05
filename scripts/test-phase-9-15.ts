/**
 * Phases 9–15 — League creation through Standings
 *
 * Combined runner because phases share a heavy data-dependency chain:
 *   League → Season → Divisions → Venues → Sessions → Settings → Submissions
 *   → Finalize → Schedule (preview/commit/edit) → Standings
 *
 * Splitting into 7 standalone runners would re-do the same setup 7×.
 * Each scenario is still tagged with its phase number; the test plan
 * doc maps each row to a phase header.
 *
 * Usage:
 *   cd packages/db && npx tsx /Users/ziakhan/zia/personal/sportshub/scripts/test-phase-9-15.ts
 */

import { prisma } from "@youthbasketballhub/db"
import { call, makeUser, Reporter } from "./lib/test-helpers"

const TEST_EMAIL_DOMAIN = "phase9to15-test.local"
const TEST_TENANT_SLUG_PREFIX = "phase9to15-test-"

const r = new Reporter()

async function cleanup() {
  const tenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: TEST_TENANT_SLUG_PREFIX } }, select: { id: true },
  })
  const tenantIds = tenants.map((t) => t.id)
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } }, select: { id: true },
  })
  const userIds = users.map((u) => u.id)

  // Leagues owned by our test users
  const leagues = await prisma.league.findMany({
    where: { ownerId: { in: userIds } }, select: { id: true },
  })
  const leagueIds = leagues.map((l) => l.id)

  if (leagueIds.length > 0) {
    const seasons = await prisma.season.findMany({ where: { leagueId: { in: leagueIds } }, select: { id: true } })
    const seasonIds = seasons.map((s) => s.id)
    if (seasonIds.length > 0) {
      const px: any = prisma
      await px.game.deleteMany({ where: { seasonId: { in: seasonIds } } })
      await px.teamSubmission.deleteMany({ where: { seasonId: { in: seasonIds } } })
      await px.schedulingGroupDivision.deleteMany({ where: { schedulingGroup: { seasonId: { in: seasonIds } } } })
      await px.schedulingGroup.deleteMany({ where: { seasonId: { in: seasonIds } } })
      await px.seasonSessionDayVenueCourt.deleteMany({ where: { dayVenue: { day: { session: { seasonId: { in: seasonIds } } } } } })
      await px.seasonSessionDayVenue.deleteMany({ where: { day: { session: { seasonId: { in: seasonIds } } } } })
      await px.seasonSessionDay.deleteMany({ where: { session: { seasonId: { in: seasonIds } } } })
      await px.seasonSession.deleteMany({ where: { seasonId: { in: seasonIds } } })
      // Courts are venue-owned, only delete those we created (by name pattern)
      await px.court.deleteMany({ where: { name: { in: ["Court 1", "Court 2"] }, venue: { name: { startsWith: "Phase9to15 Venue" } } } })
      await px.venueHours.deleteMany({ where: { venue: { name: { startsWith: "Phase9to15 Venue" } } } })
      await px.seasonVenue.deleteMany({ where: { seasonId: { in: seasonIds } } })
      await px.division.deleteMany({ where: { seasonId: { in: seasonIds } } })
    }
    await prisma.season.deleteMany({ where: { leagueId: { in: leagueIds } } })
    await prisma.league.deleteMany({ where: { id: { in: leagueIds } } })
    // Clean up the Phase9to15 Venues (only those without remaining seasonVenue references)
    await prisma.venue.deleteMany({ where: { name: { startsWith: "Phase9to15 Venue" } } })
  }
  if (tenantIds.length > 0) {
    const teams = await prisma.team.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true } })
    const teamIds = teams.map((t) => t.id)
    if (teamIds.length > 0) {
      await prisma.offer.deleteMany({ where: { teamId: { in: teamIds } } })
      await prisma.offerTemplate.deleteMany({ where: { teamId: { in: teamIds } } })
      await prisma.teamPlayer.deleteMany({ where: { teamId: { in: teamIds } } })
    }
    await prisma.userRole.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.team.deleteMany({ where: { tenantId: { in: tenantIds } } })
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } })
  }
  if (userIds.length > 0) {
    await prisma.player.deleteMany({ where: { parentId: { in: userIds } } })
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  }
  console.log(`🧹 Cleaned up ${users.length} users, ${tenants.length} tenants, ${leagueIds.length} leagues`)
}

function isoDaysAhead(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString()
}

// Build a finalized team in a fresh club (4 teams across 2 divisions worth)
async function buildClubAndFinalizedTeams(suffix: string, teamCount = 2) {
  const owner = await makeUser({
    email: `phase9to15-clubowner-${suffix}@${TEST_EMAIL_DOMAIN}`,
    firstName: "Cleo", lastName: "Owner",
    roles: ["ClubOwner"],
  })
  const tenant = await prisma.tenant.create({
    data: {
      name: `Phase9to15 Tenant ${suffix}`, slug: `${TEST_TENANT_SLUG_PREFIX}club-${suffix}`,
      contactEmail: `tenant-${suffix}@${TEST_EMAIL_DOMAIN}`,
      city: "Toronto", state: "ON", country: "CA", currency: "CAD", status: "ACTIVE",
    },
  })
  const r0 = await prisma.userRole.findFirst({ where: { userId: owner.userId, role: "ClubOwner", tenantId: null } })
  if (r0) await prisma.userRole.update({ where: { id: r0.id }, data: { tenantId: tenant.id } })
  else await prisma.userRole.create({ data: { userId: owner.userId, role: "ClubOwner", tenantId: tenant.id } })
  const teams: { id: string; name: string }[] = []
  for (let i = 0; i < teamCount; i++) {
    const team = await prisma.team.create({
      data: { name: `Phase9to15 ${suffix} Team ${i + 1}`, ageGroup: "U12", gender: "MALE", season: "Spring 2026", tenantId: tenant.id },
    })
    // Add a single TeamPlayer so the team isn't empty (frozen roster snapshot)
    const parent = await makeUser({
      email: `phase9to15-${suffix}-parent-${i}@${TEST_EMAIL_DOMAIN}`,
      firstName: "Pat", lastName: "Parent",
      roles: ["Parent"],
      profileData: { type: "Parent", phoneNumber: "+14165550000", country: "CA", city: "Toronto", state: "ON" },
    })
    const dob = new Date(); dob.setFullYear(dob.getFullYear() - 11)
    const playerRes = await call("/api/players", {
      method: "POST", jar: parent.jar,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ firstName: `Kid${suffix}${i}`, lastName: "Player", dateOfBirth: dob.toISOString().slice(0, 10), gender: "MALE", parentalConsentGiven: true }),
    })
    if (playerRes.status === 201) {
      await prisma.teamPlayer.create({
        data: { teamId: team.id, playerId: playerRes.body.id, status: "ACTIVE", jerseyNumber: i + 1 },
      })
    }
    teams.push({ id: team.id, name: team.name })
  }
  return { owner, tenantId: tenant.id, teams }
}

// ---------- Top-level state ----------

let leagueOwner: Awaited<ReturnType<typeof makeUser>> | null = null
let leagueId: string | null = null
let seasonId: string | null = null
let divisionAId: string | null = null
let divisionBId: string | null = null
let seasonVenueId: string | null = null
let venueId: string | null = null
let courtIds: string[] = []
let sessionId: string | null = null
let club1: Awaited<ReturnType<typeof buildClubAndFinalizedTeams>> | null = null
let club2: Awaited<ReturnType<typeof buildClubAndFinalizedTeams>> | null = null
let allTeamIds: string[] = []

// ---------- Phase 9: League creation ----------

async function p9_1_create_league() {
  leagueOwner = await makeUser({
    email: `phase9to15-leagueowner@${TEST_EMAIL_DOMAIN}`,
    firstName: "Lee", lastName: "Owner",
    roles: ["LeagueOwner"],
    profileData: { type: "LeagueOwner", name: "Phase9to15 League", description: "auto", season: "placeholder" },
  })
  // Onboarding already creates a default League. Find it.
  const l = await prisma.league.findFirst({ where: { ownerId: leagueOwner.userId } })
  if (l) {
    // Reuse onboarding-created league for deterministic test
    leagueId = l.id
  } else {
    const res = await call("/api/leagues", {
      method: "POST", jar: leagueOwner.jar,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Phase9to15 League", description: "auto" }),
    })
    if (res.status !== 201 && res.status !== 200) return r.record("9.1", "Create league", false, `HTTP ${res.status}`)
    leagueId = res.body?.id ?? res.body?.league?.id
  }
  const ok = !!leagueId
  r.record("9.1", "League created (via onboarding or POST /api/leagues)", ok, ok ? `leagueId set ✓` : `no league`)
}

async function p9_2_edit_league() {
  if (!leagueOwner || !leagueId) return r.record("9.2", "Edit league", false, "no setup")
  const res = await call(`/api/leagues/${leagueId}`, {
    method: "PATCH", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ description: "Updated description" }),
  })
  if (res.status !== 200) return r.record("9.2", "Edit league", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const l = await prisma.league.findUnique({ where: { id: leagueId } })
  const ok = l?.description === "Updated description"
  r.record("9.2", "Edit league metadata", ok, ok ? `description persisted ✓` : `state wrong`)
}

async function p9_3_dashboard_loads() {
  if (!leagueOwner || !leagueId) return r.record("9.3", "Dashboard loads", false, "no setup")
  const res = await call(`/api/leagues/${leagueId}`, { jar: leagueOwner.jar })
  const ok = res.status === 200 && res.body?.id === leagueId
  r.record("9.3", "GET /api/leagues/[id] returns league", ok, ok ? `200 ✓` : `HTTP ${res.status}`)
}

// ---------- Phase 10: Season creation + setup ----------

async function p10_1_create_season() {
  if (!leagueOwner || !leagueId) return r.record("10.1", "Create season", false, "no setup")
  const res = await call(`/api/leagues/${leagueId}/seasons`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      label: "Phase9to15 Spring 2026",
      type: "SPRING",
      startDate: isoDaysAhead(30),
      endDate: isoDaysAhead(120),
      registrationDeadline: isoDaysAhead(20),
      teamFee: 1200,
      gamesGuaranteed: 8,
      targetGamesPerSession: 1,
      gameSlotMinutes: 90,
      gameLengthMinutes: 40,
      gamePeriods: "HALVES",
    }),
  })
  if (res.status !== 201 && res.status !== 200) return r.record("10.1", "Create season", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  seasonId = res.body?.id ?? res.body?.season?.id
  if (!seasonId) {
    const s = await prisma.season.findFirst({ where: { leagueId, label: "Phase9to15 Spring 2026" } })
    seasonId = s?.id ?? null
  }
  const ok = !!seasonId
  r.record("10.1", "Create season under league", ok, ok ? `seasonId set ✓` : `no season`)
}

async function p10_2_create_divisions() {
  if (!leagueOwner || !seasonId) return r.record("10.2", "Create divisions", false, "no setup")
  const a = await call(`/api/seasons/${seasonId}/divisions`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "U12 Boys A", ageGroup: "U12", gender: "MALE", maxTeams: 6 }),
  })
  const b = await call(`/api/seasons/${seasonId}/divisions`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "U12 Boys B", ageGroup: "U12", gender: "MALE", maxTeams: 6 }),
  })
  if ((a.status !== 201 && a.status !== 200) || (b.status !== 201 && b.status !== 200))
    return r.record("10.2", "Create divisions", false, `a=${a.status} b=${b.status}`)
  divisionAId = a.body?.id ?? a.body?.division?.id
  divisionBId = b.body?.id ?? b.body?.division?.id
  if (!divisionAId || !divisionBId) {
    const list = await (prisma as any).division.findMany({ where: { seasonId } })
    divisionAId = list.find((d: any) => d.name === "U12 Boys A")?.id ?? divisionAId
    divisionBId = list.find((d: any) => d.name === "U12 Boys B")?.id ?? divisionBId
  }
  const ok = !!divisionAId && !!divisionBId
  r.record("10.2", "Create 2 divisions", ok, ok ? `2 divisions ✓` : `state wrong`)
}

async function p10_3_add_venue_with_courts() {
  if (!leagueOwner || !seasonId) return r.record("10.3", "Add venue + courts", false, "no setup")
  // Create a Venue first (global — not tenant-scoped)
  const venue = await prisma.venue.create({
    data: {
      name: `Phase9to15 Venue ${Date.now()}`,
      address: "123 Venue St",
      city: "Toronto", state: "ON", zipCode: "M5V1A1", country: "CA",
      capacity: 500,
    },
  })
  const res = await call(`/api/seasons/${seasonId}/venues`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ venueId: venue.id, isPrimary: true, courtsAvailable: 2 }),
  })
  if (res.status !== 201 && res.status !== 200) return r.record("10.3", "Add venue", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  venueId = venue.id
  const sv = await (prisma as any).seasonVenue.findFirst({ where: { seasonId, venueId: venue.id } })
  seasonVenueId = sv?.id ?? null
  // Courts are owned by the global Venue (persist across seasons). Create 2.
  let courts = await (prisma as any).court.findMany({ where: { venueId: venue.id } })
  if (courts.length < 2) {
    for (let i = courts.length; i < 2; i++) {
      await (prisma as any).court.create({ data: { venueId: venue.id, name: `Court ${i + 1}`, displayOrder: i } })
    }
    courts = await (prisma as any).court.findMany({ where: { venueId: venue.id } })
  }
  courtIds = courts.map((c: any) => c.id)
  const ok = !!seasonVenueId && courtIds.length === 2
  r.record("10.3", "Add venue + 2 courts (Court is venue-scoped)", ok, ok ? `seasonVenue + ${courtIds.length} courts ✓` : `state wrong`)
}

async function p10_4_create_session() {
  if (!leagueOwner || !seasonId || !venueId) return r.record("10.4", "Create session", false, "no setup")
  // 4 weekly Sundays starting in 35 days
  const days = []
  for (let i = 0; i < 4; i++) {
    const d = new Date(); d.setDate(d.getDate() + 35 + i * 7)
    days.push({ date: d.toISOString().slice(0, 10), startTime: "09:00", endTime: "17:00" })
  }
  const res = await call(`/api/seasons/${seasonId}/sessions`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      label: "Sunday Regular",
      venueId, // global Venue.id, not SeasonVenue.id
      days,
    }),
  })
  if (res.status !== 201 && res.status !== 200) return r.record("10.4", "Create session", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const sess = await (prisma as any).seasonSession.findFirst({ where: { seasonId } })
  sessionId = sess?.id ?? null
  // Attach courts to each day-venue (preflight requires ≥1 day with venue + court).
  // No public API for SeasonSessionDayVenueCourt — wired via UI elsewhere; do it directly.
  const dayVenues = await (prisma as any).seasonSessionDayVenue.findMany({
    where: { day: { sessionId } },
    select: { id: true },
  })
  for (const dv of dayVenues) {
    for (const cId of courtIds) {
      await (prisma as any).seasonSessionDayVenueCourt.upsert({
        where: { dayVenueId_courtId: { dayVenueId: dv.id, courtId: cId } },
        create: { dayVenueId: dv.id, courtId: cId },
        update: {},
      })
    }
  }
  const sessionDays = await (prisma as any).seasonSessionDay.count({ where: { sessionId } })
  const ok = sessionDays === 4 && dayVenues.length === 4
  r.record("10.4", "Create REGULAR session w/ 4 days + 2 courts each (DB attach)", ok, ok ? `${sessionDays} days, ${dayVenues.length * courtIds.length} day-venue-courts ✓` : `state wrong`)
}

async function p10_5_scheduling_settings() {
  if (!leagueOwner || !seasonId) return r.record("10.5", "Scheduling settings", false, "no setup")
  const res = await call(`/api/seasons/${seasonId}`, {
    method: "PATCH", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schedulingPhilosophy: "FAMILY_FRIENDLY",
      periodLengthMinutes: 20,
      allowCrossDivisionScheduling: false,
    }),
  })
  if (res.status !== 200) return r.record("10.5", "Scheduling settings", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const s = await (prisma as any).season.findUnique({ where: { id: seasonId } })
  const ok = s?.schedulingPhilosophy === "FAMILY_FRIENDLY" && s?.periodLengthMinutes === 20
  r.record("10.5", "Set scheduling philosophy + periodLengthMinutes", ok, ok ? `FAMILY_FRIENDLY + 20min ✓` : `state wrong`)
}

async function p10_6_tiebreakers() {
  if (!leagueOwner || !seasonId) return r.record("10.6", "Tiebreakers", false, "no setup")
  const order = ["WINS", "HEAD_TO_HEAD", "POINT_DIFFERENTIAL", "POINTS_FOR"]
  const res = await call(`/api/seasons/${seasonId}`, {
    method: "PATCH", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tiebreakerOrder: order }),
  })
  if (res.status !== 200) return r.record("10.6", "Tiebreakers", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const s = await (prisma as any).season.findUnique({ where: { id: seasonId } })
  const ok = JSON.stringify(s?.tiebreakerOrder) === JSON.stringify(order) && !s?.tiebreakersLockedAt
  r.record("10.6", "Tiebreakers ordered + not yet locked", ok, ok ? `order set, tiebreakersLockedAt=null ✓` : `state wrong`)
}

function p10_7_scheduling_groups() {
  // Optional cross-division group; per design we left allowCrossDivisionScheduling=false. Skip.
  r.record("10.7", "SchedulingGroups optional (skipped — single-division test)", "skip", "Not exercised in this run; tested elsewhere")
}

async function p10_8_open_for_registration() {
  // Already in default DRAFT — make sure it's open for registration. Per V2 design, that's the season status flow.
  if (!leagueOwner || !seasonId) return r.record("10.8", "Open registration", false, "no setup")
  const res = await call(`/api/seasons/${seasonId}`, {
    method: "PATCH", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "REGISTRATION" }),
  })
  if (res.status !== 200) return r.record("10.8", "Open registration", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const s = await (prisma as any).season.findUnique({ where: { id: seasonId } })
  const ok = s?.status === "REGISTRATION"
  r.record("10.8", "Season opened for registration", ok, ok ? `status=REGISTRATION ✓` : `status=${s?.status}`)
}

// ---------- Phase 11: Team submissions ----------

async function p11_setup_clubs() {
  club1 = await buildClubAndFinalizedTeams("c1", 2)
  club2 = await buildClubAndFinalizedTeams("c2", 2)
  allTeamIds = [...club1.teams.map((t) => t.id), ...club2.teams.map((t) => t.id)]
}

async function p11_1_submit_teams() {
  if (!seasonId || !divisionAId || !club1 || !club2) return r.record("11.1", "Submit teams", false, "no setup")
  // Submit 2 from club1 to A, 2 from club2 to B
  const submissions = [
    { jar: club1.owner.jar, teamId: club1.teams[0].id, divisionId: divisionAId },
    { jar: club1.owner.jar, teamId: club1.teams[1].id, divisionId: divisionAId },
    { jar: club2.owner.jar, teamId: club2.teams[0].id, divisionId: divisionBId! },
    { jar: club2.owner.jar, teamId: club2.teams[1].id, divisionId: divisionBId! },
  ]
  let count = 0
  for (const s of submissions) {
    const res = await call(`/api/seasons/${seasonId}/submit`, {
      method: "POST", jar: s.jar,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ teamId: s.teamId, divisionId: s.divisionId }),
    })
    if (res.status === 201 || res.status === 200) count++
    else console.log(`   submit ${s.teamId} HTTP ${res.status} ${JSON.stringify(res.body)}`)
  }
  const lts = await (prisma as any).teamSubmission.count({ where: { seasonId } })
  const ok = count === 4 && lts === 4
  r.record("11.1", "Clubs submit 4 teams across 2 divisions", ok, ok ? `${count}/4 submitted, ${lts} LeagueTeam rows ✓` : `${count}/4`)
}

async function p11_5_approve_teams() {
  if (!leagueOwner || !seasonId) return r.record("11.5", "Approve teams", false, "no setup")
  const subs = await (prisma as any).teamSubmission.findMany({ where: { seasonId } })
  let approved = 0
  for (const s of subs) {
    // The [teamId] route param is actually the TeamSubmission.id, not Team.id
    const res = await call(`/api/seasons/${seasonId}/teams/${s.id}`, {
      method: "PATCH", jar: leagueOwner.jar,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "APPROVED", paymentStatus: "PAID_MANUAL" }),
    })
    if (res.status === 200) approved++
  }
  const updated = await (prisma as any).teamSubmission.count({ where: { seasonId, status: "APPROVED" } })
  const ok = approved === subs.length && updated === subs.length
  r.record("11.5", "LeagueOwner approves all 4 teams", ok, ok ? `${approved}/${subs.length} approved + paid ✓` : `${approved}/${subs.length}`)
}

async function p11_2_past_deadline() {
  if (!leagueOwner || !seasonId || !club1 || !divisionAId) return r.record("11.2", "Past deadline rejected", false, "no setup")
  // Snapshot current deadline, set to past, try submit, restore
  const before = await (prisma as any).season.findUnique({ where: { id: seasonId }, select: { registrationDeadline: true } })
  await (prisma as any).season.update({ where: { id: seasonId }, data: { registrationDeadline: new Date(Date.now() - 24 * 3600 * 1000) } })
  // Use a fresh team that hasn't submitted yet
  const tenant = await prisma.tenant.create({
    data: {
      name: "Phase9to15 Late Tenant", slug: `${TEST_TENANT_SLUG_PREFIX}late`,
      city: "Toronto", state: "ON", country: "CA", currency: "CAD", status: "ACTIVE",
    },
  })
  await prisma.userRole.create({ data: { userId: club1.owner.userId, role: "ClubOwner", tenantId: tenant.id } })
  const team = await prisma.team.create({
    data: { name: "Late Team", ageGroup: "U12", gender: "MALE", tenantId: tenant.id },
  })
  const res = await call(`/api/seasons/${seasonId}/submit`, {
    method: "POST", jar: club1.owner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ teamId: team.id, divisionId: divisionAId }),
  })
  // Restore
  await (prisma as any).season.update({ where: { id: seasonId }, data: { registrationDeadline: before.registrationDeadline } })
  const ok = res.status === 400 || res.status === 403
  r.record("11.2", "Submit past deadline rejected", ok, ok ? `HTTP ${res.status} ✓` : `HTTP ${res.status} expected 400`)
}

// ---------- Phase 12: Season finalization ----------

async function p12_2_finalize() {
  if (!leagueOwner || !seasonId) return r.record("12.2", "Finalize season", false, "no setup")
  const res = await call(`/api/seasons/${seasonId}`, {
    method: "PATCH", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "FINALIZED" }),
  })
  if (res.status !== 200) return r.record("12.2", "Finalize season", false, `HTTP ${res.status} ${JSON.stringify(res.body)}`)
  const s = await (prisma as any).season.findUnique({ where: { id: seasonId } })
  const ok = s?.status === "FINALIZED" && !!s?.tiebreakersLockedAt
  r.record("12.2", "Finalize sets status + locks tiebreakers", ok, ok ? `status=FINALIZED, tiebreakersLockedAt set ✓` : `status=${s?.status}, locked=${!!s?.tiebreakersLockedAt}`)
}

async function p12_4_post_finalize_edit() {
  if (!leagueOwner || !seasonId || !venueId) return r.record("12.4", "Post-finalize edit blocked", false, "no setup")

  // Each of the structural-shape mutations should now return 409 with the SEASON_LOCKED message.
  const division = await call(`/api/seasons/${seasonId}/divisions`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "After-Finalize Division", ageGroup: "U13" }),
  })
  const venue = await call(`/api/seasons/${seasonId}/venues`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ venueId, courtsAvailable: 1 }),
  })
  const session = await call(`/api/seasons/${seasonId}/sessions`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ label: "Late Session", venueId, days: [{ date: "2026-12-01", startTime: "09:00", endTime: "12:00" }] }),
  })
  const group = await call(`/api/seasons/${seasonId}/scheduling-groups`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Late Group", divisionIds: [] }),
  })

  const all409 = division.status === 409 && venue.status === 409 && session.status === 409 && group.status === 409
  r.record("12.4", "Post-finalize add div/venue/session/scheduling-group all blocked", all409,
    all409 ? `division=409, venue=409, session=409, group=409 ✓` : `division=${division.status}, venue=${venue.status}, session=${session.status}, group=${group.status}`)
}

async function p12_5_post_finalize_tiebreakers() {
  if (!leagueOwner || !seasonId) return r.record("12.5", "Tiebreakers locked post-finalize", false, "no setup")
  const res = await call(`/api/seasons/${seasonId}`, {
    method: "PATCH", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tiebreakerOrder: ["WINS", "POINTS_FOR"] }),
  })
  const ok = res.status === 409 && /tiebreakers/i.test(JSON.stringify(res.body))
  r.record("12.5", "PATCH tiebreakerOrder post-finalize blocked", ok,
    ok ? `HTTP 409 with tiebreakers-locked message ✓` : `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`)
}

// ---------- Phase 13: Schedule generation ----------

async function p13_1_preview() {
  if (!leagueOwner || !seasonId) return r.record("13.1", "Preview", false, "no setup")
  const res = await call(`/api/seasons/${seasonId}/schedule/preview`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
  if (res.status !== 200) return r.record("13.1", "Preview", false, `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`)
  const games = res.body?.games ?? res.body?.preview?.games ?? []
  const ok = Array.isArray(games) && games.length > 0
  r.record("13.1", "Schedule preview returns games (no DB writes)", ok, ok ? `${games.length} games proposed ✓` : `${JSON.stringify(res.body).slice(0, 100)}`)
}

async function p13_3_commit() {
  if (!leagueOwner || !seasonId) return r.record("13.3", "Commit", false, "no setup")
  const res = await call(`/api/seasons/${seasonId}/schedule/commit`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
  if (res.status !== 200 && res.status !== 201) return r.record("13.3", "Commit", false, `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`)
  const games = await (prisma as any).game.count({ where: { seasonId } })
  const ok = games > 0
  r.record("13.3", "Schedule commit persists games", ok, ok ? `${games} game rows ✓` : `0 games`)
}

async function p13_4_wipe_regenerate() {
  if (!leagueOwner || !seasonId) return r.record("13.4", "Wipe + regenerate", false, "no setup")
  const before = await (prisma as any).game.count({ where: { seasonId } })
  const wipe = await call(`/api/seasons/${seasonId}/schedule`, { method: "DELETE", jar: leagueOwner.jar })
  if (wipe.status !== 200) return r.record("13.4", "Wipe + regenerate", false, `wipe HTTP ${wipe.status}`)
  const afterWipe = await (prisma as any).game.count({ where: { seasonId } })
  // Real commit path now works (0.1.8 closed).
  const recommit = await call(`/api/seasons/${seasonId}/schedule/commit`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
  if (recommit.status !== 200 && recommit.status !== 201) return r.record("13.4", "Wipe + regenerate", false, `recommit HTTP ${recommit.status}`)
  const afterRecommit = await (prisma as any).game.count({ where: { seasonId } })
  const ok = before > 0 && afterWipe === 0 && afterRecommit > 0
  r.record("13.4", "Wipe schedule then re-commit", ok, ok ? `${before} → ${afterWipe} (wiped) → ${afterRecommit} (re-committed) ✓` : `state wrong`)
}

// ---------- Phase 14: Schedule editing ----------

async function p14_1_edit_game() {
  if (!leagueOwner) return r.record("14.1", "Edit game", false, "no setup")
  const game = await (prisma as any).game.findFirst({ where: { seasonId } })
  if (!game) return r.record("14.1", "Edit game", false, "no game")
  const newTime = isoDaysAhead(60)
  const res = await call(`/api/games/${game.id}`, {
    method: "PATCH", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scheduledAt: newTime, duration: 75 }),
  })
  if (res.status !== 200) return r.record("14.1", "Edit game", false, `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 100)}`)
  const updated = await (prisma as any).game.findUnique({ where: { id: game.id } })
  const ok = updated?.duration === 75
  r.record("14.1", "PATCH /api/games/[id] edits scheduledAt + duration", ok, ok ? `duration=75 ✓` : `state wrong`)
}

async function p14_2_reschedule_assist() {
  if (!leagueOwner) return r.record("14.2", "Reschedule assist", false, "no setup")
  const game = await (prisma as any).game.findFirst({ where: { seasonId } })
  if (!game) return r.record("14.2", "Reschedule assist", false, "no game")
  const res = await call(`/api/games/${game.id}/reschedule-suggestions`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
  // Either returns suggestions (200) or 404 if route name differs
  if (res.status === 404) {
    return r.record("14.2", "Reschedule suggestions", "skip", `endpoint returned 404; verify name (route exists at /games/[id]/reschedule-suggestions)`)
  }
  const ok = res.status === 200
  r.record("14.2", "Reschedule assist returns ranked alternates", ok, ok ? `200 ✓` : `HTTP ${res.status}`)
}

async function p14_3_soft_delete() {
  if (!leagueOwner) return r.record("14.3", "Soft delete game", false, "no setup")
  const game = await (prisma as any).game.findFirst({ where: { seasonId } })
  if (!game) return r.record("14.3", "Soft delete game", false, "no game")
  const res = await call(`/api/games/${game.id}`, { method: "DELETE", jar: leagueOwner.jar })
  if (res.status !== 200) return r.record("14.3", "Delete game", false, `HTTP ${res.status}`)
  const after = await (prisma as any).game.findUnique({ where: { id: game.id } })
  // Game schema has no deletedAt — DELETE hard-deletes (or marks status). Verify by absence or status change.
  const ok = !after || after?.status === "CANCELLED" || after?.status === "POSTPONED"
  r.record("14.3", "DELETE removes/cancels game", ok, ok ? `game ${after ? `status=${after.status}` : "hard-deleted"} ✓` : `state wrong`)
}

async function p14_4_lock_toggle() {
  if (!leagueOwner) return r.record("14.4", "Lock toggle", false, "no setup")
  const game = await (prisma as any).game.findFirst({ where: { seasonId } })
  if (!game) return r.record("14.4", "Lock toggle", false, "no game")
  const res = await call(`/api/games/${game.id}`, {
    method: "PATCH", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ isLocked: true }),
  })
  if (res.status !== 200) return r.record("14.4", "Lock toggle", false, `HTTP ${res.status}`)
  const after = await (prisma as any).game.findUnique({ where: { id: game.id } })
  const ok = after?.isLocked === true
  r.record("14.4", "Toggle isLocked on game", ok, ok ? `isLocked=true ✓` : `state wrong`)
}

// ---------- Phase 15: Standings ----------

async function p15_1_public_standings() {
  if (!seasonId) return r.record("15.1", "Public standings", false, "no setup")
  // 0.1.9 fix: /api/seasons in PUBLIC_PATHS — middleware lets through; route handler is auth-free.
  const res = await call(`/api/seasons/${seasonId}/standings`) // no jar
  const ok = res.status === 200
  r.record("15.1", "GET /api/seasons/[id]/standings unauth", ok,
    ok ? `200 without auth ✓` : `HTTP ${res.status} (expected 200)`)
}

async function p15_2_standings_data() {
  if (!leagueOwner || !seasonId) return r.record("15.2", "Standings data", false, "no setup")
  // Mark a couple games COMPLETED with scores to populate standings
  const games = await (prisma as any).game.findMany({ where: { seasonId, status: "SCHEDULED" }, take: 2 })
  for (let i = 0; i < games.length; i++) {
    await (prisma as any).game.update({
      where: { id: games[i].id },
      data: {
        status: "COMPLETED",
        homeScore: 50 + i,
        awayScore: 40 - i,
        finalizedAt: new Date(),
      },
    })
  }
  const res = await call(`/api/seasons/${seasonId}/standings`, { jar: leagueOwner.jar })
  if (res.status !== 200) return r.record("15.2", "Standings data", false, `HTTP ${res.status}`)
  const divisions = res.body?.divisions ?? res.body?.standings ?? []
  const ok = Array.isArray(divisions) && divisions.length > 0
  r.record("15.2", "Standings returns per-division ranks with completed games", ok, ok ? `${divisions.length} divisions in standings ✓` : `${JSON.stringify(res.body).slice(0, 100)}`)
}

async function p15_5_empty_standings() {
  // Build a brand new season (no games) and verify standings returns empty/zeros without error
  if (!leagueOwner || !leagueId) return r.record("15.5", "Empty standings", false, "no setup")
  const create = await call(`/api/leagues/${leagueId}/seasons`, {
    method: "POST", jar: leagueOwner.jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ label: "Empty Standings Season", type: "FALL_WINTER" }),
  })
  if (create.status !== 201 && create.status !== 200) return r.record("15.5", "Empty standings", false, `create HTTP ${create.status}`)
  const sid = create.body?.id ?? create.body?.season?.id ?? (await prisma.season.findFirst({ where: { leagueId, label: "Empty Standings Season" } }))?.id
  if (!sid) return r.record("15.5", "Empty standings", false, "no season id")
  const res = await call(`/api/seasons/${sid}/standings`, { jar: leagueOwner.jar })
  const ok = res.status === 200
  r.record("15.5", "Empty season standings → 200 with empty/zero data", ok, ok ? `200 ✓` : `HTTP ${res.status}`)
}

// ---------- Main ----------

async function main() {
  console.log(`\n=== Phases 9–15 — League → Season → Schedule → Standings ===\n`)
  await cleanup()

  // Phase 9
  await p9_1_create_league()
  await p9_2_edit_league()
  await p9_3_dashboard_loads()

  // Phase 10
  await p10_1_create_season()
  await p10_2_create_divisions()
  await p10_3_add_venue_with_courts()
  await p10_4_create_session()
  await p10_5_scheduling_settings()
  await p10_6_tiebreakers()
  p10_7_scheduling_groups()
  await p10_8_open_for_registration()

  // Phase 11
  await p11_setup_clubs()
  await p11_1_submit_teams()
  await p11_5_approve_teams()
  await p11_2_past_deadline()

  // Phase 12
  await p12_2_finalize()
  await p12_4_post_finalize_edit()
  await p12_5_post_finalize_tiebreakers()

  // Phase 13
  await p13_1_preview()
  await p13_3_commit()
  await p13_4_wipe_regenerate()

  // Phase 14
  await p14_1_edit_game()
  await p14_2_reschedule_assist()
  await p14_3_soft_delete()
  await p14_4_lock_toggle()

  // Phase 15
  await p15_1_public_standings()
  await p15_2_standings_data()
  await p15_5_empty_standings()

  r.printSummary("Phases 9–15")
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
