import type { PersonaKey } from "./persona-session"

/**
 * Demo persona → onboarding role (2026-08-13).
 *
 * A visitor who walked the demo as a player has already answered "what are
 * you". Asking again on the way out is the platform forgetting a thing it was
 * just told, so the exit control carries the answer over as ?role=.
 *
 * This lives beside persona-session.ts rather than inside it on purpose:
 * persona-session.ts reaches for `crypto` and `next/headers`, so a client
 * component importing the map from there would drag a server-only module into
 * the browser bundle. The type import above is erased at compile time.
 */
export const PERSONA_TO_ROLE: Record<PersonaKey, string> = {
  parent: "Parent",
  player: "Player",
  coach: "Staff",
  club: "ClubOwner",
  league: "LeagueOwner",
}

/** Every role id the onboarding flow will accept from a query string. */
export const ONBOARDING_ROLE_IDS = [
  "Parent",
  "ClubOwner",
  "Staff",
  "Referee",
  "Player",
  "LeagueOwner",
  "Trainer",
] as const

export type OnboardingRoleId = (typeof ONBOARDING_ROLE_IDS)[number]

/** Narrow an untrusted string to a role id, or null. */
export function asOnboardingRole(raw: string | null | undefined): OnboardingRoleId | null {
  if (!raw) return null
  return (ONBOARDING_ROLE_IDS as readonly string[]).includes(raw)
    ? (raw as OnboardingRoleId)
    : null
}

/** Role for a persona key, or null when the persona has no onboarding twin. */
export function roleForPersona(persona: string | null | undefined): string | null {
  if (!persona) return null
  return PERSONA_TO_ROLE[persona as PersonaKey] ?? null
}
