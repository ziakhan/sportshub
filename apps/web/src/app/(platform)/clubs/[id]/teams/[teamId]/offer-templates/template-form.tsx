"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function TemplateForm({
  teamId,
  clubId,
}: {
  teamId: string
  clubId: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [name, setName] = useState("")
  const [seasonFee, setSeasonFee] = useState("0")
  const [installments, setInstallments] = useState("1")
  const [practiceSessions, setPracticeSessions] = useState("0")
  const [includesBallBag, setIncludesBallBag] = useState(false)
  const [includesShoes, setIncludesShoes] = useState(false)
  const [includesUniform, setIncludesUniform] = useState(false)
  const [includesTracksuit, setIncludesTracksuit] = useState(false)

  const resetForm = () => {
    setName("")
    setSeasonFee("0")
    setInstallments("1")
    setPracticeSessions("0")
    setIncludesBallBag(false)
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
      const res = await fetch(`/api/teams/${teamId}/offer-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          seasonFee: parseFloat(seasonFee),
          installments: parseInt(installments),
          practiceSessions: parseInt(practiceSessions),
          includesBallBag,
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
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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
            placeholder="e.g. Standard Package, Premium Package"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Installments</label>
            <select
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Included Items
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 rounded-md border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={includesUniform}
                onChange={(e) => setIncludesUniform(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Uniform</div>
                <div className="text-xs text-gray-500">Shirt + Shorts</div>
              </div>
            </label>

            <label className="flex items-center gap-2 rounded-md border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={includesTracksuit}
                onChange={(e) => setIncludesTracksuit(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Tracksuit</div>
                <div className="text-xs text-gray-500">Jacket + Pants</div>
              </div>
            </label>

            <label className="flex items-center gap-2 rounded-md border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={includesShoes}
                onChange={(e) => setIncludesShoes(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Shoes</div>
                <div className="text-xs text-gray-500">Basketball shoes</div>
              </div>
            </label>

            <label className="flex items-center gap-2 rounded-md border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={includesBallBag}
                onChange={(e) => setIncludesBallBag(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Ball Bag</div>
                <div className="text-xs text-gray-500">Equipment bag</div>
              </div>
            </label>
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
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Template"}
          </button>
        </div>
      </form>
    </div>
  )
}
