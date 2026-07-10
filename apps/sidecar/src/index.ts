import Fastify from "fastify"
import { env } from "./env"
import { verifyPublish } from "./hmac"
import { createSocketServer } from "./socket"
import { createPushQueue } from "./queue"
import type { PushItem } from "./push"

interface PublishBody {
  rooms: string[]
  event: string
  payload: unknown
}

function isPublishBody(b: unknown): b is PublishBody {
  if (typeof b !== "object" || b === null) return false
  const o = b as Record<string, unknown>
  return (
    Array.isArray(o.rooms) &&
    o.rooms.length > 0 &&
    o.rooms.length <= 50 &&
    o.rooms.every((r) => typeof r === "string" && r.length < 128) &&
    typeof o.event === "string" &&
    o.event.length < 64
  )
}

function isPushBody(b: unknown): b is { items: PushItem[] } {
  if (typeof b !== "object" || b === null) return false
  const items = (b as Record<string, unknown>).items
  if (!Array.isArray(items) || items.length === 0 || items.length > 500) return false
  return items.every((i) => {
    if (typeof i !== "object" || i === null) return false
    const o = i as Record<string, unknown>
    return (
      typeof o.userId === "string" &&
      o.userId.length < 64 &&
      typeof o.type === "string" &&
      o.type.length < 64 &&
      typeof o.title === "string" &&
      o.title.length < 200 &&
      typeof o.message === "string" &&
      o.message.length < 1000 &&
      (o.link == null || (typeof o.link === "string" && o.link.length < 300))
    )
  })
}

async function main() {
  const app = Fastify({ logger: true })

  // Raw body needed for HMAC verification — capture it before JSON parsing.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    try {
      done(null, { raw: body as string, json: JSON.parse(body as string) })
    } catch (err) {
      done(err as Error)
    }
  })

  app.get("/healthz", async () => ({ ok: true, uptime: process.uptime() }))

  const io = await createSocketServer(app.server)

  app.post("/internal/publish", async (req, reply) => {
    const { raw, json } = req.body as { raw: string; json: unknown }
    const ok = verifyPublish(
      env.sidecarSharedSecret,
      req.headers["x-timestamp"] as string | undefined,
      req.headers["x-signature"] as string | undefined,
      raw
    )
    if (!ok) return reply.code(401).send({ error: "bad signature" })
    if (!isPublishBody(json)) return reply.code(400).send({ error: "bad body" })

    io.to(json.rooms).emit(json.event, json.payload)
    return { delivered: true }
  })

  // M3: push enqueue — same HMAC trust seam as publish. The worker resolves
  // devices/quiet-hours and talks to Expo; see push.ts.
  const pushQueue = createPushQueue()
  app.post("/internal/push", async (req, reply) => {
    const { raw, json } = req.body as { raw: string; json: unknown }
    const ok = verifyPublish(
      env.sidecarSharedSecret,
      req.headers["x-timestamp"] as string | undefined,
      req.headers["x-signature"] as string | undefined,
      raw
    )
    if (!ok) return reply.code(401).send({ error: "bad signature" })
    if (!isPushBody(json)) return reply.code(400).send({ error: "bad body" })
    if (!pushQueue.enabled) return reply.code(503).send({ error: "push not configured" })

    await pushQueue.enqueueSend(json.items)
    return { queued: json.items.length }
  })

  await app.listen({ port: env.port, host: "0.0.0.0" })
}

main().catch((err) => {
  console.error("sidecar failed to start:", err)
  process.exit(1)
})
