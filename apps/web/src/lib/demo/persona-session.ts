import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"

/**
 * Persona demo sessions (limited-launch-demo-build-2026-08.md §2).
 *
 * A signed-in visitor "enters the demo" as a seeded persona. We set one
 * signed httpOnly cookie; while it is present, reads flow as the persona
 * (getSessionUserId returns the persona id) and the middleware rejects
 * every mutation outside the demo allowlist. The cookie also carries the
 * visitor's demoSessionId — the key that scopes their whitelisted actions
 * (chat messages, RSVPs) to their own browser session.
 */

export const DEMO_VIEW_COOKIE = "demo-view"

/** Personas are seeded users at FIXED addresses (spec-driven seeder). */
export const PERSONA_EMAILS = {
  parent: "persona-parent@sportshub.demo",
  coach: "persona-coach@sportshub.demo",
  club: "persona-club@sportshub.demo",
  // League operator persona exists in the world but is NOT offered in the
  // public drawer (assumption: meetings-only until the owner rules).
  league: "persona-league@sportshub.demo",
} as const

export type PersonaKey = keyof typeof PERSONA_EMAILS

/** Public drawer offers these three; operator persona held back. */
export const PUBLIC_PERSONAS: PersonaKey[] = ["parent", "coach", "club"]

const TTL_MS = 1000 * 60 * 60 * 12 // half a day; nightly reset outlives it

interface DemoViewPayload {
  /** Persona user id reads flow through. */
  p: string
  /** Persona key, for the banner ("exploring as Sam"). */
  k: PersonaKey
  /** demoSessionId — scopes this visitor's whitelisted writes. */
  s: string
  /** Expiry, epoch ms. */
  e: number
}

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error("NEXTAUTH_SECRET is required to sign demo sessions")
  return s
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url")
}

export function encodeDemoView(payload: DemoViewPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${data}.${sign(data)}`
}

export function decodeDemoView(raw: string | undefined | null): DemoViewPayload | null {
  if (!raw) return null
  const dot = raw.lastIndexOf(".")
  if (dot < 1) return null
  const data = raw.slice(0, dot)
  const mac = raw.slice(dot + 1)
  const expected = sign(data)
  try {
    const a = Buffer.from(mac)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as DemoViewPayload
    if (!payload?.p || !payload?.s || typeof payload.e !== "number") return null
    if (payload.e < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function newDemoViewPayload(personaUserId: string, key: PersonaKey): DemoViewPayload {
  return {
    p: personaUserId,
    k: key,
    s: randomBytes(12).toString("base64url"),
    e: Date.now() + TTL_MS,
  }
}

/** Server-component/API helper: the active demo view, if any. */
export function readDemoView(): DemoViewPayload | null {
  try {
    return decodeDemoView(cookies().get(DEMO_VIEW_COOKIE)?.value)
  } catch {
    // cookies() throws outside request scope (integration tests).
    return null
  }
}
