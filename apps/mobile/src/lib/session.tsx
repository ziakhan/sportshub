import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import {
  hasStoredSession,
  setSessionLostHandler,
  signIn as apiSignIn,
  signInWithApple as apiSignInWithApple,
  signOut as apiSignOut,
  storedUser,
  type SessionUser,
} from "./api"
import { registerForPush, unregisterDevice } from "./push"
import { resetRealtime } from "./realtime"
import { resetHome } from "./home"

/**
 * Session state for the whole app. The app is browsable signed OUT (audit
 * v2 §1 — no login wall); `signedIn` only gates the personal layer. Boot: a
 * stored refresh token counts as signed in (apiFetch refreshes lazily);
 * sign-in/out call the M2 endpoints and keep push-device registration in
 * step. A definitive server-side session loss (refresh → 401) downgrades
 * the UI to anonymous instead of stranding stale personal tabs.
 */

interface SessionContextValue {
  isLoading: boolean
  signedIn: boolean
  user: SessionUser | null
  signIn(email: string, password: string): Promise<void>
  signInApple(
    identityToken: string,
    fullName?: { givenName?: string | null; familyName?: string | null } | null
  ): Promise<void>
  signOut(): Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    Promise.all([hasStoredSession(), storedUser()])
      .then(([stored, restoredUser]) => {
        setSignedIn(stored)
        if (stored) {
          setUser(restoredUser)
          void registerForPush() // refresh token + lastSeenAt each launch
        }
      })
      .catch(() => {
        // unreadable secure storage — boot anonymous, never crash
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    setSessionLostHandler(() => {
      resetRealtime()
      resetHome()
      setUser(null)
      setSignedIn(false)
    })
    return () => setSessionLostHandler(null)
  }, [])

  const value: SessionContextValue = {
    isLoading,
    signedIn,
    user,
    async signIn(email, password) {
      const sessionUser = await apiSignIn(email, password)
      setUser(sessionUser)
      setSignedIn(true)
      void registerForPush()
    },
    async signInApple(identityToken, fullName) {
      const sessionUser = await apiSignInWithApple(identityToken, fullName)
      setUser(sessionUser)
      setSignedIn(true)
      void registerForPush()
    },
    async signOut() {
      await unregisterDevice().catch(() => {})
      await apiSignOut()
      resetRealtime() // drop the authenticated socket + its private rooms
      resetHome() // the next account must not see this one's band
      setUser(null)
      setSignedIn(false)
    },
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useSession must be used inside SessionProvider")
  return ctx
}
