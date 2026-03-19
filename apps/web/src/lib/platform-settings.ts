import { prisma } from "@youthbasketballhub/db"
import { SUPPORTED_COUNTRIES } from "./countries"

const DEFAULT_COUNTRIES = ["US"]

/**
 * Get enabled countries from PlatformSettings.
 * Creates the default settings row if it doesn't exist.
 * Returns the filtered list of SUPPORTED_COUNTRIES that are enabled.
 */
export async function getEnabledCountries() {
  let settings = await prisma.platformSettings.findUnique({
    where: { id: "default" },
    select: { enabledCountries: true },
  })

  if (!settings) {
    settings = await prisma.platformSettings.create({
      data: { id: "default", enabledCountries: DEFAULT_COUNTRIES },
      select: { enabledCountries: true },
    })
  }

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
