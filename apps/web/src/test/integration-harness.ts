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
 *   1109 offers (cross-club recruiting audit)
 *   1110 obligations / offline payments
 *   1111 obligations product wiring (offers/camps/HL/submissions)
 *   1112 stripe flow (connect/checkout/webhooks, SDK mocked)
 *   1113 platform payment policy (defaults/overrides/destination charges)
 *   1114 live scoring (bootstrap/lock/events/finalize/public read)
 *   1116 referee sign-off (PIN verify / signature / self-service)
 *   1117 tryout check-in (roll-call toggle / roles / cancelled)
 *   1118 team chat (membership matrix / send / poll / delete-moderation)
 *   1119 roster versions (selection / conflicts / lock policy / change requests)
 *   1120 manual overrides (roster add/release/jersey by coach, referee assign)
 *   1121 referee booking (pool / availability / broadcast offers / auto-assign)
 *   1122 team polls (create / vote / re-vote / staff names / close / delete)
 *   1123 practices (slots / announce / move-cancel notify / iCal feed)
 *   1124 offer package options (multi-option accept / bulk send / skips)
 *   1125 rsvp (family set/upsert / roster+item authz / roll-up / reminders)
 *   1126 my-calendar (cross-team feed / family+staff rsvp context / dedup)
 *   1127 program staff (assign/remove authz / manage-lite PATCH / creation gates)
 *   1131 native auth (M2 bearer: login / refresh rotation / replay / revoke)
 *   1132 realtime ticket (M1: room grants / sidecar-verifiable / not-a-bearer)
 *   1133 devices (M3 push: register / re-register moves account / revoke-own)
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
