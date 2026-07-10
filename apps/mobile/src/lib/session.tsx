import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import {
  hasStoredSession,
  signIn as apiSignIn,
  signOut as apiSignOut,
  storedUser,
  type SessionUser,
} from "./api"
import { registerForPush, unregisterDevice } from "./push"
import { resetRealtime } from "./realtime"

/**
 * Session state for the whole app. Boot: a stored refresh token counts as
 * signed in (apiFetch refreshes lazily); sign-in/out call the M2 endpoints
 * and keep push-device registration in step.
 */

interface SessionContextValue {
  isLoading: boolean
  signedIn: boolean
  user: SessionUser | null
  signIn(email: string, password: string): Promise<void>
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
      .finally(() => setIsLoading(false))
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
    async signOut() {
      await unregisterDevice().catch(() => {})
      await apiSignOut()
      resetRealtime() // drop the authenticated socket + its private rooms
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
