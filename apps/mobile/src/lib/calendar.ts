import { useCallback, useEffect, useState } from "react"
import { apiJson } from "@/lib/api"

/**
 * Native client for GET /api/calendar/mine — the same cross-team personal
 * calendar the web /calendar page uses (lenses: kids' teams, coached teams,
 * refereed games), plus PUT /api/rsvp for inline Going/Not going/Maybe.
 */

export type RsvpStatus = "GOING" | "NOT_GOING" | "MAYBE"

export interface CalTeam {
  teamId: string
  teamName: string
  clubName: string
  family: boolean
  staff: boolean
}

export interface CalLens {
  key: string // fam:<playerId>:<teamId> | staff:<teamId> | ref:<leagueId>
  kind: "family" | "staff" | "referee"
  label: string
  teamId?: string
  playerId?: string
}

export interface CalItem {
  kind: "practice" | "game" | "event"
  id: string
  teamIds: string[]
  lensKeys: string[]
  at: string
  durationMinutes: number
  status: string
  title: string
  opponent?: string | null
  location: string | null
  detail: string | null
  eventType?: string | null
}

export interface MyCalendar {
  teams: CalTeam[]
  lenses: CalLens[]
  items: CalItem[]
  rsvp: {
    playersByTeam: Record<string, Array<{ id: string; name: string }>>
    rosterByTeam: Record<string, Array<{ id: string; name: string }>>
    byItem: Record<string, Record<string, { status: RsvpStatus; note: string | null }>>
  }
}

/** Server RSVP item type for a calendar item kind (rsvp-shared.ts twin). */
export function rsvpItemType(kind: CalItem["kind"]): "PRACTICE" | "GAME" | "TEAM_EVENT" {
  return kind === "practice" ? "PRACTICE" : kind === "game" ? "GAME" : "TEAM_EVENT"
}

/** byItem key for a calendar item (`PRACTICE:<id>` etc). */
export function rsvpKeyOf(item: Pick<CalItem, "kind" | "id">): string {
  return `${rsvpItemType(item.kind)}:${item.id}`
}

export async function putRsvp(
  item: Pick<CalItem, "kind" | "id">,
  playerId: string,
  status: RsvpStatus
): Promise<void> {
  await apiJson("/api/rsvp", {
    method: "PUT",
    body: JSON.stringify({
      playerId,
      itemType: rsvpItemType(item.kind),
      itemId: item.id,
      status,
    }),
  })
}

export function useMyCalendar(): {
  calendar: MyCalendar | null
  loaded: boolean
  refresh: () => Promise<void>
} {
  const [calendar, setCalendar] = useState<MyCalendar | null>(null)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setCalendar(await apiJson<MyCalendar>("/api/calendar/mine"))
    } catch {
      // pull-to-refresh retries
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { calendar, loaded, refresh }
}
