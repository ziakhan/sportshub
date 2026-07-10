import { useEffect, useRef, useState } from "react"
import Constants from "expo-constants"
import { io, type Socket } from "socket.io-client"
import { apiFetch } from "./api"

/**
 * Native twin of the web's useRealtime (M1 contract): one socket for the
 * app, refcounted room joins, events are PINGS — handlers re-run their
 * screen's existing fetch. Tickets come from /api/realtime/ticket via the
 * bearer client, refreshed on every (re)connection attempt. No socket URL
 * → hook is inert and screens keep polling.
 */

function socketUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_SOCKET_URL
  if (configured) return configured
  // Dev build: the sidecar runs next to the web dev server on the Mac
  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri) return `http://${hostUri.split(":")[0]}:8080`
  return null
}

let socket: Socket | null = null
const roomCounts = new Map<string, number>()

async function fetchTicket(): Promise<string | null> {
  try {
    const res = await apiFetch("/api/realtime/ticket")
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.ticket === "string" ? data.ticket : null
  } catch {
    return null
  }
}

function getSocket(): Socket | null {
  if (socket) return socket
  const url = socketUrl()
  if (!url) return null
  socket = io(url, {
    transports: ["websocket"],
    reconnectionDelayMax: 30_000,
    auth: (cb) => {
      void fetchTicket().then((ticket) => cb(ticket ? { ticket } : {}))
    },
  })
  socket.on("connect", () => {
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

export function useRealtime({
  rooms,
  events,
  enabled = true,
}: {
  rooms: string[]
  events: Record<string, (payload: unknown) => void>
  enabled?: boolean
}): { connected: boolean } {
  const [connected, setConnected] = useState(false)
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

/** Sign-out must drop the authenticated socket so its rooms don't linger. */
export function resetRealtime(): void {
  socket?.disconnect()
  socket = null
  roomCounts.clear()
}
