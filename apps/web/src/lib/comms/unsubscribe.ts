// Signed, no-login unsubscribe tokens for email footers (CASL requires the
// opt-out to work without friction — a recipient may not remember a password).
// HMAC over the payload with NEXTAUTH_SECRET; no DB round-trip to verify.

import { createHmac, timingSafeEqual } from "crypto"
import type { ConsentScope } from "./consent"

export interface UnsubscribePayload {
  userId: string
  scope: ConsentScope
  orgId: string | null
}

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error("NEXTAUTH_SECRET is required for unsubscribe tokens")
  return s
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url")
}

export function createUnsubscribeToken(payload: UnsubscribePayload): string {
  const data = Buffer.from(
    JSON.stringify([payload.userId, payload.scope, payload.orgId ?? ""])
  ).toString("base64url")
  return `${data}.${sign(data)}`
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  const dot = token.lastIndexOf(".")
  if (dot <= 0) return null
  const data = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  const expected = sign(data)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const [userId, scope, orgId] = JSON.parse(Buffer.from(data, "base64url").toString())
    if (!userId || !["PLATFORM", "TENANT", "LEAGUE"].includes(scope)) return null
    return { userId, scope, orgId: orgId || null }
  } catch {
    return null
  }
}
