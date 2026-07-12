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
