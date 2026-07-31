import { prisma } from "@youthbasketballhub/db"
import type { SchedulerInput, SchedulerPhilosophy } from "./generate"
// Relative (not "@/") import: scripts/seed-nph-demo.ts pulls this module
// straight through tsx without the app's path alias.
import { effectiveSeasonConfig } from "../org/season-defaults"

/**
 * Load a Season + its substrate and shape it as SchedulerInput.
 * Only APPROVED team submissions feed the generator.
 */
export async function loadSchedulerInput(seasonId: string): Promise<{
  input: SchedulerInput | null
  errors: string[]
}> {
  const errors: string[] = []
  const season = (await (prisma as any).season.findUnique({
    where: { id: seasonId },
    include: {
      divisions: {
        include: {
          teamSubmissions: {
            where: { status: "APPROVED" },
            include: {
              team: { select: { id: true, name: true } },
              division: { select: { id: true } },
            },
          },
        },
      },
      sessions: {
        include: {
          days: {
            include: {
              dayVenues: {
                include: {
                  // Preferred fill order (owner 2026-07-30): court 1 packs
                  // first, the rest are overflow.
                  courts: { select: { courtId: true, order: true }, orderBy: { order: "asc" } },
                },
              },
            },
          },
        },
      },
      schedulingGroups: {
        include: {
          divisions: { select: { divisionId: true } },
        },
      },
      league: {
        select: { organization: { select: { seasonDefaults: true } } },
      },
    },
  })) as any

  if (!season) {
    errors.push("Season not found")
    return { input: null, errors }
  }

  // Season → org rulebook → system (Phase A): the scheduler runs off the
  // same effective config every other surface reads.
  const { values: cfg } = effectiveSeasonConfig(
    season,
    season.league?.organization?.seasonDefaults
  )

  if (!cfg.gamesGuaranteed) {
    errors.push("gamesGuaranteed must be set before generating a schedule")
  }

  const input: SchedulerInput = {
    gamesGuaranteed: (cfg.gamesGuaranteed as number) ?? 0,
    gameSlotMinutes: (cfg.gameSlotMinutes as number) ?? 90,
    gameLengthMinutes: (cfg.gameLengthMinutes as number) ?? 40,
    idealGamesPerDayPerTeam: (cfg.idealGamesPerDayPerTeam as number) ?? 1,
    // Stable per-season variety: rotates repeat matchups + time assignments
    // between seasons while keeping preview == commit within one.
    varietySeed: Array.from(seasonId).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7),
    schedulingPhilosophy: (cfg.schedulingPhilosophy ?? "FAMILY_FRIENDLY") as SchedulerPhilosophy,
    allowCrossDivisionScheduling: !!season.allowCrossDivisionScheduling,
    defaultVenueOpenTime: (cfg.defaultVenueOpenTime as string) ?? "09:00",
    defaultVenueCloseTime: (cfg.defaultVenueCloseTime as string) ?? "20:00",
    divisions: (season.divisions ?? []).map((d: any) => ({
      id: d.id,
      name: d.name,
      teams: (d.teamSubmissions ?? []).map((ts: any) => ({
        submissionId: ts.id,
        teamId: ts.teamId,
        divisionId: ts.divisionId,
        name: ts.team?.name ?? ts.teamId,
      })),
    })),
    schedulingGroups: (season.schedulingGroups ?? []).map((g: any) => ({
      id: g.id,
      name: g.name,
      divisionIds: (g.divisions ?? []).map((l: any) => l.divisionId),
    })),
    sessions: (season.sessions ?? []).map((s: any) => ({
      id: s.id,
      phase: s.phase,
      label: s.label ?? null,
      targetGamesPerTeam: s.targetGamesPerTeam ?? null,
      days: (s.days ?? []).map((d: any) => ({
        id: d.id,
        date: new Date(d.date).toISOString(),
        dayVenues: (d.dayVenues ?? []).map((dv: any) => ({
          id: dv.id,
          venueId: dv.venueId,
          startTime: dv.startTime ?? null,
          endTime: dv.endTime ?? null,
          courts: (dv.courts ?? []).map((c: any) => ({ id: c.courtId, order: c.order ?? 0 })),
        })),
      })),
    })),
  }

  // Shared venues (owner 2026-07-31): leagues each get their own windows,
  // but when a second league lands on the same courts by mistake, we don't
  // double-book and we don't hard-stop — other leagues' games become busy
  // bookings the generator schedules AROUND, and the capacity card says how
  // many slots they took so the operator can add hours or courts.
  const courtIds = [
    ...new Set(
      input.sessions.flatMap((s) =>
        s.days.flatMap((d) => d.dayVenues.flatMap((dv) => dv.courts.map((c) => c.id)))
      )
    ),
  ]
  const dayDates = input.sessions.flatMap((s) => s.days.map((d) => new Date(d.date).getTime()))
  if (courtIds.length > 0 && dayDates.length > 0) {
    const from = new Date(Math.min(...dayDates) - 24 * 3600_000)
    const to = new Date(Math.max(...dayDates) + 48 * 3600_000)
    const busyGames = await (prisma as any).game.findMany({
      where: {
        courtId: { in: courtIds },
        OR: [{ seasonId: null }, { seasonId: { not: seasonId } }],
        status: { not: "CANCELLED" },
        scheduledAt: { gte: from, lte: to },
      },
      select: { courtId: true, scheduledAt: true, duration: true },
    })
    if (busyGames.length > 0) {
      input.busyCourtBookings = busyGames.map((g: any) => ({
        courtId: g.courtId,
        start: new Date(g.scheduledAt).toISOString(),
        end: new Date(new Date(g.scheduledAt).getTime() + (g.duration ?? 90) * 60000).toISOString(),
      }))
    }
  }

  return { input, errors }
}
