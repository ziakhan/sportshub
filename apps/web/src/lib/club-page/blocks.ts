/**
 * Customizable club/league page — block layout model.
 *
 * The public page is a set of typed blocks laid out across two responsive zones
 * (wide "main" + compact "rail"). The org customizes which blocks show, their
 * order, zone, and whether a rail widget pins to the top on mobile. Heavy content
 * inside each block is read live from platform data — the org only curates the shell.
 *
 * Shared, dependency-free (no prisma/react) so both server render and client
 * editor import it. Stored as `TenantBranding.pageLayout` (Json).
 */

export type Zone = "main" | "rail"

export interface BlockDef {
  key: string
  label: string
  /** Short helper shown in the editor. */
  hint: string
  /** Zones this block is allowed in. */
  zones: Zone[]
  defaultZone: Zone
  defaultOrder: number
}

/** The starter block set. Order within each zone is by `defaultOrder`. */
export const BLOCK_DEFS: BlockDef[] = [
  { key: "about", label: "About", hint: "Your description paragraph", zones: ["main"], defaultZone: "main", defaultOrder: 1 },
  { key: "announcements", label: "Announcements", hint: "Posts you publish", zones: ["main", "rail"], defaultZone: "main", defaultOrder: 2 },
  { key: "programs", label: "Open programs", hint: "Tryouts, camps, house leagues (auto)", zones: ["main"], defaultZone: "main", defaultOrder: 3 },
  { key: "teams", label: "Teams", hint: "Your teams (auto)", zones: ["main"], defaultZone: "main", defaultOrder: 4 },
  { key: "schedule", label: "Schedule & scores", hint: "Recent + upcoming games (auto)", zones: ["main"], defaultZone: "main", defaultOrder: 5 },
  { key: "news", label: "News & highlights", hint: "Recaps of your teams' games (auto)", zones: ["main"], defaultZone: "main", defaultOrder: 6 },
  { key: "reviews", label: "Reviews", hint: "Family reviews (auto)", zones: ["main"], defaultZone: "main", defaultOrder: 7 },
  { key: "nextgame", label: "Next game", hint: "Your next fixture (auto)", zones: ["rail", "main"], defaultZone: "rail", defaultOrder: 1 },
  { key: "contact", label: "Contact", hint: "Phone, address, email, website", zones: ["rail", "main"], defaultZone: "rail", defaultOrder: 2 },
  { key: "stats", label: "At a glance", hint: "Teams / programs / staff counts (auto)", zones: ["rail"], defaultZone: "rail", defaultOrder: 3 },
  { key: "socials", label: "Follow us", hint: "Your social links", zones: ["rail"], defaultZone: "rail", defaultOrder: 4 },
]

export const BLOCK_LABELS: Record<string, string> = Object.fromEntries(
  BLOCK_DEFS.map((b) => [b.key, b.label])
)

export interface BlockConfig {
  key: string
  zone: Zone
  order: number
  visible: boolean
  pinMobile: boolean
}

/**
 * Merge a stored layout with defaults so every known block is always present
 * (new blocks we ship later appear automatically), and drop unknown keys.
 */
export function resolveLayout(pageLayout: unknown): BlockConfig[] {
  const stored = Array.isArray(pageLayout) ? (pageLayout as any[]) : []
  const byKey = new Map(stored.filter((b) => b && typeof b.key === "string").map((b) => [b.key, b]))
  return BLOCK_DEFS.map((def) => {
    const s = byKey.get(def.key) ?? {}
    const zone: Zone = s.zone === "main" || s.zone === "rail" ? s.zone : def.defaultZone
    // Keep a block in a zone it's actually allowed in.
    const safeZone: Zone = def.zones.includes(zone) ? zone : def.defaultZone
    return {
      key: def.key,
      zone: safeZone,
      order: typeof s.order === "number" ? s.order : def.defaultOrder,
      visible: s.visible === undefined ? true : !!s.visible,
      pinMobile: !!s.pinMobile,
    }
  })
}

/** Visible blocks for a zone, ordered. */
export function zoneBlocks(cfg: BlockConfig[], zone: Zone): BlockConfig[] {
  return cfg
    .filter((b) => b.zone === zone && b.visible)
    .sort((a, b) => a.order - b.order)
}

/** Normalize a stored socials object into labeled outbound links. */
export function socialLinks(socials: unknown): Array<{ key: string; label: string; href: string }> {
  if (!socials || typeof socials !== "object") return []
  const map: Record<string, { label: string; base: string }> = {
    instagram: { label: "Instagram", base: "https://instagram.com/" },
    facebook: { label: "Facebook", base: "https://facebook.com/" },
    x: { label: "X", base: "https://x.com/" },
    youtube: { label: "YouTube", base: "" },
    tiktok: { label: "TikTok", base: "https://tiktok.com/@" },
  }
  const out: Array<{ key: string; label: string; href: string }> = []
  for (const [key, cfg] of Object.entries(map)) {
    const v = (socials as any)[key]
    if (typeof v === "string" && v.trim()) {
      const val = v.trim()
      out.push({ key, label: cfg.label, href: /^https?:\/\//.test(val) ? val : cfg.base + val.replace(/^@/, "") })
    }
  }
  return out
}

/** Sub-nav anchors derived from the visible main-zone content sections. */
export const SUBNAV_SECTIONS: Array<{ key: string; label: string; anchor: string }> = [
  { key: "about", label: "About", anchor: "about" },
  { key: "teams", label: "Teams", anchor: "teams" },
  { key: "programs", label: "Programs", anchor: "programs" },
  { key: "schedule", label: "Schedule", anchor: "schedule" },
  { key: "contact", label: "Contact", anchor: "contact" },
]
