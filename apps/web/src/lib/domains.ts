/**
 * THE domain registry (owner 2026-07-23): the platform's live domains live
 * HERE and nowhere else. Adding/retiring a domain = edit ONE list (or set
 * NEXT_PUBLIC_APP_DOMAINS) — no more per-file hardcodes, and no more stale
 * youthbasketballhub.com references.
 *
 * Dependency-free (middleware/edge-safe), same spirit as lib/site.ts.
 */

/** Primary brand domain — display copy, share-card watermarks, contact emails. */
export const PRIMARY_DOMAIN = "sportshubone.com"

/**
 * Every live app domain (per-host SSO serves all of them). Env override:
 * NEXT_PUBLIC_APP_DOMAINS="a.com,b.com".
 */
export const APP_DOMAINS: string[] = (process.env.NEXT_PUBLIC_APP_DOMAINS ?? "sportshubone.com,ysportshub.com")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

/**
 * The domain email is actually sent from. Since 2026-08-17 the brand domain
 * carries its own OCI SPF + DKIM (selector sh1-2026), so sending and brand
 * are finally the same domain (owner ruling: all mail from sportshubone.com,
 * display name "SportsHubOne"). ysportshub.com keeps its records as a
 * fallback sender. NOTE: the OCI approved sender is "no-reply@" (hyphen).
 */
export const EMAIL_DOMAIN = "sportshubone.com"

/** Hostname (optionally with port) → bare lowercase domain. */
function bare(host: string): string {
  return host.split(":")[0].toLowerCase()
}

/** Is this host one of ours — apex, www, or any subdomain of a live domain? */
export function isOurHost(host: string): boolean {
  const h = bare(host)
  if (h === "localhost" || h === "127.0.0.1") return true
  return APP_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`))
}

/**
 * If the host is a club-vanity subdomain of a live domain, return the slug
 * ("kings.sportshubone.com" → "kings"). Apex, www-less matches, localhost,
 * and foreign hosts return null.
 */
export function tenantSlugFromHost(host: string): string | null {
  const h = bare(host)
  for (const d of APP_DOMAINS) {
    if (h !== d && h.endsWith(`.${d}`)) {
      const sub = h.slice(0, -(d.length + 1))
      // Only single-label subdomains are club slugs ("a.b.domain" is not).
      if (sub && !sub.includes(".")) return sub
    }
  }
  return null
}

/** Contact/brand email addresses ("privacy" → privacy@sportshubone.com). */
export function brandEmail(localPart: string): string {
  return `${localPart}@${PRIMARY_DOMAIN}`
}

/** Transactional sender ("noreply" → noreply@ysportshub.com — DKIM-aligned). */
export function senderEmail(localPart: string): string {
  return `${localPart}@${EMAIL_DOMAIN}`
}
