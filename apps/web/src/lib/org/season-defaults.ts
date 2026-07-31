import { z } from "zod"
// Relative (not "@/") import: the demo seed reaches this module through
// lib/scheduler/load.ts without the app's path alias.
import { applicationQuestionsSchema } from "../registration/questions"

/**
 * Org-level season defaults (league-ia-redesign plan, Phase A).
 *
 * Most season rules are ORGANIZATION policy, not per-league decisions — NPH
 * runs six leagues on one rulebook. The org stores its rulebook once
 * (Organization.seasonDefaults, validated by `seasonDefaultsSchema`); a
 * season field left null inherits it live; an explicit season value is a
 * deliberate override. Resolution is always season → org → system, computed
 * by `effectiveSeasonConfig` — the ONE module every consumer shares
 * (console, scheduler, fee logic, public pages) per the parity law.
 */

export const seasonDefaultsSchema = z
  .object({
    // Season cycle dates (PREFILL at season creation, not live-inherited —
    // real dates drift per league; policy shouldn't)
    cycleStartDate: z.string().nullable().optional(),
    cycleEndDate: z.string().nullable().optional(),
    cycleRegistrationDeadline: z.string().nullable().optional(),
    // Games & format (live-inherited)
    gamesGuaranteed: z.number().int().min(1).max(99).nullable().optional(),
    gamePeriods: z.enum(["HALVES", "QUARTERS"]).nullable().optional(),
    periodLengthMinutes: z.number().int().min(5).max(30).nullable().optional(),
    gameLengthMinutes: z.number().int().min(20).max(60).nullable().optional(),
    gameSlotMinutes: z.number().int().min(30).max(180).nullable().optional(),
    idealGamesPerDayPerTeam: z.number().int().min(1).max(5).nullable().optional(),
    schedulingPhilosophy: z.enum(["FAMILY_FRIENDLY", "SPREAD_DAYS"]).nullable().optional(),
    defaultVenueOpenTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    defaultVenueCloseTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    // Money (live-inherited)
    teamFee: z.number().min(0).nullable().optional(),
    depositPct: z.number().int().min(1).max(99).nullable().optional(),
    balanceDueDaysBeforeStart: z.number().int().min(0).max(365).nullable().optional(),
    // Rules (live-inherited)
    tiebreakerOrder: z.array(z.string()).nullable().optional(),
    allowGuestPlayers: z.boolean().nullable().optional(),
    playoffMinGames: z.number().int().min(1).max(99).nullable().optional(),
    playoffFormat: z.string().nullable().optional(),
    playoffTeams: z.number().int().min(2).max(64).nullable().optional(),
    // Registration (live-inherited) — legacy strings or structured objects
    applicationQuestions: applicationQuestionsSchema.nullable().optional(),
  })
  .strict()

export type OrgSeasonDefaults = z.infer<typeof seasonDefaultsSchema>

/** Final fallbacks — the values the schema used to hardcode as DB defaults. */
export const SYSTEM_DEFAULTS = {
  // Season window (owner 2026-07-31: dates + price inherit like everything
  // else — org key names differ, see ORG_KEY)
  startDate: null as string | Date | null,
  endDate: null as string | Date | null,
  registrationDeadline: null as string | Date | null,
  gamesGuaranteed: null as number | null,
  gamePeriods: "HALVES" as string,
  periodLengthMinutes: null as number | null,
  gameLengthMinutes: 40,
  gameSlotMinutes: 90,
  idealGamesPerDayPerTeam: 1,
  schedulingPhilosophy: "FAMILY_FRIENDLY" as string,
  defaultVenueOpenTime: "09:00",
  defaultVenueCloseTime: "20:00",
  teamFee: null as number | null,
  depositPct: null as number | null,
  balanceDueDaysBeforeStart: 14,
  tiebreakerOrder: [] as string[],
  allowGuestPlayers: true,
  playoffMinGames: null as number | null,
  playoffFormat: null as string | null,
  playoffTeams: null as number | null,
  applicationQuestions: [] as string[],
}

/** The live-inherited policy fields, in resolution order. */
export const POLICY_FIELDS = Object.keys(SYSTEM_DEFAULTS) as Array<keyof typeof SYSTEM_DEFAULTS>

/** Season column → org-defaults key, where the names differ. */
const ORG_KEY: Partial<Record<keyof typeof SYSTEM_DEFAULTS, keyof OrgSeasonDefaults>> = {
  startDate: "cycleStartDate",
  endDate: "cycleEndDate",
  registrationDeadline: "cycleRegistrationDeadline",
}

export type ConfigSource = "season" | "org" | "system"

export interface EffectiveSeasonConfig {
  values: Record<string, unknown>
  /** Per-field provenance — powers the "Inherited from <org>" settings UI. */
  sources: Record<string, ConfigSource>
}

/** A season value counts as SET when it's not null/undefined (arrays: non-empty). */
function isSet(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

/**
 * Resolve the season's effective configuration: season override → org
 * default → system default, with a provenance map.
 * `season` is any object carrying the raw Season columns; `raw` (untyped
 * Json) org defaults are validated leniently — unknown/invalid fields are
 * dropped rather than thrown, so a bad org blob can never break reads.
 */
export function effectiveSeasonConfig(
  season: Record<string, unknown>,
  rawOrgDefaults: unknown
): EffectiveSeasonConfig {
  const parsed = seasonDefaultsSchema.safeParse(rawOrgDefaults ?? {})
  const org: OrgSeasonDefaults = parsed.success ? parsed.data : {}

  const values: Record<string, unknown> = {}
  const sources: Record<string, ConfigSource> = {}
  for (const field of POLICY_FIELDS) {
    const seasonValue = season[field]
    const orgValue = (org as Record<string, unknown>)[ORG_KEY[field] ?? field]
    if (isSet(seasonValue)) {
      values[field] = seasonValue
      sources[field] = "season"
    } else if (isSet(orgValue)) {
      values[field] = orgValue
      sources[field] = "org"
    } else {
      values[field] = SYSTEM_DEFAULTS[field]
      sources[field] = "system"
    }
  }
  return { values, sources }
}

/**
 * Convenience for server code that just needs the resolved values spread
 * over the season object (the getPublicSeason pattern — consumers keep
 * reading `season.gamesGuaranteed` etc. and silently get effective values).
 */
export function applyEffectiveConfig<T extends Record<string, unknown>>(
  season: T,
  rawOrgDefaults: unknown
): T & { configSources: Record<string, ConfigSource> } {
  const { values, sources } = effectiveSeasonConfig(season, rawOrgDefaults)
  return { ...season, ...values, configSources: sources } as T & {
    configSources: Record<string, ConfigSource>
  }
}
