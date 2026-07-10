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

/**
 * Base URL resolution, in order:
 * 1. EXPO_PUBLIC_API_URL (set per EAS build profile — prod/preview)
 * 2. The Metro dev-server host with the web app's port 3000 — in a dev
 *    build the phone already knows the Mac's LAN address, so pointing the
 *    API at the same host Just Works on shared Wi-Fi.
 */
export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL
  if (configured) return configured.replace(/\/$/, "")
  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri) return `http://${hostUri.split(":")[0]}:3000`
  return "http://localhost:3000"
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY)
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
  return body.user as SessionUser
}

/** Rotate the refresh token; false means the session is gone — sign out. */
async function refreshSession(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY)
  if (!refreshToken) return false
  const res = await fetch(`${apiBaseUrl()}/api/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) {
    await clearTokens()
    return false
  }
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

/** True when a refresh token exists — the app boots straight to the tabs. */
export async function hasStoredSession(): Promise<boolean> {
  return (await SecureStore.getItemAsync(REFRESH_KEY)) !== null
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
