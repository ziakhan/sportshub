import Constants from "expo-constants"
import * as SecureStore from "expo-secure-store"

/**
 * SportsHub API client — bearer auth against the M2 endpoints
 * (docs/roadmap/native-app-execution-plan.md).
 *
 * Token model: 15-min access JWT + 60-day rotating refresh token, both in
 * SecureStore. On a 401 the client refreshes once and retries; a failed
 * refresh signs the user out (the server revokes replayed families, so we
 * never retry refreshes).
 *
 * Lives in-app for now; extraction to packages/api-client happens when the
 * web starts sharing it (planned deviation, noted in the exec plan).
 */

const ACCESS_KEY = "sportshub.accessToken"
const REFRESH_KEY = "sportshub.refreshToken"
const USER_KEY = "sportshub.user"

/**
 * Base URL resolution, in order:
 * 1. EXPO_PUBLIC_API_URL (set per EAS build profile — prod/preview)
 * 2. The Metro dev-server host with the web app's port 3000 — in a dev
 *    build the phone already knows the Mac's LAN address, so pointing the
 *    API at the same host Just Works on shared Wi-Fi.
 * 3. Production — a release build must NEVER fall back to localhost (that
 *    bricked the first OTA); the live site is the safe default.
 */
export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL
  if (configured) return configured.replace(/\/$/, "")
  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri) return `http://${hostUri.split(":")[0]}:3000`
  return "https://ysportshub.com"
}

export async function getAccessToken(): Promise<string | null> {
  // SecureStore can throw on Android after a backup restore / keystore
  // change — treat unreadable as absent rather than crashing the caller.
  return SecureStore.getItemAsync(ACCESS_KEY).catch(() => null)
}

async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
  ])
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ])
}

export interface SessionUser {
  id: string
  email: string
  name: string | null
}

/** POST /api/auth/token — returns the user, stores the token pair. */
export async function signIn(email: string, password: string): Promise<SessionUser> {
  const res = await fetch(`${apiBaseUrl()}/api/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, deviceLabel: deviceLabel() }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body?.error ?? `Sign-in failed (${res.status})`)
  }
  await setTokens(body.accessToken, body.refreshToken)
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(body.user))
  return body.user as SessionUser
}

/** The user from the last sign-in — survives app restarts. */
export async function storedUser(): Promise<SessionUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY).catch(() => null)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

/**
 * The session context registers here to hear about definitive sign-outs
 * (refresh answered 401/403 → tokens are gone server-side). Transient
 * failures (5xx during a deploy, rate limits, network blips) never fire it.
 */
let sessionLostHandler: (() => void) | null = null
export function setSessionLostHandler(fn: (() => void) | null): void {
  sessionLostHandler = fn
}

/**
 * Rotate the refresh token; false means this call couldn't get a new pair.
 * Tokens are cleared ONLY when the server says the session is dead (401/403)
 * — a 500/502 during a box deploy or a dropped connection must not sign the
 * user out (audit v2 §1).
 */
async function refreshSession(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY)
  if (!refreshToken) return false
  let res: Response
  try {
    res = await fetch(`${apiBaseUrl()}/api/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
  } catch {
    return false // offline — retry on the next 401
  }
  if (res.status === 401 || res.status === 403) {
    await clearTokens()
    sessionLostHandler?.()
    return false
  }
  if (!res.ok) return false // transient server trouble — keep the tokens
  const body = await res.json()
  await setTokens(body.accessToken, body.refreshToken)
  return true
}

/** POST /api/auth/revoke for this device, then clear local state. */
export async function signOut(): Promise<void> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY)
  if (refreshToken) {
    await fetch(`${apiBaseUrl()}/api/auth/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {
      // Offline sign-out still clears the device; the family expires server-side.
    })
  }
  await clearTokens()
}

/** True when a refresh token exists — the app boots signed in. */
export async function hasStoredSession(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(REFRESH_KEY).catch(() => null)
  return token !== null
}

let refreshInFlight: Promise<boolean> | null = null

/**
 * Authenticated fetch: attaches the bearer token; on 401 refreshes once
 * (single-flight so parallel calls share one rotation) and retries.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = async () => {
    const token = await getAccessToken()
    return fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers ?? {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    })
  }

  let res = await doFetch()
  if (res.status === 401) {
    refreshInFlight ??= refreshSession().finally(() => {
      refreshInFlight = null
    })
    const refreshed = await refreshInFlight
    if (refreshed) res = await doFetch()
  }
  return res
}

/** apiFetch + JSON parse; throws on non-2xx with the server's error text. */
export async function apiJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)
  return body as T
}

function deviceLabel(): string {
  return Constants.deviceName ?? "SportsHub app"
}
