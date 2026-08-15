/**
 * Consent-gated player display names (docs/public-site-content-plan.md §11.1).
 *
 * Owner decision: public stats/rosters/leaders show "First L." by default;
 * full names are visible to signed-in participants of that league/club; a
 * parent opts INTO public full names via media consent (GRANTED).
 *
 * Anything baked into stored public content (AI recap bodies) must use
 * publicPlayerName at generation time — a stored string can't vary by viewer.
 */

export type MediaConsentValue = "UNSET" | "GRANTED" | "DENIED"

export interface PlayerNameParts {
  firstName: string
  lastName: string
}

/** "Maya Khan" → "Maya K." — the public-safe default for minors. */
export function abbreviatedName({ firstName, lastName }: PlayerNameParts): string {
  const first = (firstName || "").trim()
  const last = (lastName || "").trim()
  if (!last) return first || "Player"
  if (!first) return `${last[0]}.`
  return `${first} ${last[0]}.`
}

export function fullName({ firstName, lastName }: PlayerNameParts): string {
  return [firstName, lastName]
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(" ") || "Player"
}

/**
 * Name for ANONYMOUS/public surfaces: full name only when the parent has
 * opted in via media consent, abbreviated otherwise.
 */
export function publicPlayerName(
  p: PlayerNameParts & { mediaConsent?: MediaConsentValue | null }
): string {
  return p.mediaConsent === "GRANTED" ? fullName(p) : abbreviatedName(p)
}

/**
 * Viewer-aware name: signed-in participants of the player's league/club see
 * full names; everyone else gets the public rule.
 */
export function playerDisplayName(
  p: PlayerNameParts & { mediaConsent?: MediaConsentValue | null },
  viewerIsParticipant: boolean
): string {
  return viewerIsParticipant ? fullName(p) : publicPlayerName(p)
}

/**
 * Head shot for a viewer, same gate as the name (player photos 2026-08-14).
 * The anonymous public only sees a face when the guardian opted in with media
 * consent; participants see it. Null means the surface draws the sketched
 * PlayerMug instead, which is never consent-gated because it shows nothing
 * but a jersey number.
 */
export function playerDisplayPhoto(
  p: { photoUrl?: string | null; mediaConsent?: MediaConsentValue | null },
  viewerIsParticipant: boolean
): string | null {
  if (!p.photoUrl) return null
  return viewerIsParticipant || p.mediaConsent === "GRANTED" ? p.photoUrl : null
}
