import Fastify from "fastify"
import { env } from "./env"
import { verifyPublish } from "./hmac"
import { createSocketServer } from "./socket"

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

  await app.listen({ port: env.port, host: "0.0.0.0" })
}

main().catch((err) => {
  console.error("sidecar failed to start:", err)
  process.exit(1)
})
