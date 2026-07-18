import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { getPublicSeason } from "@/lib/queries/season"
import { notifyMany } from "@/lib/notifications"
import { sendSeasonReviewInvites } from "@/lib/reviews/invites"
import { sendEmail, appBaseUrl, escapeHtml, transactionalFooter } from "@/lib/email"

export const dynamic = "force-dynamic"

/**
 * GET /api/seasons/[id] — Get season details (includes league, divisions, team submissions, counts)
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const season = await getPublicSeason(params.id)

    if (!season) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(season)
  } catch (error) {
    console.error("Get season error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/seasons/[id] — Update season fields (scheduling, pricing, status)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { status: true, leagueId: true, league: { select: { ownerId: true } } },
    })
    if (!season) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const isOwner = season.league.ownerId === sessionInfo.userId
    if (!isOwner && !sessionInfo.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    // Season lifecycle is one-way (owner decision 2026-07-09 — finalize is
    // irreversible; its side-effects have no undo). The API used to accept ANY
    // status jump, including backward "reopens" that left rosters locked.
    // Rules: never backward, and never leapfrog FINALIZED (that would skip the
    // preflight + roster locks, which run only when the target is FINALIZED).
    // Forward shortcuts on either side of it (e.g. REGISTRATION → FINALIZED)
    // are fine — closing registration has no side-effects of its own.
    const STATUS_ORDER = [
      "DRAFT",
      "REGISTRATION",
      "REGISTRATION_CLOSED",
      "FINALIZED",
      "IN_PROGRESS",
      "COMPLETED",
    ]
    if (body.status !== undefined && body.status !== season.status) {
      const from = STATUS_ORDER.indexOf(season.status)
      const to = STATUS_ORDER.indexOf(body.status)
      const FINALIZED_AT = STATUS_ORDER.indexOf("FINALIZED")
      if (to === -1) {
        return NextResponse.json({ error: `Unknown season status: ${body.status}` }, { status: 400 })
      }
      if (to < from) {
        return NextResponse.json(
          {
            error: `Season status can't move backward (${season.status} → ${body.status}) — finalization is one-way.`,
          },
          { status: 409 }
        )
      }
      if (from < FINALIZED_AT && to > FINALIZED_AT) {
        return NextResponse.json(
          { error: "Season must be finalized before it can start — finalize runs the preflight and locks rosters." },
          { status: 409 }
        )
      }
    }

    const update: Record<string, any> = {}

    // Tiebreaker order locks at finalize via tiebreakersLockedAt. Reject any
    // attempt to mutate it after the lock is set.
    if (body.tiebreakerOrder !== undefined) {
      const seasonLock = await (prisma as any).season.findUnique({
        where: { id: params.id },
        select: { tiebreakersLockedAt: true },
      })
      if (seasonLock?.tiebreakersLockedAt) {
        return NextResponse.json(
          {
            error: "Tiebreakers are locked for this season and cannot be edited.",
            tiebreakersLockedAt: seasonLock.tiebreakersLockedAt,
          },
          { status: 409 }
        )
      }
    }

    if (body.label !== undefined) update.label = body.label
    const passThrough = [
      "type",
      "status",
      "gamesGuaranteed",
      "gameSlotMinutes",
      "gameLengthMinutes",
      "gamePeriods",
      "periodLengthMinutes",
      "targetGamesPerSession",
      "idealGamesPerDayPerTeam",
      "defaultVenueOpenTime",
      "defaultVenueCloseTime",
      "playoffFormat",
      "playoffTeams",
      "schedulingPhilosophy",
      "allowCrossDivisionScheduling",
      "tiebreakerOrder",
      "rosterChangePolicy",
    ]
    for (const field of passThrough) {
      if (body[field] !== undefined) update[field] = body[field]
    }
    if (body.teamFee !== undefined) update.teamFee = body.teamFee
    if (body.startDate) update.startDate = new Date(body.startDate)
    if (body.endDate) update.endDate = new Date(body.endDate)
    if (body.registrationDeadline) update.registrationDeadline = new Date(body.registrationDeadline)
    if (body.rosterChangeDeadline !== undefined) {
      update.rosterChangeDeadline = body.rosterChangeDeadline
        ? new Date(body.rosterChangeDeadline)
        : null
    }
    if (body.ageGroupCutoffDate) update.ageGroupCutoffDate = new Date(body.ageGroupCutoffDate)

    let finalizeWarnings: string[] = []

    // Preflight + lock when transitioning to FINALIZED
    if (body.status === "FINALIZED") {
      const preflight = await (prisma as any).season.findUnique({
        where: { id: params.id },
        include: {
          divisions: {
            select: {
              id: true,
              name: true,
              schedulingGroups: { select: { schedulingGroupId: true } },
              _count: {
                select: {
                  teamSubmissions: {
                    where: { status: { in: ["PENDING", "APPROVED"] } },
                  },
                },
              },
            },
          },
          sessions: {
            select: {
              id: true,
              label: true,
              days: {
                select: {
                  id: true,
                  dayVenues: {
                    select: {
                      id: true,
                      startTime: true,
                      endTime: true,
                      courts: { select: { id: true } },
                    },
                  },
                },
              },
            },
          },
          seasonVenues: { select: { id: true } },
          teamSubmissions: { select: { id: true, status: true } },
          schedulingGroups: {
            select: { id: true, divisions: { select: { divisionId: true } } },
          },
        },
      })

      const effective = { ...(preflight as any), ...update }
      const missing: string[] = []
      const warnings: string[] = []

      if (!effective.gamesGuaranteed)
        missing.push("Max games per team per season must be set in Scheduling Settings")
      if (!effective.periodLengthMinutes)
        missing.push("Period / half length (minutes) must be set in Scheduling Settings")
      if (preflight.divisions.length === 0) missing.push("At least one division is required")
      if (preflight.sessions.length === 0) missing.push("At least one game session is required")
      if (preflight.seasonVenues.length === 0) missing.push("At least one venue must be assigned")
      const pendingCount = preflight.teamSubmissions.filter(
        (t: any) => t.status === "PENDING"
      ).length
      if (pendingCount > 0)
        missing.push(
          `${pendingCount} team(s) are still pending — approve or reject all teams first`
        )

      // NEW: every session has ≥1 day with ≥1 day-venue with ≥1 court
      for (const s of preflight.sessions as any[]) {
        const hasUsableDay = (s.days ?? []).some((d: any) =>
          (d.dayVenues ?? []).some((dv: any) => (dv.courts ?? []).length > 0)
        )
        if (!hasUsableDay) {
          missing.push(
            `Session "${s.label || s.id.slice(0, 6)}" needs at least one day with a venue and court`
          )
        }
      }

      // NEW: tiebreaker order non-empty
      const effectiveTiebreakers: string[] = Array.isArray(effective.tiebreakerOrder)
        ? effective.tiebreakerOrder
        : []
      if (effectiveTiebreakers.length === 0)
        missing.push(
          "Tiebreaker order is empty — configure at least one rule in the Tiebreakers tab"
        )

      // NEW: every division in a scheduling group has ≥2 teams (only when cross-division scheduling is on)
      if (effective.allowCrossDivisionScheduling) {
        const divisionById = new Map<string, any>()
        for (const d of preflight.divisions as any[]) divisionById.set(d.id, d)
        const groupedDivisionIds = new Set<string>()
        for (const g of (preflight.schedulingGroups ?? []) as any[]) {
          for (const link of g.divisions ?? []) groupedDivisionIds.add(link.divisionId)
        }
        for (const divId of groupedDivisionIds) {
          const d = divisionById.get(divId)
          const teamCount = d?._count?.teamSubmissions ?? 0
          if (teamCount < 2) {
            missing.push(
              `Division "${d?.name ?? divId}" is in a scheduling group but has ${teamCount} team(s) — needs at least 2`
            )
          }
        }
      }

      // NEW (G5): warning — a division with fewer than 2 teams that isn't
      // pooled into a cross-division group can never be scheduled; the
      // generator silently drops it. Non-blocking by owner decision.
      for (const d of preflight.divisions as any[]) {
        const teamCount = d?._count?.teamSubmissions ?? 0
        const pooled =
          effective.allowCrossDivisionScheduling && (d.schedulingGroups ?? []).length > 0
        if (!pooled && teamCount < 2) {
          warnings.push(
            `Division "${d.name}" has ${teamCount} team(s) — the scheduler will skip it (needs at least 2).`
          )
        }
      }

      // NEW: feasibility warning — court-minutes available vs. required
      const gameSlotMinutes: number = effective.gameSlotMinutes ?? 90
      const gamesGuaranteed: number = effective.gamesGuaranteed ?? 0
      const approvedTeamCount = preflight.teamSubmissions.filter(
        (t: any) => t.status === "APPROVED"
      ).length

      // NEW (H17): a season with zero approved teams has nothing to schedule
      if (approvedTeamCount === 0) {
        missing.push("No approved teams — approve at least one team before finalizing")
      }
      const requiredGameCount = Math.ceil((approvedTeamCount * gamesGuaranteed) / 2)
      const requiredCourtMinutes = requiredGameCount * gameSlotMinutes

      const parseHHMM = (hhmm?: string | null): number | null => {
        if (!hhmm) return null
        const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
        if (!m) return null
        return parseInt(m[1]) * 60 + parseInt(m[2])
      }
      let availableCourtMinutes = 0
      for (const s of preflight.sessions as any[]) {
        for (const d of s.days ?? []) {
          for (const dv of d.dayVenues ?? []) {
            const start = parseHHMM(dv.startTime) ?? parseHHMM(effective.defaultVenueOpenTime)
            const end = parseHHMM(dv.endTime) ?? parseHHMM(effective.defaultVenueCloseTime)
            const window = start !== null && end !== null ? Math.max(0, end - start) : 0
            availableCourtMinutes += window * (dv.courts?.length ?? 0)
          }
        }
      }
      if (requiredCourtMinutes > 0 && availableCourtMinutes < requiredCourtMinutes) {
        warnings.push(
          `Feasibility: ~${requiredCourtMinutes} court-minutes needed for ${requiredGameCount} games, but only ${availableCourtMinutes} are configured. The scheduler may leave games unplaced.`
        )
      }

      if (missing.length > 0) {
        return NextResponse.json(
          { error: "Cannot finalize: requirements not met", missing, warnings },
          { status: 422 }
        )
      }

      await (prisma as any).seasonRoster.updateMany({
        where: { seasonId: params.id },
        data: { isLocked: true, lockedAt: new Date() },
      })

      // Lock tiebreakers on successful finalize
      update.tiebreakersLockedAt = new Date()
      finalizeWarnings = warnings
    }

    const updated = await (prisma as any).season.update({
      where: { id: params.id },
      data: update,
      include: { league: { select: { id: true, name: true, description: true, ownerId: true } } },
    })

    // Season concluded → review invites to every participating family
    // (owner 2026-07-18: platform guarantees the ask; policy + per-club
    // override checked inside). Best-effort, after the update committed.
    if (body.status === "COMPLETED" && season.status !== "COMPLETED") {
      sendSeasonReviewInvites(params.id).catch((err) =>
        console.error("review invites failed:", err)
      )
    }

    // Season just opened for registration → tell the league's returning clubs.
    // Before this, opening a season notified no one; clubs found out by word of
    // mouth. Recipients (owner decision — org-to-org business notice, Owners +
    // Managers only): every user holding ClubOwner/ClubManager at a tenant that
    // has a TeamSubmission in ANY OTHER season of this league. Bell + short
    // email, deduped. Best-effort: runs after the update committed, and the
    // state-machine guard above means body.status !== season.status here is a
    // genuine forward transition.
    if (body.status === "REGISTRATION" && season.status !== "REGISTRATION") {
      try {
        const leagueName: string = updated.league?.name ?? "The league"
        const seasonLabel: string = updated.label ?? "New season"
        const priorSubmissions = await prisma.teamSubmission.findMany({
          where: { season: { leagueId: season.leagueId, id: { not: params.id } } },
          select: { team: { select: { tenantId: true } } },
        })
        const tenantIds = Array.from(new Set(priorSubmissions.map((s) => s.team.tenantId)))
        if (tenantIds.length > 0) {
          const clubRoles = await prisma.userRole.findMany({
            where: { tenantId: { in: tenantIds }, role: { in: ["ClubOwner", "ClubManager"] } },
            select: { userId: true, user: { select: { email: true } } },
          })
          const headline = `${leagueName} — ${seasonLabel} is open for team registration`

          const recipientIds = Array.from(new Set(clubRoles.map((r) => r.userId)))
          await notifyMany(prisma, recipientIds, {
            type: "season_registration_open",
            title: "Registration Open",
            message: headline,
            link: `/browse-leagues/${season.leagueId}`,
            referenceId: params.id,
            referenceType: "Season",
          })

          const emails = Array.from(
            new Set(clubRoles.map((r) => r.user?.email).filter((e): e is string => !!e))
          )
          const registerLink = `${appBaseUrl()}/browse-leagues/${season.leagueId}`
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Registration is open</h2>
              <p><strong>${escapeHtml(leagueName)}</strong> is now accepting team registrations for <strong>${escapeHtml(seasonLabel)}</strong>.</p>
              <p>Your club has participated in this league before — register early to secure your divisions.</p>
              <p>
                <a href="${registerLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
                  Register your teams
                </a>
              </p>
              ${transactionalFooter(leagueName)}
            </div>
          `
          for (const to of emails) {
            try {
              await sendEmail({ to, subject: headline, html })
            } catch (mailErr) {
              console.error("Registration-open email failed:", to, mailErr)
            }
          }
        }
      } catch (notifyErr) {
        console.error("Registration-open fanout failed:", notifyErr)
      }
    }

    return NextResponse.json({
      success: true,
      ...updated,
      teamFee: updated.teamFee ? Number(updated.teamFee) : null,
      warnings: finalizeWarnings,
    })
  } catch (error) {
    console.error("Update season error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/seasons/[id] — Delete season (only if no games or submissions yet)
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: {
        league: { select: { ownerId: true } },
        _count: { select: { games: true, teamSubmissions: true } },
      },
    })
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isOwner = season.league.ownerId === sessionInfo.userId
    if (!isOwner && !sessionInfo.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (season._count.games > 0 || season._count.teamSubmissions > 0) {
      return NextResponse.json(
        { error: "Cannot delete a season with games or team submissions" },
        { status: 409 }
      )
    }

    await (prisma as any).season.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete season error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
