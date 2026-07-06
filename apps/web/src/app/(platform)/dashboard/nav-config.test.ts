import { describe, expect, it } from "vitest"
import fs from "fs"
import path from "path"
import { buildNavSections } from "./nav-config"

/**
 * Menus must point at pages that exist (UX audit GAP-001/017: sidebar
 * "My Teams" pointed at a route nobody built). Builds the route manifest
 * from the filesystem and checks every static href the nav can emit —
 * including tenant-workspace template links, resolved with a dummy id.
 */

const APP_DIR = path.resolve(__dirname, "../..")

function collectRoutePatterns(dir: string, prefix = ""): string[] {
  const patterns: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      if (entry.name === "page.tsx") patterns.push(prefix || "/")
      continue
    }
    if (entry.name.startsWith("(") || entry.name.startsWith("@")) {
      // Route groups don't contribute URL segments
      patterns.push(...collectRoutePatterns(path.join(dir, entry.name), prefix))
    } else {
      patterns.push(...collectRoutePatterns(path.join(dir, entry.name), `${prefix}/${entry.name}`))
    }
  }
  return patterns
}

function matchesPattern(href: string, pattern: string): boolean {
  if (pattern === "/") return href === "/"
  const hrefSegs = href.split("/").filter(Boolean)
  const patSegs = pattern.split("/").filter(Boolean)
  if (patSegs.some((s) => s.startsWith("[["))) return true // optional catch-all
  if (hrefSegs.length !== patSegs.length) return false
  return patSegs.every((p, i) => (p.startsWith("[") ? true : p === hrefSegs[i]))
}

describe("navigation links resolve to real routes", () => {
  const routes = collectRoutePatterns(APP_DIR)

  const sections = buildNavSections({
    roles: [
      "PlatformAdmin",
      "Parent",
      "Player",
      "Referee",
      "Scorekeeper",
      "Staff",
      "TeamManager",
      "ClubOwner",
      "ClubManager",
      "LeagueOwner",
      "LeagueManager",
    ],
    tenants: [{ id: "t1", name: "Test Club", slug: "test-club", role: "ClubOwner" }],
  })

  const hrefs = new Set<string>()
  for (const section of sections) {
    for (const item of section.items) hrefs.add(item.href)
    for (const ws of section.workspaces ?? []) {
      hrefs.add(ws.root.href)
      for (const sub of ws.subItems) hrefs.add(sub.href)
    }
  }
  // Staff-fallback items only appear without workspaces — build that variant too
  const staffOnly = buildNavSections({ roles: ["Staff"] })
  for (const s of staffOnly) for (const item of s.items) hrefs.add(item.href)

  it("collected a meaningful set of links and routes", () => {
    expect(routes.length).toBeGreaterThan(40)
    expect(hrefs.size).toBeGreaterThan(15)
  })

  for (const href of [...hrefs].sort()) {
    it(`sidebar link ${href} resolves to a page`, () => {
      const clean = href.split("?")[0]
      expect(
        routes.some((r) => matchesPattern(clean, r)),
        `no page.tsx exists for ${clean}`
      ).toBe(true)
    })
  }

  it("public layout links resolve to pages", () => {
    const layout = fs.readFileSync(path.join(APP_DIR, "(public)/layout.tsx"), "utf8")
    const staticHrefs = [...layout.matchAll(/href="(\/[^"$]*)"/g)]
      .map((m) => m[1])
      .filter((h) => !h.includes("${"))
    expect(staticHrefs.length).toBeGreaterThan(8)
    for (const href of staticHrefs) {
      expect(
        routes.some((r) => matchesPattern(href.split("?")[0], r)),
        `public layout links to ${href} but no page exists`
      ).toBe(true)
    }
  })
})
