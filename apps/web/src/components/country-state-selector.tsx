"use client"

import { useEffect, useState } from "react"
import {
  SUPPORTED_COUNTRIES,
  getSubdivisionsForCountry,
  getCountryConfig,
  type Country,
} from "@/lib/countries"
import { BrandListbox } from "@/components/ui"

interface CountryStateSelectorProps {
  countryValue: string
  stateValue: string
  onCountryChange: (country: string) => void
  onStateChange: (state: string) => void
  countryError?: string
  stateError?: string
  /**
   * "grid" (default, unchanged) wraps the fields in their own two-column row.
   * "flat" drops the wrapper so the fields become cells of whatever grid the
   * form already has — which is how the compact onboarding forms put City and
   * Province on one line. Optional, so every existing caller is untouched.
   */
  layout?: "grid" | "flat"
}

const labelClass = "block text-sm font-medium text-ink-800"
const inputClass =
  "border-ink-200 text-ink-900 placeholder-ink-400 focus:border-play-500 focus:ring-play-500/20 mt-1 block min-h-[44px] w-full rounded-xl border bg-white px-3 py-2.5 text-sm shadow-sm transition duration-200 focus:outline-none focus:ring-2"

export function CountryStateSelector({
  countryValue,
  stateValue,
  onCountryChange,
  onStateChange,
  countryError,
  stateError,
  layout = "grid",
}: CountryStateSelectorProps) {
  const [enabledCountries, setEnabledCountries] = useState<Country[]>(SUPPORTED_COUNTRIES)
  const [singleCountry, setSingleCountry] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/settings/countries")
      .then((res) => res.json())
      .then((data) => {
        if (data.countries?.length > 0) {
          setEnabledCountries(data.countries)
          setSingleCountry(data.singleCountry || null)
          // If single country mode and current value doesn't match, set it
          if (data.singleCountry && countryValue !== data.singleCountry) {
            onCountryChange(data.singleCountry)
          }
        }
      })
      .catch(() => {}) // Fallback to all countries
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const config = getCountryConfig(countryValue)
  const subdivisions = getSubdivisionsForCountry(countryValue)

  // Reset state when country changes
  useEffect(() => {
    if (subdivisions && stateValue) {
      const valid = subdivisions.some((s) => s.code === stateValue || s.name === stateValue)
      if (!valid) onStateChange("")
    }
  }, [countryValue]) // eslint-disable-line react-hooks/exhaustive-deps

  // If only one country enabled, hide the country dropdown
  const showCountrySelector = !singleCountry && enabledCountries.length > 1
  const subdivisionLabel = config?.subdivisionLabel || "State/Region"

  const fields = (
    <>
      {showCountrySelector && (
        <div>
          <label htmlFor="country-select" className={labelClass}>
            Country <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <BrandListbox
              id="country-select"
              ariaLabel="Country"
              value={countryValue}
              onChange={onCountryChange}
              error={!!countryError}
              options={enabledCountries.map((c) => ({ value: c.code, label: c.name }))}
            />
          </div>
          {countryError && <p className="mt-1 text-sm text-red-600">{countryError}</p>}
        </div>
      )}

      <div>
        <label htmlFor="subdivision-select" className={labelClass}>
          {subdivisionLabel} <span className="text-red-500">*</span>
        </label>
        {subdivisions ? (
          <div className="mt-1">
            <BrandListbox
              id="subdivision-select"
              ariaLabel={subdivisionLabel}
              value={stateValue}
              onChange={onStateChange}
              error={!!stateError}
              placeholder={`Select ${subdivisionLabel.toLowerCase()}`}
              options={subdivisions.map((s) => ({ value: s.code, label: s.name }))}
            />
          </div>
        ) : (
          <input
            id="subdivision-select"
            type="text"
            value={stateValue}
            onChange={(e) => onStateChange(e.target.value)}
            placeholder={subdivisionLabel}
            className={inputClass}
          />
        )}
        {stateError && <p className="mt-1 text-sm text-red-600">{stateError}</p>}
      </div>
    </>
  )

  if (layout === "flat") return fields

  return <div className={showCountrySelector ? "grid gap-4 sm:grid-cols-2" : ""}>{fields}</div>
}
