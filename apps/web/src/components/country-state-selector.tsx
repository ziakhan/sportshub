"use client"

import { useEffect, useState } from "react"
import {
  SUPPORTED_COUNTRIES,
  getSubdivisionsForCountry,
  getCountryConfig,
  type Country,
} from "@/lib/countries"

interface CountryStateSelectorProps {
  countryValue: string
  stateValue: string
  onCountryChange: (country: string) => void
  onStateChange: (state: string) => void
  countryError?: string
  stateError?: string
}

export function CountryStateSelector({
  countryValue,
  stateValue,
  onCountryChange,
  onStateChange,
  countryError,
  stateError,
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

  return (
    <div className={showCountrySelector ? "grid grid-cols-2 gap-4" : ""}>
      {showCountrySelector && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Country <span className="text-red-500">*</span>
          </label>
          <select
            value={countryValue}
            onChange={(e) => onCountryChange(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            {enabledCountries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          {countryError && <p className="mt-1 text-sm text-red-600">{countryError}</p>}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {config?.subdivisionLabel || "State/Region"} <span className="text-red-500">*</span>
        </label>
        {subdivisions ? (
          <select
            value={stateValue}
            onChange={(e) => onStateChange(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="">Select {config?.subdivisionLabel || "region"}...</option>
            {subdivisions.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={stateValue}
            onChange={(e) => onStateChange(e.target.value)}
            placeholder={config?.subdivisionLabel || "Region"}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        )}
        {stateError && <p className="mt-1 text-sm text-red-600">{stateError}</p>}
      </div>
    </div>
  )
}
