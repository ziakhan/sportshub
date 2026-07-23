// Central config for the legal/policy pages. Owner: confirm the entity name,
// registered address, and contact inboxes before relying on these. Jurisdiction
// is set to Ontario, Canada (PIPEDA + provincial law) — change if the operating
// entity is elsewhere. These pages are a good-faith starting point and are NOT
// a substitute for review by a lawyer.

import { SITE_NAME } from "@/lib/site"
import { brandEmail } from "@/lib/domains"

export const LEGAL = {
  productName: SITE_NAME, // "SportsHub One"
  /** The legal operating entity. Owner: set the registered company name. */
  entity: SITE_NAME,
  jurisdiction: "the Province of Ontario and the federal laws of Canada",
  governingProvince: "Ontario, Canada",
  privacyEmail: brandEmail("privacy"),
  legalEmail: brandEmail("legal"),
  supportEmail: brandEmail("support"),
  /** Bump when a policy materially changes. */
  effectiveDate: "July 21, 2026",
  /** Age below which a parent/guardian must register and consent (COPPA-style). */
  minorAge: 13,
} as const
