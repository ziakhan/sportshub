import { useCallback, useEffect, useState } from "react"
import { apiJson } from "@/lib/api"

/**
 * Public browse data (anonymous) — GET /api/mobile/browse/home in one round
 * trip: featured clubs, active leagues, latest news, next programs. Cached
 * at module level like useHome so Home/Browse share one fetch.
 */

export interface BrowseClub {
  id: string
  slug: string
  name: string
  city: string | null
  state: string | null
  teamCount: number
  primaryColor: string | null
  logoUrl: string | null
}

export interface BrowseLeague {
  id: string
  name: string
  description?: string | null
  seasons: Array<{
    id: string
    name: string
    status: string
    teamCount: number
    divisionCount?: number
    startDate?: string
    endDate?: string
  }>
}

export interface FeedItem {
  id: string
  type: "post" | "announcement"
  kind: string
  title: string
  excerpt: string
  dateISO: string
  href: string | null
  author: string | null
  coverUrl: string | null
}

export interface ProgramItem {
  id: string
  type: "tryout" | "house-league" | "camp" | "tournament"
  name: string
  clubName: string
  clubSlug: string
  ageGroup: string
  gender: string | null
  startDate: string
  endDate?: string
  location: string
  fee: number
  currency: string
  primaryColor: string
  spotsInfo: string
  extra?: string
  status?: string
  feeUnit?: string
  href: string
}

export interface BrowseHome {
  clubs: BrowseClub[]
  leagues: BrowseLeague[]
  news: FeedItem[]
  programs: ProgramItem[]
}

let cached: BrowseHome | null = null
const listeners = new Set<(d: BrowseHome) => void>()

export function useBrowseHome(): {
  browse: BrowseHome | null
  loaded: boolean
  refresh: () => Promise<void>
} {
  const [browse, setBrowse] = useState<BrowseHome | null>(cached)
  const [loaded, setLoaded] = useState(cached !== null)

  const refresh = useCallback(async () => {
    try {
      const data = await apiJson<BrowseHome>("/api/mobile/browse/home")
      cached = data
      listeners.forEach((fn) => fn(data))
    } catch {
      // pull-to-refresh / next mount retries
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    const fn = (d: BrowseHome) => setBrowse(d)
    listeners.add(fn)
    if (!cached) void refresh()
    return () => {
      listeners.delete(fn)
    }
  }, [refresh])

  return { browse, loaded, refresh }
}
