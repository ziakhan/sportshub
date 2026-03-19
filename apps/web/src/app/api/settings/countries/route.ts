import { NextResponse } from "next/server"
import { getEnabledCountries } from "@/lib/platform-settings"

export const dynamic = "force-dynamic"

/**
 * GET /api/settings/countries
 * Public endpoint — returns enabled countries for UI rendering
 */
export async function GET() {
  try {
    const countries = await getEnabledCountries()
    return NextResponse.json({
      countries,
      singleCountry: countries.length === 1 ? countries[0].code : null,
    })
  } catch (error) {
    console.error("Get enabled countries error:", error)
    // Fallback to US only
    return NextResponse.json({
      countries: [{ code: "US", name: "United States", currency: "USD", currencySymbol: "$", postalLabel: "ZIP Code", subdivisionLabel: "State" }],
      singleCountry: "US",
    })
  }
}
