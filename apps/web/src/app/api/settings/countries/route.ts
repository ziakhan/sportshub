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
    // Fallback to CA only
    return NextResponse.json({
      countries: [{ code: "CA", name: "Canada", currency: "CAD", currencySymbol: "CA$", postalLabel: "Postal Code", subdivisionLabel: "Province" }],
      singleCountry: "CA",
    })
  }
}
