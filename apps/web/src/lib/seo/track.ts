import { headers } from "next/headers"
import { prisma } from "@youthbasketballhub/db"
import { siteUrl } from "@/lib/site"

/**
 * First-party public-page view tracking (SEO analytics).
 *
 * Called from public server components on render. One PublicPageView row per
 * request, with the referrer classified so the admin SEO report can show
 * per-club organic-search landings — the "your page got N Google visits
 * without you doing anything" number used in the claim pitch.
 *
 * Never throws and never blocks the page on failure.
 */

const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|pingdom|uptime|monitor|facebookexternalhit|whatsapp|telegram|discord|preview|curl|wget|python-requests|axios|node-fetch/i

const SEARCH_HOSTS = [
  "google.",
  "bing.com",
  "duckduckgo.com",
  "search.yahoo.",
  "ecosia.org",
  "search.brave.com",
  "startpage.com",
  "qwant.com",
  "baidu.com",
  "yandex.",
]

export type TrackedEntity =
  | "CLUB"
  | "CAMP"
  | "TRYOUT"
  | "HOUSE_LEAGUE"
  | "TOURNAMENT"
  | "NEWS"
  | "TRAINING"

function classify(referer: string | null, userAgent: string | null, ownHost: string) {
  if (userAgent && BOT_RE.test(userAgent)) {
    return { source: "BOT", refHost: null as string | null }
  }
  if (!referer) return { source: "DIRECT", refHost: null as string | null }
  try {
    const refHost = new URL(referer).host.toLowerCase()
    if (refHost === ownHost || refHost.startsWith("localhost")) {
      return { source: "INTERNAL", refHost }
    }
    if (SEARCH_HOSTS.some((h) => refHost.includes(h))) {
      return { source: "ORGANIC", refHost }
    }
    return { source: "REFERRAL", refHost }
  } catch {
    return { source: "DIRECT", refHost: null as string | null }
  }
}

export async function trackPublicView(input: {
  path: string
  entityType: TrackedEntity
  entityId?: string | null
  tenantId?: string | null
}): Promise<void> {
  try {
    const h = headers()
    const { source, refHost } = classify(
      h.get("referer"),
      h.get("user-agent"),
      new URL(siteUrl()).host.toLowerCase()
    )
    await prisma.publicPageView.create({
      data: {
        path: input.path,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        tenantId: input.tenantId ?? null,
        source,
        refHost,
      },
    })
  } catch {
    // Tracking must never break a public page.
  }
}
