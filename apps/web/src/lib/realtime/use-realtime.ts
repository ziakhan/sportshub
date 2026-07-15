"use client"

import { useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"

/**
 * Client side of the realtime seam (M1). One socket per tab (module
 * singleton); hooks join/leave rooms refcounted; server events are PINGS
 * that trigger each surface's existing fetch — the caller's handler decides
 * what to refetch, nothing is merged from the payload.
 *
 * Degradation contract: if NEXT_PUBLIC_SOCKET_URL is unset the hook is
 * inert; if the sidecar dies, `connected` flips false and surfaces resume
 * their fast polling cadence. Realtime is strictly additive.
 */

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL

let socket: Socket | null = null
const roomCounts = new Map<string, number>()

async function fetchTicket(): Promise<string | null> {
  try {
    const res = await fetch("/api/realtime/ticket")
    if (!res.ok) return null // anonymous → public rooms only
    const data = await res.json()
    return typeof data.ticket === "string" ? data.ticket : null
  } catch {
    return null
  }
}

function getSocket(): Socket | null {
  if (!SOCKET_URL) return null
  if (socket) return socket
  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    reconnectionDelayMax: 30_000,
    // Evaluated on EVERY (re)connection attempt, so reconnects always
    // present a fresh 60s ticket instead of replaying an expired one.
    auth: (cb) => {
      void fetchTicket().then((ticket) => cb(ticket ? { ticket } : {}))
    },
  })
  socket.on("connect", () => {
    // Re-join everything after any reconnect; the sidecar holds no state
    // about us beyond the live socket.
    for (const room of roomCounts.keys()) socket?.emit("join", room)
  })
  return socket
}

function joinRoom(room: string) {
  const count = roomCounts.get(room) ?? 0
  roomCounts.set(room, count + 1)
  if (count === 0 && socket?.connected) socket.emit("join", room)
}

function leaveRoom(room: string) {
  const count = roomCounts.get(room) ?? 0
  if (count <= 1) {
    roomCounts.delete(room)
    if (socket?.connected) socket.emit("leave", room)
  } else {
    roomCounts.set(room, count - 1)
  }
}

export interface UseRealtimeOptions {
  /** Rooms to join. The sidecar auto-joins `user:{id}` — don't list it. */
  rooms: string[]
  /** Event name → handler. Handlers are pings: refetch, don't merge. */
  events: Record<string, (payload: unknown) => void>
  enabled?: boolean
}

export function useRealtime({ rooms, events, enabled = true }: UseRealtimeOptions): {
  connected: boolean
} {
  const [connected, setConnected] = useState(false)
  // Latest handlers without re-subscribing on every render
  const handlersRef = useRef(events)
  handlersRef.current = events

  const roomsKey = rooms.join("|")
  const eventsKey = Object.keys(events).sort().join("|")

  useEffect(() => {
    if (!enabled) return
    const s = getSocket()
    if (!s) return

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    s.on("connect", onConnect)
    s.on("disconnect", onDisconnect)
    setConnected(s.connected)

    const roomList = roomsKey ? roomsKey.split("|") : []
    roomList.forEach(joinRoom)

    const names = eventsKey ? eventsKey.split("|") : []
    const listeners = names.map((name) => {
      const listener = (payload: unknown) => handlersRef.current[name]?.(payload)
      s.on(name, listener)
      return [name, listener] as const
    })

    return () => {
      s.off("connect", onConnect)
      s.off("disconnect", onDisconnect)
      roomList.forEach(leaveRoom)
      for (const [name, listener] of listeners) s.off(name, listener)
    }
  }, [enabled, roomsKey, eventsKey])

  return { connected }
}

/** Fire-and-forget typing signal — the sidecar rebroadcasts to the room. */
export function emitTyping(room: string): void {
  const s = getSocket()
  if (s?.connected) s.emit("typing", room)
}
