import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import type { Metadata } from "next"
import { CreativeGallery, type Audience, type CreativeEntry, type CreativeKind } from "./gallery"

/**
 * Ad-creative gallery (2026-08-19).
 *
 * The creatives in `scripts/marketing/creatives/` had no viewer: they were
 * authored HTML that only became visible by running the renderer and opening
 * PNGs. This browses them live, in all three output formats, and hands back
 * the postable export on demand.
 *
 * The list is read from disk at request time rather than hard-coded, so a new
 * `s21-*.html` shows up the moment it is written. Only the AUDIENCE and PAIR
 * tags below are curated, because neither can be inferred from a filename.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: { absolute: "Ad creatives" },
  robots: { index: false, follow: false },
}

const DIR = path.resolve(process.cwd(), "..", "..", "scripts", "marketing", "creatives")

/** Who a creative is aimed at. Filenames cannot carry this, so it is curated. */
const AUDIENCE: Record<string, Audience> = {
  "s1-pain-pills": "clubs",
  "s2-name-names": "clubs",
  "s3-checklist": "everyone",
  "s4-hero-tagline": "everyone",
  "s5-live-boxscore": "players",
  "s6-game-moved": "parents",
  "s7-teaser-moved": "parents",
  "s8-teaser-census": "everyone",
  "s9-your-statline": "players",
  "s10-your-page": "players",
  "s11-potg": "players",
  "s12-club-website": "clubs",
  "s13-every-seat": "everyone",
  "s15-real-game": "everyone",
  "s16-family-calendar": "parents",
  "s17-scheduler": "leagues",
  "s18-team-drops-out": "parents",
  "s19-coach-two-teams": "coaches",
  "s20-everyone-connected": "everyone",
  "v1-pills": "clubs",
  "v2-checklist": "everyone",
  "v3-livescore": "players",
  "v4-headline": "everyone",
  "v5-game-moved": "parents",
  "ad-clubs": "clubs",
  "ad-players": "players",
}

/**
 * The July set was authored as matched static/video twins, which is exactly
 * the "two cards look the same but one moves" confusion the gallery had. Each
 * pair shares a key so a card can say what its other half is.
 */
const PAIRS: Record<string, string> = {
  "s1-pain-pills": "pills",
  "v1-pills": "pills",
  "s3-checklist": "checklist",
  "v2-checklist": "checklist",
  "s5-live-boxscore": "livescore",
  "v3-livescore": "livescore",
  "s4-hero-tagline": "tagline",
  "v4-headline": "tagline",
  "s6-game-moved": "game-moved",
  "v5-game-moved": "game-moved",
}

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

  const names = files.map((f) => f.replace(/\.html$/, ""))

  const creatives: CreativeEntry[] = names.map((name) => {
    const kind = kindOf(name)
    const pairKey = PAIRS[name]
    const twin = pairKey ? names.find((n) => n !== name && PAIRS[n] === pairKey) : undefined
    return {
      name,
      kind,
      durationMs: kind === "static" ? undefined : durationOf(`${name}.html`),
      audience: AUDIENCE[name] ?? "everyone",
      twin,
      /* The two teasers and everything authored in the 08-19 batch. */
      isNew: /^s(7|8|9|1[0-9]|20)-/.test(name),
    }
  })

  return <CreativeGallery creatives={creatives} />
}
