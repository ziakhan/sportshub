import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * K1/K2 — static conformance over every API route file (catalog §3.K).
 * These pin the two invariants that caused real production bugs:
 *
 *  K1  Any route that reads the session/cookies must export
 *      `dynamic = "force-dynamic"` — otherwise Vercel may cache it static
 *      and serve one user's data to another (or 401 everyone).
 *
 *  K2  Mutating handlers must resolve the actor via getSessionUserId(),
 *      not raw session.user.id — otherwise impersonation attributes writes
 *      to the admin instead of the impersonated user.
 */

const API_ROOT = join(__dirname, "..", "app", "api")

function apiRouteFiles(): string[] {
  return readdirSync(API_ROOT, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith("route.ts") && !f.includes(".test."))
    .map((f) => join(API_ROOT, f))
}

const rel = (f: string) => f.slice(API_ROOT.length + 1)

describe("K1 — session-reading routes are force-dynamic", () => {
  it("every route using getServerSession/getSessionUserId/cookies exports force-dynamic", () => {
    const violations: string[] = []
    for (const file of apiRouteFiles()) {
      const src = readFileSync(file, "utf8")
      const readsSession = /getServerSession\(|getSessionUserId\(|cookies\(\)/.test(src)
      const forceDynamic = /export const dynamic = ["']force-dynamic["']/.test(src)
      if (readsSession && !forceDynamic) violations.push(rel(file))
    }
    expect(violations, `add \`export const dynamic = "force-dynamic"\` to:\n${violations.join("\n")}`).toEqual([])
  })
})

describe("K2 — mutating routes use getSessionUserId, not raw session.user.id", () => {
  // Ratchet: pre-existing debt, tracked but frozen. Fix a file → remove it
  // here. NEVER add to this list. (Some entries only read session.user.id in
  // their GET handler — the check is file-granular; fix = use getSessionUserId
  // everywhere in the file.)
  const KNOWN_DEBT = new Set<string>([
    "admin/settings/route.ts",
    "camps/[id]/route.ts",
    "camps/route.ts",
    "clubs/[id]/offer-templates/[templateId]/route.ts",
    "clubs/[id]/offer-templates/route.ts",
    "clubs/[id]/staff/requests/route.ts",
    "clubs/[id]/staff/route.ts",
    "create-test-users/route.ts",
    "dev/switch-role/route.ts",
    "house-leagues/[id]/route.ts",
    "house-leagues/route.ts",
    "invitations/[id]/route.ts",
    "notifications/route.ts",
    "onboarding/route.ts",
    "players/[id]/route.ts",
    "players/route.ts",
    "teams/route.ts",
    "tenants/route.ts",
    "tournaments/[id]/teams/route.ts",
    "tryouts/[id]/publish/route.ts",
    "tryouts/[id]/route.ts",
    "venues/route.ts",
  ])

  it("no NEW mutating route reads session.user.id directly", () => {
    const violations: string[] = []
    for (const file of apiRouteFiles()) {
      const src = readFileSync(file, "utf8")
      const mutates = /export async function (POST|PATCH|PUT|DELETE)\b/.test(src)
      const rawSessionId = /session\?{0,2}\.user\?{0,2}\.id/.test(src)
      if (mutates && rawSessionId && !KNOWN_DEBT.has(rel(file))) violations.push(rel(file))
    }
    expect(
      violations,
      `mutating routes must use getSessionUserId() (impersonation-correct):\n${violations.join("\n")}`
    ).toEqual([])
  })

  it("ratchet list only contains files that still violate (no stale entries)", () => {
    const stale: string[] = []
    for (const entry of KNOWN_DEBT) {
      const src = readFileSync(join(API_ROOT, entry), "utf8")
      const mutates = /export async function (POST|PATCH|PUT|DELETE)\b/.test(src)
      const rawSessionId = /session\?{0,2}\.user\?{0,2}\.id/.test(src)
      if (!(mutates && rawSessionId)) stale.push(entry)
    }
    expect(stale, `fixed! remove from KNOWN_DEBT: ${stale.join(", ")}`).toEqual([])
  })
})
