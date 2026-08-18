import { siteUrl } from "@/lib/site"
import { isOurHost } from "@/lib/domains"

/**
 * The PUBLIC origin of a request, for absolute redirects out of route
 * handlers (owner host-lock law 2026-08-17: a visitor stays on the domain
 * they entered).
 *
 * Route handlers cannot use `request.url` for this: behind the reverse
 * proxy it is the server's INTERNAL address (http://localhost:<port>), so
 * redirects built on it send real visitors to localhost (owner repro,
 * 2026-08-17 evening). Middleware URLs are forwarded-aware; handlers must
 * read the forwarded headers themselves. Hosts we don't recognize fall
 * back to the canonical base rather than echoing an attacker's Host header.
 */
export function publicOrigin(request: Request): string {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",")[0]
    .trim()
  if (!host || !isOurHost(host)) return siteUrl()
  if (host.startsWith("localhost") || host.startsWith("127.")) return `http://${host}`
  return `https://${host.split(":")[0]}`
}
