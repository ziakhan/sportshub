/**
 * Player handles (docs/roadmap/player-handles-plan.md P0) — the marketable
 * identity: /p/<handle> → player page. Validation + reserved words live
 * here so the claim API and any future rename surface agree.
 */

/** lowercase letters/digits, then letters/digits/-/_ — 3 to 20 chars */
const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,19}$/

/** Route names, brand terms, and bait we never hand out. */
const RESERVED = new Set([
  "admin", "administrator", "api", "app", "about", "account", "auth",
  "calendar", "chat", "club", "clubs", "coach", "contact", "dashboard",
  "events", "faq", "game", "games", "help", "home", "league", "leagues",
  "live", "login", "logout", "manage", "marketplace", "me", "news",
  "notifications", "official", "offers", "p", "payments", "player",
  "players", "privacy", "profile", "root", "score", "scores", "settings",
  "signin", "signup", "sportshub", "staff", "stats", "support", "team",
  "teams", "terms", "tournament", "tournaments", "tryout", "tryouts",
  "user", "users", "www", "youthbasketballhub",
  "sportshubone",
  "ysportshub",
  "sportshub",
])

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Returns an error message, or null when the handle is acceptable. */
export function validateHandle(handle: string): string | null {
  if (!HANDLE_RE.test(handle)) {
    return "Handles are 3–20 characters: lowercase letters, numbers, dashes or underscores, starting with a letter or number"
  }
  if (RESERVED.has(handle)) {
    return "That handle is reserved"
  }
  return null
}

/**
 * Default handle candidates for a new account (owner 2026-07-23: EVERY
 * signup reserves a handle; users can change it later). Name-based first,
 * email local-part second, then numbered variants — callers try each
 * against the unique column until one inserts.
 */
export function defaultHandleCandidates(opts: {
  firstName?: string | null
  lastName?: string | null
  email: string
}): string[] {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 18)
  const first = clean(opts.firstName ?? "")
  const last = clean(opts.lastName ?? "")
  const local = clean(opts.email.split("@")[0] ?? "")

  const bases = [
    first && last ? `${first}${last}`.slice(0, 20) : "",
    first && last ? `${first}-${last}`.slice(0, 20) : "",
    local,
    first,
  ].filter((b) => b.length >= 3 && !RESERVED.has(b) && HANDLE_RE.test(b))

  const out: string[] = [...new Set(bases)]
  const seedBase = out[0] ?? (local.length >= 1 ? local.padEnd(3, "0") : "player")
  for (let i = 0; i < 6; i++) {
    const n = Math.floor(10 + (((Date.now() / 1000) | 0) % 90)) + i * 7
    out.push(`${seedBase.slice(0, 16)}${n}`)
  }
  return out.filter((h) => !validateHandle(h))
}
