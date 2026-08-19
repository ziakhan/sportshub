import { createReadStream, existsSync, statSync } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"

/**
 * Serves the ad creatives so the gallery can iframe them (2026-08-19).
 *
 * The creatives live in `scripts/marketing/creatives/`, outside apps/web, so
 * Next cannot serve them from `public/`. Copying them in would duplicate the
 * source and drift the moment one is edited, so this reads them where they
 * are. Dev only: it reads from disk by request path, which has no business
 * existing in production.
 */
export const dynamic = "force-dynamic"

/** Repo-root-relative creatives directory. Next's cwd is apps/web. */
const ROOT = path.resolve(process.cwd(), "..", "..", "scripts", "marketing", "creatives")

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}

export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 })
  }

  /* Resolve first, then prove the result is still inside ROOT. Checking the
     raw segments for ".." would miss encoded and symlinked traversals. */
  const target = path.resolve(ROOT, ...params.path)
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    return new NextResponse("Forbidden", { status: 403 })
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    return new NextResponse("Not found", { status: 404 })
  }

  const type = TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream"
  const stream = createReadStream(target) as unknown as ReadableStream
  return new NextResponse(stream, {
    headers: { "content-type": type, "cache-control": "no-store" },
  })
}
