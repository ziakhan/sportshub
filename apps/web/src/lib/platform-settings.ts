import { prisma } from "@youthbasketballhub/db"
import { SUPPORTED_COUNTRIES } from "./countries"

const DEFAULT_COUNTRIES = ["CA"]

/**
 * Get enabled countries from PlatformSettings.
 * Creates the default settings row if it doesn't exist.
 * Returns the filtered list of SUPPORTED_COUNTRIES that are enabled.
 */
export async function getEnabledCountries() {
  // Upsert, not find-then-create: parallel callers on a fresh DB (e.g. next
  // build prerendering several pages at once) raced the create and one died
  // on the unique constraint (first box deploy, 2026-07-12).
  const settings = await prisma.platformSettings.upsert({
    where: { id: "default" },
    create: { id: "default", enabledCountries: DEFAULT_COUNTRIES },
    update: {},
    select: { enabledCountries: true },
  })

  const enabled = settings.enabledCountries
  return SUPPORTED_COUNTRIES.filter((c) => enabled.includes(c.code))
}

/**
 * Get just the enabled country codes (lightweight, for API responses).
 */
export async function getEnabledCountryCodes(): Promise<string[]> {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: "default" },
    select: { enabledCountries: true },
  })
  return settings?.enabledCountries || DEFAULT_COUNTRIES
}

/**
 * Check if only one country is enabled (skip selectors in UI).
 */
export async function isSingleCountryMode() {
  const codes = await getEnabledCountryCodes()
  return codes.length === 1 ? codes[0] : null
}

/**
 * Global search-engine indexing switch (admin settings). Defaults FALSE —
 * the site stays noindex until the owner flips it at go-live
 * (docs/roadmap/seo-strategy.md §9). Read by robots.ts, sitemap.ts and the
 * root layout; fails CLOSED (noindex) on any error.
 */
export async function isSeoIndexingEnabled(): Promise<boolean> {
  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: { seoIndexingEnabled: true },
    })
    return settings?.seoIndexingEnabled ?? false
  } catch {
    return false
  }
}
