import { prisma } from "@youthbasketballhub/db"
import type { SchedulerInput, SchedulerPhilosophy } from "./generate"
import { effectiveSeasonConfig } from "@/lib/org/season-defaults"

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

  return { input, errors }
}
