import { useCallback, useEffect, useState } from "react"
import { apiJson } from "@/lib/api"
import { useSession } from "@/lib/session"

/**
 * Native twin of the web's nav-shape + my-contexts resolvers (N3-v2 parity),
 * served by GET /api/mobile/home in one round trip. Drives which tabs exist
 * (calendar, role context slot) and the Home personal band. Module-level
 * cache keeps tabs stable across screen remounts; refresh() re-fetches.
 * Signed-out users never fetch (Home shows public content only), and a
 * failed first fetch retries on an interval so the tab set can't get stuck
 * missing (audit v2 §B5).
 */

export interface NavShape {
  coachTeams: Array<{ teamId: string; tenantId: string; name: string }>
  hasKids: boolean
  isRefereeing: boolean
  isClubStaff: boolean
  isLeagueOwner: boolean
  isPlatformAdmin: boolean
  isOperator: boolean
  isParticipant: boolean
  hasCalendar: boolean
}

export interface MyContexts {
  kids: Array<{ playerId: string; name: string }>
  coachTeams: Array<{ teamId: string; name: string; clubName: string | null; nextEventAt: string | null }>
  refereeGames: number
  operator: { isClubStaff: boolean; isLeagueOwner: boolean; isPlatformAdmin: boolean }
  weekEvents: Array<{
    item: {
      id: string
      kind: string
      title: string
      // server sends MyCalendarItem: the time field is `at` (JSON string)
      at: string
      durationMinutes?: number
      location?: string | null
    }
    chips: string[]
    awaitingRsvp: string[]
  }>
  actionsDue: {
    openOffers: Array<{ id: string; teamName: string; playerName: string }>
    paymentsDue: number
    rsvpsNeeded: number
    unreadChats: number
  }
  isParticipant: boolean
}

export interface HomeData {
  shape: NavShape
  contexts: MyContexts
  unreadNotifications?: number
  yourTeams?: Array<{
    teamId: string
    teamName: string
    ageGroup: string
    clubName: string | null
    color: string | null
    kidNames: string[]
    lastGame: { gameId: string; opponent: string; us: number; them: number; result: "W" | "L" | "T"; dateISO: string } | null
    nextGame: { gameId: string; opponent: string; dateISO: string; venue: string | null } | null
    kidLines: Array<{ playerId: string; name: string; points: number; rebounds: number; assists: number }>
  }>
}

let cached: HomeData | null = null
const listeners = new Set<(d: HomeData | null) => void>()

/** Sign-out must drop the cached band so the next account never sees it. */
export function resetHome(): void {
  cached = null
  listeners.forEach((fn) => fn(null))
}

const RETRY_MS = 20_000

export function useHome(): { home: HomeData | null; loaded: boolean; refresh: () => Promise<void> } {
  const { signedIn } = useSession()
  const [home, setHome] = useState<HomeData | null>(cached)
  const [loaded, setLoaded] = useState(cached !== null)

  const refresh = useCallback(async () => {
    if (!signedIn) return
    try {
      const data = await apiJson<HomeData>("/api/mobile/home")
      cached = data
      listeners.forEach((fn) => fn(data))
    } catch {
      // keep last known shape; the retry interval below tries again
    } finally {
      setLoaded(true)
    }
  }, [signedIn])

  useEffect(() => {
    const fn = (d: HomeData | null) => setHome(d)
    listeners.add(fn)
    if (signedIn && !cached) void refresh()
    return () => {
      listeners.delete(fn)
    }
  }, [refresh, signedIn])

  // A cold start that couldn't reach the server must not leave the tab set
  // incomplete forever — retry until the shape arrives.
  useEffect(() => {
    if (!signedIn || cached) return
    const timer = setInterval(() => {
      if (!cached) void refresh()
    }, RETRY_MS)
    return () => clearInterval(timer)
  }, [signedIn, refresh, home])

  return { home, loaded, refresh }
}

/** The coach's team workspace route (native — audit v2 §2). */
export function coachTeamPath(t: { teamId: string }): string {
  return `/team/${t.teamId}`
}
