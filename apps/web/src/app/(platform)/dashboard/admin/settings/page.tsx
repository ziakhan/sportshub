"use client"

import { useState, useEffect } from "react"

interface Country {
  code: string
  name: string
  currency: string
  currencySymbol: string
}

export default function AdminSettingsPage() {
  const [availableCountries, setAvailableCountries] = useState<Country[]>([])
  const [enabledCodes, setEnabledCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        setAvailableCountries(data.availableCountries || [])
        setEnabledCodes(data.enabledCountries || ["US"])
      })
      .catch(() => setMessage({ type: "error", text: "Failed to load settings" }))
      .finally(() => setLoading(false))
  }, [])

  const toggleCountry = (code: string) => {
    setEnabledCodes((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev // Can't disable the last country
        return prev.filter((c) => c !== code)
      }
      return [...prev, code]
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledCountries: enabledCodes }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }
      setMessage({ type: "success", text: "Settings saved successfully" })
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-gray-500 py-12 text-center">Loading settings...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Platform Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure platform-wide settings
        </p>
      </div>

      {message && (
        <div className={`mb-6 rounded-md p-4 text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {/* Enabled Countries */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-2">Enabled Countries</h3>
        <p className="text-sm text-gray-500 mb-4">
          Select which countries are active on the platform. When only one country is enabled,
          country selectors are hidden and that country is used as the default everywhere.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {availableCountries.map((country) => {
            const isEnabled = enabledCodes.includes(country.code)
            const isOnly = isEnabled && enabledCodes.length === 1

            return (
              <label
                key={country.code}
                className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition ${
                  isEnabled
                    ? "border-orange-300 bg-orange-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleCountry(country.code)}
                  disabled={isOnly}
                  className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50"
                />
                <div>
                  <div className="font-medium text-gray-900">{country.name}</div>
                  <div className="text-xs text-gray-500">
                    {country.code} &middot; {country.currency} ({country.currencySymbol})
                  </div>
                </div>
              </label>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {enabledCodes.length === 1
              ? "Single-country mode: country selectors will be hidden across the platform"
              : `${enabledCodes.length} countries enabled: users will see country selectors`}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}
