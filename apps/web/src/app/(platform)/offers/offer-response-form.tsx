"use client"

import { useState } from "react"

const CLOTHING_SIZES = [
  { value: "YS", label: "Youth Small" },
  { value: "YM", label: "Youth Medium" },
  { value: "YL", label: "Youth Large" },
  { value: "AS", label: "Adult Small" },
  { value: "AM", label: "Adult Medium" },
  { value: "AL", label: "Adult Large" },
  { value: "AXL", label: "Adult XL" },
]

const SHOE_SIZES = [
  "1",
  "1.5",
  "2",
  "2.5",
  "3",
  "3.5",
  "4",
  "4.5",
  "5",
  "5.5",
  "6",
  "6.5",
  "7",
  "7.5",
  "8",
  "8.5",
  "9",
  "9.5",
  "10",
  "10.5",
  "11",
  "11.5",
  "12",
  "12.5",
  "13",
  "14",
]

export function OfferResponseForm({
  offerId,
  includesUniform,
  includesShoes,
  includesTracksuit,
  onDone,
  onCancel,
}: {
  offerId: string
  includesUniform: boolean
  includesShoes: boolean
  includesTracksuit: boolean
  onDone: () => void
  onCancel: () => void
}) {
  const [uniformSize, setUniformSize] = useState("")
  const [shoeSize, setShoeSize] = useState("")
  const [tracksuitSize, setTracksuitSize] = useState("")
  const [jerseyPref1, setJerseyPref1] = useState("")
  const [jerseyPref2, setJerseyPref2] = useState("")
  const [jerseyPref3, setJerseyPref3] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const labelClass = "block text-sm font-medium text-ink-800"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (includesUniform && !uniformSize) {
      setError("Please select a uniform size")
      return
    }
    if (includesShoes && !shoeSize) {
      setError("Please select a shoe size")
      return
    }
    if (includesTracksuit && !tracksuitSize) {
      setError("Please select a tracksuit size")
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
          action: "accept",
          uniformSize: uniformSize || undefined,
          shoeSize: shoeSize || undefined,
          tracksuitSize: tracksuitSize || undefined,
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

  const hasSizeFields = includesUniform || includesShoes || includesTracksuit

  return (
    <div className="border-court-200 bg-court-50 mt-4 rounded-2xl border p-4">
      <h4 className="text-ink-900 mb-3 font-semibold">Accept Offer</h4>
      <p className="text-ink-700 mb-4 text-sm">
        {hasSizeFields
          ? "Please provide the required sizes and your preferred jersey numbers."
          : "Please provide your preferred jersey numbers (3 choices)."}{" "}
        Jersey numbers are assigned first-come, first-served.
      </p>

      {error && (
        <div className="border-hoop-200 text-hoop-700 mb-3 rounded-md border bg-red-50 p-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Size fields */}
        {hasSizeFields && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {includesUniform && (
              <div>
                <label className={labelClass}>
                  Uniform Size <span className="text-red-500">*</span>
                </label>
                <select
                  value={uniformSize}
                  onChange={(e) => setUniformSize(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select...</option>
                  {CLOTHING_SIZES.map((size) => (
                    <option key={size.value} value={size.value}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {includesTracksuit && (
              <div>
                <label className={labelClass}>
                  Tracksuit Size <span className="text-red-500">*</span>
                </label>
                <select
                  value={tracksuitSize}
                  onChange={(e) => setTracksuitSize(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select...</option>
                  {CLOTHING_SIZES.map((size) => (
                    <option key={size.value} value={size.value}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {includesShoes && (
              <div>
                <label className={labelClass}>
                  Shoe Size <span className="text-red-500">*</span>
                </label>
                <select
                  value={shoeSize}
                  onChange={(e) => setShoeSize(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select...</option>
                  {SHOE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Jersey preferences */}
        <div>
          <label className="text-ink-800 mb-2 block text-sm font-medium">
            Jersey Number Preferences <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-ink-500 mb-1 block text-xs">1st Choice</label>
              <input
                type="number"
                min="0"
                max="99"
                value={jerseyPref1}
                onChange={(e) => setJerseyPref1(e.target.value)}
                placeholder="#"
                className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 block w-full rounded-xl border px-3 py-2 text-center text-sm shadow-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="text-ink-500 mb-1 block text-xs">2nd Choice</label>
              <input
                type="number"
                min="0"
                max="99"
                value={jerseyPref2}
                onChange={(e) => setJerseyPref2(e.target.value)}
                placeholder="#"
                className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 block w-full rounded-xl border px-3 py-2 text-center text-sm shadow-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="text-ink-500 mb-1 block text-xs">3rd Choice</label>
              <input
                type="number"
                min="0"
                max="99"
                value={jerseyPref3}
                onChange={(e) => setJerseyPref3(e.target.value)}
                placeholder="#"
                className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 block w-full rounded-xl border px-3 py-2 text-center text-sm shadow-sm focus:outline-none focus:ring-2"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            {isSubmitting ? "Accepting..." : "Confirm & Accept"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-4 py-2.5 text-sm font-medium transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
