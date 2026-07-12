/**
 * Canonical site origin for SEO surfaces (metadataBase, robots, sitemap,
 * canonicals) and anywhere else that needs an absolute public URL.
 *
 * Kept dependency-free so metadata files can import it without dragging in
 * server-only modules (email.ts delegates here for its link base).
 */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "")
}

export const SITE_NAME = "Youth Basketball Hub"

export const SITE_DESCRIPTION =
  "Youth basketball clubs, leagues, camps, tryouts, live scores and standings — one platform for families, clubs and league operators."
