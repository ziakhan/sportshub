"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function TemplateForm({ clubId }: { clubId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [name, setName] = useState("")
  const [seasonFee, setSeasonFee] = useState("0")
  const [installments, setInstallments] = useState("1")
  const [practiceSessions, setPracticeSessions] = useState("0")
  const [includesBall, setIncludesBall] = useState(false)
  const [includesBag, setIncludesBag] = useState(false)
  const [includesShoes, setIncludesShoes] = useState(false)
  const [includesUniform, setIncludesUniform] = useState(false)
  const [includesTracksuit, setIncludesTracksuit] = useState(false)

  const resetForm = () => {
    setName("")
    setSeasonFee("0")
    setInstallments("1")
    setPracticeSessions("0")
    setIncludesBall(false)
    setIncludesBag(false)
    setIncludesShoes(false)
    setIncludesUniform(false)
    setIncludesTracksuit(false)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/clubs/${clubId}/offer-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          seasonFee: parseFloat(seasonFee),
          installments: parseInt(installments),
          practiceSessions: parseInt(practiceSessions),
          includesBall,
          includesBag,
          includesShoes,
          includesUniform,
          includesTracksuit,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create template")
      }

      resetForm()
      setIsOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
      >
        Create Template
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">New Offer Template</h3>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Competitive Package, Development Package"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Season Fee ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={seasonFee}
              onChange={(e) => setSeasonFee(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Installments</label>
            <select
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {[1, 2, 3, 4, 6, 12].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "Full payment" : `${n} installments`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Practice Sessions</label>
            <input
              type="number"
              min="0"
              value={practiceSessions}
              onChange={(e) => setPracticeSessions(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Included Items</label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Uniform", desc: "Shirt + Shorts", checked: includesUniform, set: setIncludesUniform },
              { label: "Tracksuit", desc: "Jacket + Pants", checked: includesTracksuit, set: setIncludesTracksuit },
              { label: "Shoes", desc: "Basketball shoes", checked: includesShoes, set: setIncludesShoes },
              { label: "Basketball", desc: "Game ball", checked: includesBall, set: setIncludesBall },
              { label: "Bag", desc: "Equipment bag", checked: includesBag, set: setIncludesBag },
            ].map((item) => (
              <label key={item.label} className="flex items-center gap-2 rounded-md border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => item.set(e.target.checked)}
                  className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">{item.label}</div>
                  <div className="text-xs text-gray-500">{item.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => { resetForm(); setIsOpen(false) }}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Template"}
          </button>
        </div>
      </form>
    </div>
  )
}
