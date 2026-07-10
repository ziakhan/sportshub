"use client"

import { useRef } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/lib/realtime/use-realtime"

/**
 * Realtime for server-rendered surfaces (/scores, homepage scoreboard):
 * an invisible island that joins public rooms and router.refresh()es when
 * an event lands, debounced so a scoring burst re-renders the page once.
 * Renders nothing; without a socket it does nothing.
 */
export function RealtimeRefresh({
  rooms,
  events,
  debounceMs = 2000,
}: {
  rooms: string[]
  events: string[]
  debounceMs?: number
}) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ping = () => {
    if (timer.current) return
    timer.current = setTimeout(() => {
      timer.current = null
      router.refresh()
    }, debounceMs)
  }

  useRealtime({
    rooms,
    events: Object.fromEntries(events.map((name) => [name, ping])),
  })

  return null
}
