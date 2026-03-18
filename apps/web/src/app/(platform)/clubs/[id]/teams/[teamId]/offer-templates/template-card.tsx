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
  teamId,
}: {
  template: Template
  teamId: string
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm("Archive this template? Existing offers won't be affected.")) return

    setIsDeleting(true)
    try {
      await fetch(`/api/teams/${teamId}/offer-templates/${template.id}`, {
        method: "DELETE",
      })
      router.refresh()
    } catch {
      alert("Failed to archive template")
    } finally {
      setIsDeleting(false)
    }
  }

  const includedItems = [
    template.includesUniform && "Uniform",
    template.includesTracksuit && "Tracksuit",
    template.includesShoes && "Shoes",
    template.includesBall && "Basketball",
    template.includesBag && "Bag",
  ].filter(Boolean)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-gray-900">{template.name}</h4>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-xs text-gray-400 hover:text-red-600"
        >
          {isDeleting ? "..." : "Archive"}
        </button>
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
