import { prisma } from "@youthbasketballhub/db"
import { type WorldContext } from "../context"
import { daysFromNow, teamName } from "../rng"
import { createUser, createParentWithChildren, type BuiltUser } from "./users"
import { createClub, type BuiltClub } from "./clubs"

/**
 * League-side builders — the H/I/J scenario worlds (registration, scheduling,
 * chaos). A season world is: League → Season → Divisions + Venue/Courts +
 * Sessions/Days/DayVenues, with feeder clubs whose teams are submitted into
 * divisions. Submissions mirror the product route exactly (TeamSubmission +
 * frozen SeasonRoster snapshot of ACTIVE TeamPlayers) so downstream code
 * can't tell a built world from a user-created one.
 */

export type SeasonStatusSpec =
  | "DRAFT"
  | "REGISTRATION"
  | "REGISTRATION_CLOSED"
  | "FINALIZED"
  | "IN_PROGRESS"
  | "COMPLETED"

export interface DivisionSpec {
  name?: string
  ageGroup?: string
  gender?: "MALE" | "FEMALE" | "COED"
  tier?: number
  maxTeams?: number
  /** Feeder teams auto-created in the season's feeder club and submitted here. */
  teams?: number
  /** ACTIVE TeamPlayers per feeder team, snapshotted into the season roster. */
  rosterSize?: number
  submissionStatus?: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN"
}

export interface SessionSpec {
  /** Consecutive session days. Default 2. */
  days?: number
  /** First day is `startInDays` from now (relative — no time bombs). Default 7. */
  startInDays?: number
  phase?: "REGULAR" | "PLAYOFF"
  /** Day-venue window; falls back to the venue-less season defaults. */
  open?: string
  close?: string
}

export interface SeasonSpec {
  label?: string
  status?: SeasonStatusSpec
  gamesGuaranteed?: number
  gameSlotMinutes?: number
  gameLengthMinutes?: number
  idealGamesPerDayPerTeam?: number
  schedulingPhilosophy?: "FAMILY_FRIENDLY" | "SPREAD_DAYS"
  allowCrossDivisionScheduling?: boolean
  /** Days from now; negative = already passed. Default +14. */
  registrationDeadlineInDays?: number
  teamFee?: number
  divisions?: DivisionSpec[]
  /** One venue linked via SeasonVenue, with courts + 7-day hours. Default 2 courts. */
  venue?: { courts?: number; open?: string; close?: string } | false
  /** REGULAR sessions with every court wired into each day. Default one 2-day session. */
  sessions?: SessionSpec[]
  /** Cross-division groups by division index. */
  schedulingGroups?: { name?: string; divisions: number[] }[]
}

export interface BuiltSubmission {
  submissionId: string
  rosterId: string
  teamId: string
  teamName: string
  divisionId: string
  playerIds: string[]
}

export interface BuiltDivision {
  id: string
  name: string
  ageGroup: string
  submissions: BuiltSubmission[]
}

export interface BuiltVenue {
  id: string
  name: string
  courtIds: string[]
}

export interface BuiltSession {
  id: string
  phase: "REGULAR" | "PLAYOFF"
  days: { id: string; date: Date; dayVenueId: string | null }[]
}

export interface BuiltSeason {
  id: string
  label: string
  status: SeasonStatusSpec
  divisions: BuiltDivision[]
  venue: BuiltVenue | null
  sessions: BuiltSession[]
  schedulingGroupIds: string[]
  /** The club whose teams were auto-submitted into this season. */
  feederClub: BuiltClub | null
}

export interface BuiltLeague {
  id: string
  name: string
  owner: BuiltUser
  seasons: BuiltSeason[]
}

export async function createLeague(
  ctx: WorldContext,
  opts: { owner?: BuiltUser; seasons?: SeasonSpec[] } = {}
): Promise<BuiltLeague> {
  const owner = opts.owner ?? (await createUser(ctx, { localPart: "leagueowner" }))
  const league = await prisma.league.create({
    data: {
      name: ctx.name(`${teamName(ctx.rng)} League`),
      ownerId: owner.id,
    },
  })
  await prisma.userRole.create({
    data: { userId: owner.id, role: "LeagueOwner", leagueId: league.id },
  })

  const seasons: BuiltSeason[] = []
  for (const spec of opts.seasons ?? []) {
    seasons.push(await createSeason(ctx, { leagueId: league.id, ...spec }))
  }
  return { id: league.id, name: league.name, owner, seasons }
}

export async function createVenue(
  ctx: WorldContext,
  opts: { courts?: number; open?: string; close?: string } = {}
): Promise<BuiltVenue> {
  const venue = await prisma.venue.create({
    data: {
      name: ctx.name(`Venue ${ctx.next()}`),
      address: "1 Test Court",
      city: "Toronto",
      state: "ON",
      country: "CA",
    },
  })
  const courtIds: string[] = []
  for (let i = 1; i <= (opts.courts ?? 2); i++) {
    const court = await prisma.court.create({
      data: { venueId: venue.id, name: `Court ${i}`, displayOrder: i },
    })
    courtIds.push(court.id)
  }
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    await prisma.venueHours.create({
      data: {
        venueId: venue.id,
        dayOfWeek,
        openTime: opts.open ?? "09:00",
        closeTime: opts.close ?? "21:00",
      },
    })
  }
  return { id: venue.id, name: venue.name, courtIds }
}

export async function createSeason(
  ctx: WorldContext,
  opts: SeasonSpec & { leagueId: string }
): Promise<BuiltSeason> {
  const status = opts.status ?? "REGISTRATION"
  const label = opts.label ?? `Season ${ctx.next()}`
  const structureLocked = ["FINALIZED", "IN_PROGRESS", "COMPLETED"].includes(status)

  const season = await prisma.season.create({
    data: {
      leagueId: opts.leagueId,
      label,
      status: status as any,
      registrationDeadline: daysFromNow(opts.registrationDeadlineInDays ?? 14),
      teamFee: opts.teamFee ?? null,
      gamesGuaranteed: opts.gamesGuaranteed ?? 3,
      gameSlotMinutes: opts.gameSlotMinutes ?? 60,
      gameLengthMinutes: opts.gameLengthMinutes ?? 50,
      idealGamesPerDayPerTeam: opts.idealGamesPerDayPerTeam ?? 2,
      schedulingPhilosophy: (opts.schedulingPhilosophy ?? "FAMILY_FRIENDLY") as any,
      allowCrossDivisionScheduling: opts.allowCrossDivisionScheduling ?? false,
      tiebreakersLockedAt: structureLocked ? new Date() : null,
    },
  })

  // Divisions
  const divisionSpecs = opts.divisions ?? [{ teams: 4 }]
  const divisions: BuiltDivision[] = []
  for (let i = 0; i < divisionSpecs.length; i++) {
    const d = divisionSpecs[i]
    const division = await prisma.division.create({
      data: {
        seasonId: season.id,
        name: d.name ?? `Division ${i + 1}`,
        ageGroup: d.ageGroup ?? "U12",
        gender: (d.gender ?? "MALE") as any,
        tier: d.tier ?? 1,
        maxTeams: d.maxTeams ?? null,
      },
    })
    divisions.push({ id: division.id, name: division.name, ageGroup: division.ageGroup, submissions: [] })
  }

  // Feeder club + submitted teams
  const teamsWanted = divisionSpecs.reduce((sum, d) => sum + (d.teams ?? 0), 0)
  let feederClub: BuiltClub | null = null
  if (teamsWanted > 0) {
    feederClub = await createClub(ctx, {})
    for (let i = 0; i < divisionSpecs.length; i++) {
      const d = divisionSpecs[i]
      for (let t = 0; t < (d.teams ?? 0); t++) {
        const submission = await submitTeamToSeason(ctx, {
          seasonId: season.id,
          divisionId: divisions[i].id,
          tenantId: feederClub.tenantId,
          ageGroup: d.ageGroup ?? "U12",
          seasonLabel: label,
          rosterSize: d.rosterSize ?? 8,
          status: d.submissionStatus ?? "APPROVED",
          lockRoster: structureLocked,
        })
        divisions[i].submissions.push(submission)
      }
    }
  }

  // Venue + courts + hours
  const venue = opts.venue === false ? null : await createVenue(ctx, opts.venue ?? {})
  if (venue) {
    await prisma.seasonVenue.create({
      data: { seasonId: season.id, venueId: venue.id, isPrimary: true },
    })
  }

  // Sessions / days / day-venues / day-venue-courts
  const sessionSpecs = opts.sessions ?? [{ days: 2 }]
  const sessions: BuiltSession[] = []
  for (const s of sessionSpecs) {
    const session = await prisma.seasonSession.create({
      data: {
        seasonId: season.id,
        label: `Session ${ctx.next()}`,
        phase: (s.phase ?? "REGULAR") as any,
      },
    })
    const days: BuiltSession["days"] = []
    const start = s.startInDays ?? 7
    for (let d = 0; d < (s.days ?? 2); d++) {
      const date = daysFromNow(start + d, 0)
      const day = await prisma.seasonSessionDay.create({
        data: { sessionId: session.id, date },
      })
      let dayVenueId: string | null = null
      if (venue) {
        const dayVenue = await prisma.seasonSessionDayVenue.create({
          data: {
            dayId: day.id,
            venueId: venue.id,
            startTime: s.open ?? "09:00",
            endTime: s.close ?? "17:00",
          },
        })
        dayVenueId = dayVenue.id
        for (const courtId of venue.courtIds) {
          await prisma.seasonSessionDayVenueCourt.create({
            data: { dayVenueId: dayVenue.id, courtId },
          })
        }
      }
      days.push({ id: day.id, date, dayVenueId })
    }
    sessions.push({ id: session.id, phase: (s.phase ?? "REGULAR") as any, days })
  }

  // Cross-division scheduling groups
  const schedulingGroupIds: string[] = []
  for (const g of opts.schedulingGroups ?? []) {
    const group = await prisma.schedulingGroup.create({
      data: { seasonId: season.id, name: g.name ?? `Group ${ctx.next()}` },
    })
    for (const divisionIndex of g.divisions) {
      const division = divisions[divisionIndex]
      if (!division) throw new Error(`schedulingGroups: no division at index ${divisionIndex}`)
      await prisma.schedulingGroupDivision.create({
        data: { schedulingGroupId: group.id, divisionId: division.id },
      })
    }
    schedulingGroupIds.push(group.id)
  }

  return { id: season.id, label, status, divisions, venue, sessions, schedulingGroupIds, feederClub }
}

/**
 * Submit a fresh feeder team into a division — same writes as
 * POST /api/seasons/[id]/submit: Team (+ ACTIVE TeamPlayers) then
 * TeamSubmission + SeasonRoster with the frozen player snapshot.
 */
export async function submitTeamToSeason(
  ctx: WorldContext,
  opts: {
    seasonId: string
    divisionId: string
    tenantId: string
    ageGroup: string
    seasonLabel: string
    rosterSize: number
    status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN"
    lockRoster?: boolean
  }
): Promise<BuiltSubmission> {
  const team = await prisma.team.create({
    data: {
      tenantId: opts.tenantId,
      name: ctx.name(`${teamName(ctx.rng)} ${ctx.next()}`),
      ageGroup: opts.ageGroup,
      gender: "MALE",
      season: opts.seasonLabel,
    },
  })

  const playerIds: string[] = []
  if (opts.rosterSize > 0) {
    const { players } = await createParentWithChildren(ctx, {
      children: Array.from({ length: opts.rosterSize }, () => ({ age: 11 })),
    })
    for (let i = 0; i < players.length; i++) {
      await prisma.teamPlayer.create({
        data: {
          teamId: team.id,
          playerId: players[i].id,
          status: "ACTIVE",
          jerseyNumber: i + 4,
        },
      })
      playerIds.push(players[i].id)
    }
  }

  const submission = await prisma.teamSubmission.create({
    data: {
      seasonId: opts.seasonId,
      teamId: team.id,
      divisionId: opts.divisionId,
      status: opts.status as any,
    },
  })
  const roster = await prisma.seasonRoster.create({
    data: {
      seasonId: opts.seasonId,
      teamSubmissionId: submission.id,
      isLocked: opts.lockRoster ?? false,
      submittedAt: new Date(),
      lockedAt: opts.lockRoster ? new Date() : null,
    },
  })
  if (playerIds.length > 0) {
    await prisma.seasonRosterPlayer.createMany({
      data: playerIds.map((playerId, i) => ({
        rosterId: roster.id,
        playerId,
        jerseyNumber: i + 4,
      })),
    })
  }

  return {
    submissionId: submission.id,
    rosterId: roster.id,
    teamId: team.id,
    teamName: team.name,
    divisionId: opts.divisionId,
    playerIds,
  }
}
