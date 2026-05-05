/**
 * Shared helpers for phase test runners.
 *
 * Provides:
 *   - HTTP wrapper with cookie jar (`call`)
 *   - NextAuth credentials sign-in / sign-out
 *   - Signup + onboarding helpers
 *   - Result reporter (`record`, `printSummary`)
 *
 * Each phase runner imports from here so we don't redefine the auth flow
 * every time. Stays plain Node + fetch — no test framework dependency.
 */

import { prisma } from "@youthbasketballhub/db"

export const BASE = process.env.BASE_URL || "http://localhost:3000"
export const PASSWORD = "TestPass123!"

// ---------- HTTP / cookie jar ----------

export type Jar = Map<string, string>

function applySetCookie(jar: Jar, headers: Headers) {
  const raw = (headers as any).getSetCookie?.() ?? headers.get("set-cookie")?.split(/,(?=\s*\w+=)/) ?? []
  for (const line of raw) {
    const [pair] = line.split(";")
    const eq = pair.indexOf("=")
    if (eq < 0) continue
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    if (value === "" || value === "deleted") jar.delete(name)
    else jar.set(name, value)
  }
}

function cookieHeader(jar: Jar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
}

export type CallResult = { status: number; body: any; headers: Headers }

export async function call(
  path: string,
  init: RequestInit & { jar?: Jar } = {}
): Promise<CallResult> {
  const { jar, headers, ...rest } = init
  const h = new Headers(headers as any)
  if (jar && jar.size > 0) h.set("cookie", cookieHeader(jar))
  const res = await fetch(`${BASE}${path}`, { ...rest, headers: h, redirect: "manual" })
  if (jar) applySetCookie(jar, res.headers)
  const text = await res.text()
  let body: any = text
  try { body = JSON.parse(text) } catch {}
  return { status: res.status, body, headers: res.headers }
}

// ---------- Auth ----------

export async function signIn(email: string, password: string): Promise<Jar | null> {
  const jar: Jar = new Map()
  const csrf = await call("/api/auth/csrf", { jar })
  const csrfToken = csrf.body?.csrfToken
  if (!csrfToken) return null
  const params = new URLSearchParams({
    csrfToken, email, password,
    callbackUrl: BASE, json: "true", redirect: "false",
  })
  await call("/api/auth/callback/credentials", {
    method: "POST", jar,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  if (!jar.has("next-auth.session-token") && !jar.has("__Secure-next-auth.session-token")) return null
  const session = await call("/api/auth/session", { jar })
  return session.body?.user?.id ? jar : null
}

export async function signOut(jar: Jar): Promise<boolean> {
  const csrf = await call("/api/auth/csrf", { jar })
  const csrfToken = csrf.body?.csrfToken
  if (!csrfToken) return false
  const params = new URLSearchParams({ csrfToken, callbackUrl: BASE, json: "true" })
  await call("/api/auth/signout", {
    method: "POST", jar,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  const session = await call("/api/auth/session", { jar })
  return !session.body?.user?.id
}

export async function signup(email: string, firstName = "Test", lastName = "User", password = PASSWORD) {
  return call("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, firstName, lastName }),
  })
}

export async function onboard(jar: Jar, payload: any) {
  return call("/api/onboarding", {
    method: "POST", jar,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
}

/**
 * Convenience: sign up + sign in + onboard as a given role. Returns the
 * cookie jar + DB userId. Throws if any step fails.
 */
export async function makeUser(opts: {
  email: string
  firstName: string
  lastName: string
  roles: string[]
  profileData?: any
}): Promise<{ jar: Jar; userId: string; email: string }> {
  const sup = await signup(opts.email, opts.firstName, opts.lastName)
  if (sup.status !== 200) throw new Error(`signup ${opts.email} HTTP ${sup.status} ${JSON.stringify(sup.body)}`)
  const jar = await signIn(opts.email, PASSWORD)
  if (!jar) throw new Error(`signin ${opts.email} failed`)
  const ob = await onboard(jar, { roles: opts.roles, profileData: opts.profileData })
  if (ob.status !== 200) throw new Error(`onboard ${opts.email} HTTP ${ob.status} ${JSON.stringify(ob.body)}`)
  const u = await prisma.user.findFirstOrThrow({ where: { email: opts.email } })
  return { jar, userId: u.id, email: opts.email }
}

// ---------- Reporter ----------

export type Result = { id: string; description: string; pass: boolean | "skip"; detail: string }

export class Reporter {
  results: Result[] = []
  record(id: string, description: string, pass: boolean | "skip", detail: string) {
    this.results.push({ id, description, pass, detail })
    const icon = pass === "skip" ? "⏭️" : pass ? "✅" : "❌"
    console.log(`${icon} ${id} ${description} — ${detail}`)
  }
  printSummary(phaseLabel: string) {
    const passed = this.results.filter((r) => r.pass === true).length
    const failed = this.results.filter((r) => r.pass === false).length
    const skipped = this.results.filter((r) => r.pass === "skip").length
    console.log(`\n=== ${phaseLabel} result: ${passed} pass, ${failed} fail, ${skipped} skipped ===`)
    if (failed > 0) process.exitCode = 1
  }
}
