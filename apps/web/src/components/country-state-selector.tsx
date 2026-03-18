"use client"

import { useEffect } from "react"
import {
  SUPPORTED_COUNTRIES,
  getSubdivisionsForCountry,
  getCountryConfig,
} from "@/lib/countries"

interface CountryStateSelectorProps {
  countryValue: string
  stateValue: string
  onCountryChange: (country: string) => void
  onStateChange: (state: string) => void
  countryError?: string
  stateError?: string
  zipLabel?: string
}

export function CountryStateSelector({
  countryValue,
  stateValue,
  onCountryChange,
  onStateChange,
  countryError,
  stateError,
}: CountryStateSelectorProps) {
  const config = getCountryConfig(countryValue)
  const subdivisions = getSubdivisionsForCountry(countryValue)

  // Reset state when country changes
  useEffect(() => {
    if (subdivisions && stateValue) {
      const valid = subdivisions.some((s) => s.code === stateValue || s.name === stateValue)
      if (!valid) onStateChange("")
    }
  }, [countryValue]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Country <span className="text-red-500">*</span>
        </label>
        <select
          value={countryValue}
          onChange={(e) => onCountryChange(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {SUPPORTED_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        {countryError && <p className="mt-1 text-sm text-red-600">{countryError}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {config?.subdivisionLabel || "State/Region"} <span className="text-red-500">*</span>
        </label>
        {subdivisions ? (
          <select
            value={stateValue}
            onChange={(e) => onStateChange(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}
        {stateError && <p className="mt-1 text-sm text-red-600">{stateError}</p>}
      </div>
    </div>
  )
}
