import { useCallback, useEffect, useState } from "react"
import { apiJson } from "@/lib/api"

/**
 * Native twin of the web's nav-shape + my-contexts resolvers (N3-v2 parity),
 * served by GET /api/mobile/home in one round trip. Drives which tabs exist
 * (calendar, role context slot) and the Home personal band. Module-level
 * cache keeps tabs stable across screen remounts; refresh() re-fetches.
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
      startsAt: string
      endsAt?: string | null
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
}

let cached: HomeData | null = null
const listeners = new Set<(d: HomeData) => void>()

export function useHome(): { home: HomeData | null; loaded: boolean; refresh: () => Promise<void> } {
  const [home, setHome] = useState<HomeData | null>(cached)
  const [loaded, setLoaded] = useState(cached !== null)

  const refresh = useCallback(async () => {
    try {
      const data = await apiJson<HomeData>("/api/mobile/home")
      cached = data
      listeners.forEach((fn) => fn(data))
    } catch {
      // keep last known shape; next focus/interval retries
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    const fn = (d: HomeData) => setHome(d)
    listeners.add(fn)
    if (!cached) void refresh()
    return () => {
      listeners.delete(fn)
    }
  }, [refresh])

  return { home, loaded, refresh }
}

/** The coach's actual workspace on the web — /teams/[id] has no root page. */
export function coachTeamWebPath(t: { teamId: string; tenantId: string }): string {
  return `/clubs/${t.tenantId}/teams/${t.teamId}/dashboard`
}
