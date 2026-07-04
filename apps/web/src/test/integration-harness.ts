import { vi } from "vitest"
import { getServerSession } from "next-auth"

/**
 * Helpers for L2 integration suites (*.int.test.ts, run via
 * vitest.integration.config.ts). Everything is real — Prisma, the local
 * database, worlds from @youthbasketballhub/test-worlds — EXCEPT the
 * NextAuth session. Each suite must hoist the mock itself:
 *
 *   vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))
 *
 * (vi.mock is file-hoisted, so it can't live in this helper.) With that in
 * place, `actAs(user.id)` drives the real getSessionUserId — including its
 * PlatformAdmin lookup against the real DB. Impersonation paths read
 * cookies() and are not reachable here; cover those at L3 (phase runners).
 *
 * Seed registry — every suite needs a unique world seed so runId namespaces
 * never collide if suites ever run concurrently:
 *   1101 seasons/[id]/submit
 *   1102 seasons/[id] finalize-preflight
 *   1103 teams/[id]/finalize
 *   1104 tryouts/[id]
 *   1105 games/[id]
 *   1106 players/[id]
 *   1107 seasons/[id]/teams/[teamId]
 *   1108 player-invitations
 */

export function actAs(userId: string | null): void {
  vi.mocked(getServerSession).mockResolvedValue(userId ? { user: { id: userId } } : null)
}

export function jsonRequest(url: string, body?: unknown, method = "POST"): any {
  return new Request(`http://localhost:3000${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
