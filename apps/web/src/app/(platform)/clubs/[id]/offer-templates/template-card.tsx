"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Template {
  id: string
  name: string
  seasonFee: number
  installments: number
  practiceSessions: number
  includesBall: boolean
  includesBag: boolean
  includesShoes: boolean
  includesUniform: boolean
  includesTracksuit: boolean
}

export function TemplateCard({
  template,
  clubId,
  isAdmin,
}: {
  template: Template
  clubId: string
  isAdmin: boolean
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Edit form state
  const [name, setName] = useState(template.name)
  const [seasonFee, setSeasonFee] = useState(template.seasonFee.toString())
  const [installments, setInstallments] = useState(template.installments.toString())
  const [practiceSessions, setPracticeSessions] = useState(template.practiceSessions.toString())
  const [includesBall, setIncludesBall] = useState(template.includesBall)
  const [includesBag, setIncludesBag] = useState(template.includesBag)
  const [includesShoes, setIncludesShoes] = useState(template.includesShoes)
  const [includesUniform, setIncludesUniform] = useState(template.includesUniform)
  const [includesTracksuit, setIncludesTracksuit] = useState(template.includesTracksuit)

  const handleDelete = async () => {
    if (!confirm("Archive this template? Existing offers won't be affected.")) return

    setIsDeleting(true)
    try {
      await fetch(`/api/clubs/${clubId}/offer-templates/${template.id}`, {
        method: "DELETE",
      })
      router.refresh()
    } catch {
      alert("Failed to archive template")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/clubs/${clubId}/offer-templates/${template.id}`, {
        method: "PATCH",
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
        throw new Error(data.error || "Failed to update template")
      }

      setIsEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setName(template.name)
    setSeasonFee(template.seasonFee.toString())
    setInstallments(template.installments.toString())
    setPracticeSessions(template.practiceSessions.toString())
    setIncludesBall(template.includesBall)
    setIncludesBag(template.includesBag)
    setIncludesShoes(template.includesShoes)
    setIncludesUniform(template.includesUniform)
    setIncludesTracksuit(template.includesTracksuit)
    setError(null)
    setIsEditing(false)
  }

  const includedItems = [
    template.includesUniform && "Uniform",
    template.includesTracksuit && "Tracksuit",
    template.includesShoes && "Shoes",
    template.includesBall && "Basketball",
    template.includesBag && "Bag",
  ].filter(Boolean)

  if (isEditing) {
    return (
      <div className="rounded-lg border-2 border-orange-300 bg-white p-5 shadow-sm">
        <h4 className="font-semibold text-gray-900 mb-3">Edit Template</h4>

        {error && (
          <div className="mb-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">Season Fee ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={seasonFee}
                onChange={(e) => setSeasonFee(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Installments</label>
              <select
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {[1, 2, 3, 4, 6, 12].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "Full" : `${n}x`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600">Practice Sessions</label>
            <input
              type="number"
              min="0"
              value={practiceSessions}
              onChange={(e) => setPracticeSessions(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Included Items</label>
            <div className="space-y-1.5">
              {[
                { label: "Uniform", checked: includesUniform, set: setIncludesUniform },
                { label: "Tracksuit", checked: includesTracksuit, set: setIncludesTracksuit },
                { label: "Shoes", checked: includesShoes, set: setIncludesShoes },
                { label: "Basketball", checked: includesBall, set: setIncludesBall },
                { label: "Bag", checked: includesBag, set: setIncludesBag },
              ].map((item) => (
                <label key={item.label} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.set(e.target.checked)}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-gray-900">{template.name}</h4>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-xs text-gray-400 hover:text-red-600"
            >
              {isDeleting ? "..." : "Archive"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Season Fee</span>
          <span className="font-medium text-gray-900">${template.seasonFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Payment</span>
          <span className="text-gray-700">
            {template.installments === 1 ? "Full payment" : `${template.installments} installments`}
          </span>
        </div>
        {template.practiceSessions > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Practice Sessions</span>
            <span className="text-gray-700">{template.practiceSessions}</span>
          </div>
        )}
      </div>

      {includedItems.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <div className="text-xs font-medium text-gray-500 mb-1">Includes</div>
          <div className="flex flex-wrap gap-1.5">
            {includedItems.map((item) => (
              <span
                key={item as string}
                className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
