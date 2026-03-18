// Country, state/province, and currency utilities

export interface Country {
  code: string
  name: string
  currency: string
  currencySymbol: string
  postalLabel: string
  postalPattern?: string // regex for validation
  subdivisionLabel: string // "State", "Province", "Region"
}

export const SUPPORTED_COUNTRIES: Country[] = [
  {
    code: "US",
    name: "United States",
    currency: "USD",
    currencySymbol: "$",
    postalLabel: "ZIP Code",
    postalPattern: "^\\d{5}(-\\d{4})?$",
    subdivisionLabel: "State",
  },
  {
    code: "CA",
    name: "Canada",
    currency: "CAD",
    currencySymbol: "CA$",
    postalLabel: "Postal Code",
    postalPattern: "^[A-Z]\\d[A-Z]\\s?\\d[A-Z]\\d$",
    subdivisionLabel: "Province",
  },
  {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    currencySymbol: "£",
    postalLabel: "Postcode",
    subdivisionLabel: "County",
  },
  {
    code: "AU",
    name: "Australia",
    currency: "AUD",
    currencySymbol: "A$",
    postalLabel: "Postcode",
    postalPattern: "^\\d{4}$",
    subdivisionLabel: "State",
  },
]

export const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
]

export const CA_PROVINCES = [
  { code: "AB", name: "Alberta" }, { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" }, { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" }, { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" }, { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" }, { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" }, { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
]

export const AU_STATES = [
  { code: "ACT", name: "Australian Capital Territory" }, { code: "NSW", name: "New South Wales" },
  { code: "NT", name: "Northern Territory" }, { code: "QLD", name: "Queensland" },
  { code: "SA", name: "South Australia" }, { code: "TAS", name: "Tasmania" },
  { code: "VIC", name: "Victoria" }, { code: "WA", name: "Western Australia" },
]

export function getSubdivisionsForCountry(countryCode: string) {
  switch (countryCode) {
    case "US": return US_STATES
    case "CA": return CA_PROVINCES
    case "AU": return AU_STATES
    default: return null // free-text input
  }
}

export function getCountryConfig(countryCode: string): Country | undefined {
  return SUPPORTED_COUNTRIES.find((c) => c.code === countryCode)
}

export function getCurrencyForCountry(countryCode: string): string {
  return getCountryConfig(countryCode)?.currency || "USD"
}

export function formatCurrency(amount: number, currency?: string): string {
  const cur = (currency || "USD").toUpperCase()
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Fallback for unknown currency codes
    return `$${amount.toFixed(2)} ${cur}`
  }
}

export const TIMEZONES_BY_COUNTRY: Record<string, { value: string; label: string }[]> = {
  US: [
    { value: "America/New_York", label: "Eastern Time" },
    { value: "America/Chicago", label: "Central Time" },
    { value: "America/Denver", label: "Mountain Time" },
    { value: "America/Los_Angeles", label: "Pacific Time" },
    { value: "America/Anchorage", label: "Alaska Time" },
    { value: "Pacific/Honolulu", label: "Hawaii Time" },
  ],
  CA: [
    { value: "America/St_Johns", label: "Newfoundland Time" },
    { value: "America/Halifax", label: "Atlantic Time" },
    { value: "America/Toronto", label: "Eastern Time" },
    { value: "America/Winnipeg", label: "Central Time" },
    { value: "America/Edmonton", label: "Mountain Time" },
    { value: "America/Vancouver", label: "Pacific Time" },
  ],
  GB: [
    { value: "Europe/London", label: "GMT / BST" },
  ],
  AU: [
    { value: "Australia/Sydney", label: "Eastern Time (AEST)" },
    { value: "Australia/Adelaide", label: "Central Time (ACST)" },
    { value: "Australia/Perth", label: "Western Time (AWST)" },
  ],
}

export function getTimezonesForCountry(countryCode: string) {
  return TIMEZONES_BY_COUNTRY[countryCode] || TIMEZONES_BY_COUNTRY["US"]
}
