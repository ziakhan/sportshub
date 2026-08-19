import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import type { Metadata } from "next"
import { CreativeGallery, type CreativeEntry, type CreativeKind } from "./gallery"

/**
 * Ad-creative gallery (2026-08-19).
 *
 * The creatives in `scripts/marketing/creatives/` had no viewer: they were
 * authored HTML that only became visible by running the renderer and opening
 * PNGs. This browses them live, in all three output formats, so a creative can
 * be judged without an export.
 *
 * The list is read from disk at request time rather than hard-coded, so a new
 * `s9-*.html` shows up here the moment it is written.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: { absolute: "Ad creatives" },
  robots: { index: false, follow: false },
}

const DIR = path.resolve(process.cwd(), "..", "..", "scripts", "marketing", "creatives")

/** Prefix decides the kind, matching the renderer's own convention. */
function kindOf(name: string): CreativeKind {
  if (name.startsWith("ad-")) return "ad"
  if (name.startsWith("v")) return "spot"
  return "static"
}

/** The animated creatives publish their length for the frame capture. */
function durationOf(file: string): number | undefined {
  const m = readFileSync(path.join(DIR, file), "utf8").match(/__duration\s*=\s*(\d+)/)
  return m ? Number(m[1]) : undefined
}

export default function CreativesPage() {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".html") && !f.startsWith("_"))
    .sort()

  const creatives: CreativeEntry[] = files.map((file) => {
    const name = file.replace(/\.html$/, "")
    const kind = kindOf(name)
    return {
      name,
      kind,
      durationMs: kind === "static" ? undefined : durationOf(file),
      /* The two teasers written for the organic launch plan. */
      isNew: name.startsWith("s7-") || name.startsWith("s8-"),
    }
  })

  return <CreativeGallery creatives={creatives} />
}
