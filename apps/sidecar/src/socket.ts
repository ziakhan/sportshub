import type { Server as HttpServer } from "node:http"
import { Server } from "socket.io"
import { createAdapter } from "@socket.io/redis-adapter"
import Redis from "ioredis"
import { jwtVerify } from "jose"
import { env } from "./env"
import { canJoin } from "./rooms"

interface SocketAuthState {
  userId: string | null
  rooms: string[]
}

/**
 * Handshake: `auth.ticket` is a short-lived JWT minted by the web app
 * (`/api/realtime/ticket`, session-authed) or — from M2 — a native access
 * token. Anonymous connections are allowed but can only join public rooms.
 * A bad ticket is treated as anonymous rather than rejected: the public
 * scoreboard must keep working for a user whose ticket just expired.
 */
async function authenticate(ticket: unknown): Promise<SocketAuthState> {
  if (typeof ticket !== "string" || !ticket) return { userId: null, rooms: [] }
  try {
    const secret = new TextEncoder().encode(env.authTokenSecret)
    const { payload } = await jwtVerify(ticket, secret)
    const rooms = Array.isArray(payload.rooms)
      ? payload.rooms.filter((r): r is string => typeof r === "string")
      : []
    return { userId: typeof payload.sub === "string" ? payload.sub : null, rooms }
  } catch {
    return { userId: null, rooms: [] }
  }
}

export async function createSocketServer(http: HttpServer): Promise<Server> {
  const io = new Server(http, {
    cors: { origin: env.corsOrigins, credentials: false },
    // Never fall back to long-polling THROUGH the sidecar: web clients that
    // can't hold a socket already have the app's own HTTP polling fallback.
    transports: ["websocket"],
  })

  if (env.redisUrl) {
    const pub = new Redis(env.redisUrl, { maxRetriesPerRequest: null })
    const sub = pub.duplicate()
    io.adapter(createAdapter(pub, sub))
  }

  io.use(async (socket, next) => {
    const state = await authenticate(socket.handshake.auth?.ticket)
    ;(socket.data as { auth: SocketAuthState }).auth = state
    next()
  })

  io.on("connection", (socket) => {
    const { auth } = socket.data as { auth: SocketAuthState }

    socket.on("join", (room: unknown, ack?: (ok: boolean) => void) => {
      const ok = typeof room === "string" && room.length < 128 && canJoin(room, auth.rooms)
      if (ok) socket.join(room as string)
      ack?.(ok)
    })

    socket.on("leave", (room: unknown) => {
      if (typeof room === "string") socket.leave(room)
    })

    // Presence-ish typing signal: relay only into team rooms the sender is in.
    socket.on("typing", (room: unknown) => {
      if (typeof room === "string" && room.startsWith("team:") && socket.rooms.has(room)) {
        socket.to(room).emit("typing", { room, userId: auth.userId })
      }
    })
  })

  return io
}
