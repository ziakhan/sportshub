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
  /** RN-safe cover (PNG score card for recaps; https for videos) */
  imageUrl?: string | null
}

export interface ProgramItem {
  id: string
  type: "tryout" | "house-league" | "camp" | "tournament" | "training"
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
  /** Hosting club's published-review average, when it has any (web parity). */
  clubRating?: number | null
  clubReviewCount?: number | null
}

export interface ScoreboardGame {
  id: string
  status: "SCHEDULED" | "LIVE" | "FINAL"
  dateISO: string
  home: { name: string; color: string | null; score: number | null }
  away: { name: string; color: string | null; score: number | null }
  venue: string | null
  leagueName: string | null
}

export interface BrowseHome {
  scoreboard?: ScoreboardGame[]
  stats?: { totalClubs: number; totalTeams: number; totalTryouts: number }
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
