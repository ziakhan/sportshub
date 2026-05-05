import { prisma } from "@youthbasketballhub/db"
import type { SchedulerInput, SchedulerPhilosophy } from "./generate"

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
                  courts: { select: { courtId: true } },
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
    },
  })) as any

  if (!season) {
    errors.push("Season not found")
    return { input: null, errors }
  }

  if (!season.gamesGuaranteed) {
    errors.push("gamesGuaranteed must be set before generating a schedule")
  }

  const input: SchedulerInput = {
    gamesGuaranteed: season.gamesGuaranteed ?? 0,
    gameSlotMinutes: season.gameSlotMinutes ?? 90,
    gameLengthMinutes: season.gameLengthMinutes ?? 40,
    idealGamesPerDayPerTeam: season.idealGamesPerDayPerTeam ?? 1,
    schedulingPhilosophy: (season.schedulingPhilosophy ?? "FAMILY_FRIENDLY") as SchedulerPhilosophy,
    allowCrossDivisionScheduling: !!season.allowCrossDivisionScheduling,
    defaultVenueOpenTime: season.defaultVenueOpenTime ?? "09:00",
    defaultVenueCloseTime: season.defaultVenueCloseTime ?? "20:00",
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
      days: (s.days ?? []).map((d: any) => ({
        id: d.id,
        date: new Date(d.date).toISOString(),
        dayVenues: (d.dayVenues ?? []).map((dv: any) => ({
          id: dv.id,
          venueId: dv.venueId,
          startTime: dv.startTime ?? null,
          endTime: dv.endTime ?? null,
          courts: (dv.courts ?? []).map((c: any) => ({ id: c.courtId })),
        })),
      })),
    })),
  }

  return { input, errors }
}
