import { NextRequest } from "next/server"

/**
 * Guard for /api/cron/* endpoints. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`; we also accept the same in a
 * `x-cron-secret` header for manual/test triggers. Denies everything if
 * CRON_SECRET is unset (fail closed).
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get("authorization")
  const header = request.headers.get("x-cron-secret")
  return auth === `Bearer ${secret}` || header === secret
}
