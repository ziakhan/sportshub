"use client"

import { useState } from "react"

const UNIFORM_SIZES = [
  { value: "YS", label: "Youth Small" },
  { value: "YM", label: "Youth Medium" },
  { value: "YL", label: "Youth Large" },
  { value: "AS", label: "Adult Small" },
  { value: "AM", label: "Adult Medium" },
  { value: "AL", label: "Adult Large" },
  { value: "AXL", label: "Adult XL" },
]

export function OfferResponseForm({
  offerId,
  action,
  onDone,
  onCancel,
}: {
  offerId: string
  action: "accept"
  onDone: () => void
  onCancel: () => void
}) {
  const [uniformSize, setUniformSize] = useState("")
  const [jerseyPref1, setJerseyPref1] = useState("")
  const [jerseyPref2, setJerseyPref2] = useState("")
  const [jerseyPref3, setJerseyPref3] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!uniformSize) {
      setError("Please select a uniform size")
      return
    }
    if (!jerseyPref1) {
      setError("Please enter at least your first jersey number preference")
      return
    }

    const pref1 = parseInt(jerseyPref1)
    const pref2 = jerseyPref2 ? parseInt(jerseyPref2) : undefined
    const pref3 = jerseyPref3 ? parseInt(jerseyPref3) : undefined

    if (isNaN(pref1) || pref1 < 0 || pref1 > 99) {
      setError("Jersey numbers must be between 0 and 99")
      return
    }

    // Check for duplicates
    const prefs = [pref1, pref2, pref3].filter((p) => p !== undefined)
    if (new Set(prefs).size !== prefs.length) {
      setError("Jersey number preferences must be different")
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          uniformSize,
          jerseyPref1: pref1,
          jerseyPref2: pref2,
          jerseyPref3: pref3,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to accept offer")
      }

      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-4">
      <h4 className="font-semibold text-gray-900 mb-3">Accept Offer</h4>
      <p className="text-sm text-gray-600 mb-4">
        Please provide uniform size and your preferred jersey numbers (3 choices).
        Jersey numbers are assigned first-come, first-served based on your preferences.
      </p>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Uniform Size <span className="text-red-500">*</span>
          </label>
          <select
            value={uniformSize}
            onChange={(e) => setUniformSize(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select size...</option>
            {UNIFORM_SIZES.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label} ({size.value})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Jersey Number Preferences <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">1st Choice</label>
              <input
                type="number"
                min="0"
                max="99"
                value={jerseyPref1}
                onChange={(e) => setJerseyPref1(e.target.value)}
                placeholder="#"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-center shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">2nd Choice</label>
              <input
                type="number"
                min="0"
                max="99"
                value={jerseyPref2}
                onChange={(e) => setJerseyPref2(e.target.value)}
                placeholder="#"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-center shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">3rd Choice</label>
              <input
                type="number"
                min="0"
                max="99"
                value={jerseyPref3}
                onChange={(e) => setJerseyPref3(e.target.value)}
                placeholder="#"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-center shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? "Accepting..." : "Confirm & Accept"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
