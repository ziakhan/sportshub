/**
 * Reviews are OFF everywhere public (owner 2026-08-17): review invitations go
 * out by email after a season ends, so until then the public site carries no
 * reference to them — no review blocks, no star summaries, no "rated by"
 * copy. Flip this single flag when the owner opens that door.
 */
export const PUBLIC_REVIEWS = false

/**
 * Account creation is CLOSED until launch (owner 2026-08-17: "login is
 * almost like a sign up" — SSO auto-creating accounts pre-launch is a back
 * door). While false: Google/Apple sign-in only works for EXISTING accounts,
 * the credentials signup API refuses without a valid club-claim completion
 * token (the one funnel that legitimately mints accounts pre-launch), and
 * the sign-up page shows the join-the-list card instead of a form.
 */
export const PUBLIC_SIGNUPS = false
