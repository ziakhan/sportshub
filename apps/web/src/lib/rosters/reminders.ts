// Roster-deadline reminders (owner ruling 2026-08-11, QA T-017): an approved
// team entry with no real roster is a ghost the schedule must plan around, so
// rosters get chased to the league's existing roster deadline (the season's
// registration deadline, season → org rulebook — never a new field) with an
// escalating, self-healing cadence:
//
//   T-30 days  email only
//   T-14 days  email + bell
//   T-7 days   email + bell + push, and the league operator's digest
//   T-24 hours urgent tone, all channels
//   day after  overdue: all channels, club owner/manager added, second digest
//
// Platform-wide defaults on purpose — the owner ruled leagues are NOT to be
// burdened with reminder settings; chasing rosters is our responsibility.
// Every touch is data-driven: a finalized-and-submitted roster silently ends
// the cadence, a finalized-but-unsubmitted one keeps only submission-focused
// touches, and RosterReminder rows make each (season, team, window) send-once
// — mirroring the WaiverReminder ledger — so a late-set deadline or a missed
// cron day never double-sends. Runs from /api/cron/roster-reminders daily.

import { prisma } from "@youthbasketballhub/db"
import { notifySafe } from "@/lib/notifications"
import { appBaseUrl, sendRosterDigestEmail, sendRosterReminderEmail } from "@/lib/email"
import { isRosterFinal, isRosterSubmitted, effectiveRosterDeadline } from "./roster-deadline"

const DAY_MS = 24 * 60 * 60 * 1000

type ReminderWindow = "t30" | "t14" | "t7" | "t24h" | "overdue"

/** Pre-deadline windows, widest first. The narrowest applicable one wins, so
 *  a season first seen inside T-7 gets exactly one touch, not three. */
const PRE_WINDOWS: Array<{ key: ReminderWindow; leadMs: number }> = [
  { key: "t30", leadMs: 30 * DAY_MS },
  { key: "t14", leadMs: 14 * DAY_MS },
  { key: "t7", leadMs: 7 * DAY_MS },
  { key: "t24h", leadMs: DAY_MS },
]

/** Seasons whose deadline is further behind than this stop being checked at
 *  all — the overdue touch is one-time and long gone by then. */
const LOOKBACK_MS = 45 * DAY_MS

/** The reminder window that applies right now, or null (including the quiet
 *  gap between the deadline itself and the day-after overdue touch). */
export function reminderWindowFor(deadline: Date, now: Date): ReminderWindow | null {
  const untilDeadline = deadline.getTime() - now.getTime()
  if (untilDeadline <= -DAY_MS) return "overdue"
  if (untilDeadline <= 0) return null
  let window: ReminderWindow | null = null
  for (const w of PRE_WINDOWS) {
    if (untilDeadline <= w.leadMs) window = w.key
  }
  return window
}

/** The deadline as the calendar date the operator picked. Deadlines are
 *  stored as date-only UTC midnights, so format in UTC — a local-time render
 *  would say "Sep 30" for an October 1 deadline. */
function deadlineText(deadline: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(deadline)
}

export interface RosterReminderResult {
  seasonsChecked: number
  remindersSent: number
  digestsSent: number
  skippedAlreadySent: number
  healed: number
}

interface Recipient {
  id: string
  email: string | null
  firstName: string | null
}

/**
 * Who gets chased (owner ruling 2026-08-11): team staff on every touch; the
 * club owner and club manager ONLY on the day-after-overdue touch. A team
 * with no team-scoped staff at all falls back to the club leaders on every
 * touch — otherwise the most neglected teams would be exactly the silent ones.
 */
async function chaseRecipients(
  teamId: string,
  tenantId: string,
  includeClubLeaders: boolean
): Promise<Recipient[]> {
  const staffRows = await (prisma as any).userRole.findMany({
    where: { teamId, role: { in: ["Staff", "TeamManager"] } },
    select: { userId: true },
    distinct: ["userId"],
  })
  const ids = new Set<string>(staffRows.map((r: any) => r.userId))
  if (includeClubLeaders || ids.size === 0) {
    const leaders = await (prisma as any).userRole.findMany({
      where: { tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
      select: { userId: true },
      distinct: ["userId"],
    })
    for (const r of leaders) ids.add(r.userId)
  }
  if (ids.size === 0) return []
  return (await (prisma as any).user.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, email: true, firstName: true },
  })) as Recipient[]
}

/** The league's operators: the owner plus league-scoped manager roles. */
async function leagueOperators(leagueId: string, ownerId: string | null): Promise<Recipient[]> {
  const roles = await (prisma as any).userRole.findMany({
    where: { leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
    select: { userId: true },
    distinct: ["userId"],
  })
  const ids = new Set<string>(roles.map((r: any) => r.userId))
  if (ownerId) ids.add(ownerId)
  if (ids.size === 0) return []
  return (await (prisma as any).user.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, email: true, firstName: true },
  })) as Recipient[]
}

/** Send-once claim: creating the ledger row IS the lock (WaiverReminder
 *  pattern). False = another run already covered this window. */
async function claim(seasonId: string, teamSubmissionId: string, window: string): Promise<boolean> {
  try {
    await (prisma as any).rosterReminder.create({
      data: { seasonId, teamSubmissionId, window },
    })
    return true
  } catch {
    return false
  }
}

export async function sendRosterReminders(now: Date = new Date()): Promise<RosterReminderResult> {
  const result: RosterReminderResult = {
    seasonsChecked: 0,
    remindersSent: 0,
    digestsSent: 0,
    skippedAlreadySent: 0,
    healed: 0,
  }

  // Chaseable seasons: rosters still move. A FINALIZED season bulk-locked its
  // rosters, so there is nothing left to chase there. The deadline resolves
  // in code (season → org rulebook), so the query stays broad and cheap.
  const seasons = (await (prisma as any).season.findMany({
    where: {
      status: { in: ["REGISTRATION", "REGISTRATION_CLOSED"] },
      teamSubmissions: { some: { status: { in: ["PENDING", "APPROVED"] } } },
    },
    select: {
      id: true,
      label: true,
      registrationDeadline: true,
      league: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          organization: { select: { seasonDefaults: true } },
        },
      },
    },
  })) as any[]

  const base = appBaseUrl()

  for (const season of seasons) {
    const deadline = effectiveRosterDeadline(season, season.league?.organization?.seasonDefaults)
    // No deadline = the system stays silent for this season (owner ruling).
    if (!deadline) continue
    if (now.getTime() - deadline.getTime() > LOOKBACK_MS) continue

    const window = reminderWindowFor(deadline, now)
    if (!window) continue
    result.seasonsChecked++

    const submissions = (await (prisma as any).teamSubmission.findMany({
      where: { seasonId: season.id, status: { in: ["PENDING", "APPROVED"] } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        teamId: true,
        team: { select: { id: true, name: true, tenantId: true, tenant: { select: { name: true } } } },
        roster: {
          select: {
            finalizedAt: true,
            isLocked: true,
            submittedAt: true,
            _count: { select: { players: true } },
          },
        },
      },
    })) as any[]

    const when = deadlineText(deadline)
    const laggards: Array<{ name: string; clubName: string | null; playerCount: number }> = []

    for (const submission of submissions) {
      const final = isRosterFinal(submission.roster)
      const submitted = isRosterSubmitted(submission.roster)
      // Self-healing: a finalized, submitted roster ends the cadence in
      // silence. Finalized but never submitted keeps only the
      // submission-focused touch below.
      if (final && submitted) {
        result.healed++
        continue
      }
      const playerCount = submission.roster?._count?.players ?? 0
      laggards.push({
        name: submission.team?.name ?? "Team",
        clubName: submission.team?.tenant?.name ?? null,
        playerCount,
      })

      if (!(await claim(season.id, submission.id, window))) {
        result.skippedAlreadySent++
        continue
      }

      const focus: "finalize" | "submit" = final && !submitted ? "submit" : "finalize"
      const link = `/clubs/${submission.team.tenantId}/teams/${submission.teamId}/league-rosters?submission=${submission.id}`
      const recipients = await chaseRecipients(
        submission.teamId,
        submission.team.tenantId,
        window === "overdue"
      )

      const countClause = `${playerCount} player${playerCount === 1 ? "" : "s"} on the roster`
      const title =
        window === "overdue"
          ? `Roster overdue: ${submission.team.name}`
          : window === "t24h"
            ? `Roster due tomorrow: ${submission.team.name}`
            : `Roster due ${when}: ${submission.team.name}`
      const message =
        focus === "submit"
          ? `${season.league.name} ${season.label}: the roster is finalized (${countClause}) but has not been submitted to the league. Submit it before ${when}.`
          : window === "overdue"
            ? `${season.league.name} ${season.label}: the roster deadline (${when}) has passed with ${countClause}. Until it is finalized, the schedule is planned without ${submission.team.name}.`
            : `${season.league.name} ${season.label}: ${countClause}, due ${when}. Finalize it so the league can plan with your team.`

      for (const recipient of recipients) {
        // T-30 is email only; the bell starts at T-14, push at T-7 (the
        // urgent type), so phones are not nagged a month out.
        if (window !== "t30") {
          await notifySafe({
            userId: recipient.id,
            type: window === "t14" ? "roster_reminder" : "roster_reminder_urgent",
            title,
            message,
            link,
            referenceId: submission.id,
            referenceType: "TeamSubmission",
          })
        }
        if (recipient.email) {
          try {
            await sendRosterReminderEmail({
              to: recipient.email,
              staffName: recipient.firstName,
              teamName: submission.team.name,
              leagueName: season.league.name,
              seasonLabel: season.label,
              deadlineText: when,
              playerCount,
              window,
              focus,
              link: `${base}${link}`,
            })
          } catch (error) {
            console.error("Roster reminder email failed:", recipient.email, error)
          }
        }
      }
      result.remindersSent++
    }

    // League-operator digest at T-7 and the day after (owner ruling): "N
    // teams still un-rostered", so the operator chases humans. Send-once via
    // its own ledger row (synthetic teamSubmissionId).
    if ((window === "t7" || window === "overdue") && laggards.length > 0) {
      const digestWindow = window === "t7" ? "digest_t7" : "digest_overdue"
      if (await claim(season.id, "digest", digestWindow)) {
        const operators = await leagueOperators(season.league.id, season.league.ownerId)
        const link = `/manage/leagues/${season.league.id}/seasons/${season.id}/manage`
        const names = laggards.map((t) => t.name).join(", ")
        for (const operator of operators) {
          await notifySafe({
            userId: operator.id,
            type: "roster_digest",
            title:
              window === "overdue"
                ? `${laggards.length} team${laggards.length === 1 ? "" : "s"} missed the roster deadline`
                : `${laggards.length} team${laggards.length === 1 ? "" : "s"} still un-rostered`,
            message: `${season.league.name} ${season.label}: ${names}. Rosters ${window === "overdue" ? "were due" : "are due"} ${when}.`,
            link,
            referenceId: season.id,
            referenceType: "Season",
          })
          if (operator.email) {
            try {
              await sendRosterDigestEmail({
                to: operator.email,
                operatorName: operator.firstName,
                leagueName: season.league.name,
                seasonLabel: season.label,
                deadlineText: when,
                overdue: window === "overdue",
                teams: laggards,
                link: `${base}${link}`,
              })
            } catch (error) {
              console.error("Roster digest email failed:", operator.email, error)
            }
          }
        }
        result.digestsSent++
      } else {
        result.skippedAlreadySent++
      }
    }
  }

  return result
}

/**
 * The enforcement notice (owner ruling 2026-08-11): when the league generates
 * or publishes a season plan while teams stand excluded (deadline passed,
 * roster not finalized), those teams hear it in plain words — the season was
 * planned without them, and what to do next. Send-once per (team, season) via
 * the "planned_without" ledger window, so generate-then-publish tells a team
 * exactly once. Best-effort by design: callers fire and forget.
 */
export async function notifyPlannedWithoutTeams(seasonId: string): Promise<number> {
  const { listRosterDrawExclusions } = await import("./roster-deadline")
  const gate = await listRosterDrawExclusions(seasonId)
  if (!gate || gate.excluded.length === 0) return 0

  const season = (await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: { label: true, league: { select: { name: true } } },
  })) as any
  if (!season) return 0

  const when = deadlineText(gate.deadline)
  let sent = 0
  for (const team of gate.excluded) {
    if (!(await claim(seasonId, team.submissionId, "planned_without"))) continue
    const recipients = await chaseRecipients(team.teamId, team.tenantId, true)
    const link = `/clubs/${team.tenantId}/teams/${team.teamId}/league-rosters?submission=${team.submissionId}`
    for (const recipient of recipients) {
      await notifySafe({
        userId: recipient.id,
        type: "season_planned_without_team",
        title: `Season planned without ${team.teamName}`,
        message: `${season.league.name} ${season.label} was planned without ${team.teamName} because its roster was not finalized by ${when}. Finalize the roster (${team.playerCount} player${team.playerCount === 1 ? "" : "s"} now) and contact the league to be added back in.`,
        link,
        referenceId: team.submissionId,
        referenceType: "TeamSubmission",
      })
    }
    sent++
  }
  return sent
}
