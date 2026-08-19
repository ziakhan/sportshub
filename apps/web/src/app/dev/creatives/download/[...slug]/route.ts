import { execFile } from "node:child_process"
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"

/**
 * Renders a creative on demand and hands it back as a download (2026-08-19).
 *
 * GET /dev/creatives/download/<name>/<format>
 *   e.g. /dev/creatives/download/s20-everyone-connected/portrait
 *
 * It SHELLS OUT to scripts/marketing/render-creatives.mjs rather than driving
 * Playwright here, for two reasons. The script owns the format geometry, the
 * frame capture and the ffmpeg invocation, so calling it is the only way to
 * guarantee a download is byte-identical to what the CLI produces. And its
 * dependencies resolve from scripts/marketing, which apps/web cannot see.
 *
 * Output is cached in the OS temp dir and only re-rendered when the source
 * .html is newer than the artifact, so the first click on a creative costs a
 * render (seconds for a static, longer for an animated spot that has to
 * assemble frames) and later clicks are instant.
 *
 * Dev only: it spawns a process and writes to disk, which has no business
 * existing in production.
 */
export const dynamic = "force-dynamic"
/** Animated spots capture every frame then run ffmpeg, so they are slow. */
export const maxDuration = 300

const run = promisify(execFile)

const REPO = path.resolve(process.cwd(), "..", "..")
const SRC = path.join(REPO, "scripts", "marketing", "creatives")
const SCRIPT = path.join(REPO, "scripts", "marketing", "render-creatives.mjs")
const OUT = path.join(tmpdir(), "sportshub-creatives")

const FORMATS = new Set(["portrait", "story", "square"])
/** Matches the renderer's own convention: v* and ad-* are video. */
const isVideo = (name: string) => name.startsWith("v") || name.startsWith("ad-")

/** In-flight renders, so double-clicking a link does not spawn two. */
const pending = new Map<string, Promise<void>>()

export async function GET(_req: Request, { params }: { params: { slug: string[] } }) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 })
  }

  const [name, format = "portrait"] = params.slug
  /* The name reaches a shell argument, so it is validated against the
     directory rather than sanitised: only a real creative can get through. */
  if (!name || !/^[a-z0-9-]+$/i.test(name) || !FORMATS.has(format)) {
    return new NextResponse("Bad request", { status: 400 })
  }
  if (!existsSync(path.join(SRC, `${name}.html`))) {
    return new NextResponse("No such creative", { status: 404 })
  }

  const ext = isVideo(name) ? "mp4" : "png"
  const file = path.join(OUT, `${name}-${format}.${ext}`)
  const srcMtime = statSync(path.join(SRC, `${name}.html`)).mtimeMs
  const fresh = existsSync(file) && statSync(file).mtimeMs > srcMtime

  if (!fresh) {
    mkdirSync(OUT, { recursive: true })
    const key = `${name}:${format}`
    let job = pending.get(key)
    if (!job) {
      job = run("node", [SCRIPT, OUT, "--only", name], {
        cwd: REPO,
        timeout: 280_000,
        maxBuffer: 1 << 22,
      })
        .then(() => undefined)
        .finally(() => pending.delete(key))
      pending.set(key, job)
    }
    try {
      await job
    } catch (error) {
      console.error("creative render failed", name, error)
      return new NextResponse(
        `Render failed for ${name}. Animated creatives need ffmpeg on PATH.`,
        { status: 500 }
      )
    }
  }

  if (!existsSync(file)) {
    return new NextResponse(
      `${name} produced no ${format} ${ext}. Full 9:16 ad spots render story format only.`,
      { status: 404 }
    )
  }

  const stream = createReadStream(file) as unknown as ReadableStream
  return new NextResponse(stream, {
    headers: {
      "content-type": ext === "mp4" ? "video/mp4" : "image/png",
      "content-length": String(statSync(file).size),
      "content-disposition": `attachment; filename="${name}-${format}.${ext}"`,
      "cache-control": "no-store",
    },
  })
}
