"use client"

import { useState, useEffect } from "react"
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

export function MakeOfferButton({
  teamId,
  teamName,
  playerId,
  playerName,
  tryoutSignupId,
  clubId,
}: {
  teamId: string
  teamName: string
  playerId: string
  playerName: string
  tryoutSignupId: string
  clubId: string
}) {
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const router = useRouter()

  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [seasonFee, setSeasonFee] = useState("0")
  const [installments, setInstallments] = useState("1")
  const [practiceSessions, setPracticeSessions] = useState("0")
  const [includesBall, setIncludesBall] = useState(false)
  const [includesBag, setIncludesBag] = useState(false)
  const [includesShoes, setIncludesShoes] = useState(false)
  const [includesUniform, setIncludesUniform] = useState(false)
  const [includesTracksuit, setIncludesTracksuit] = useState(false)
  const [message, setMessage] = useState("")
  const [expiresInDays, setExpiresInDays] = useState("7")

  useEffect(() => {
    if (showForm && templates.length === 0) {
      setLoadingTemplates(true)
      fetch(`/api/clubs/${clubId}/offer-templates`)
        .then((res) => res.json())
        .then((data) => setTemplates(data.templates || []))
        .catch(() => {})
        .finally(() => setLoadingTemplates(false))
    }
  }, [showForm, teamId, templates.length, clubId])

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (!templateId) return

    const tmpl = templates.find((t) => t.id === templateId)
    if (tmpl) {
      setSeasonFee(tmpl.seasonFee.toString())
      setInstallments(tmpl.installments.toString())
      setPracticeSessions(tmpl.practiceSessions.toString())
      setIncludesBall(tmpl.includesBall)
      setIncludesBag(tmpl.includesBag)
      setIncludesShoes(tmpl.includesShoes)
      setIncludesUniform(tmpl.includesUniform)
      setIncludesTracksuit(tmpl.includesTracksuit)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays))

      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          playerId,
          tryoutSignupId,
          templateId: selectedTemplateId || undefined,
          seasonFee: parseFloat(seasonFee),
          installments: parseInt(installments),
          practiceSessions: parseInt(practiceSessions),
          includesBall,
          includesBag,
          includesShoes,
          includesUniform,
          includesTracksuit,
          message: message || undefined,
          expiresAt: expiresAt.toISOString(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create offer")
      }

      setSuccess(true)
      setTimeout(() => router.refresh(), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return <span className="text-xs font-medium text-green-600">Offer sent!</span>
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
      >
        Make Offer
      </button>
    )
  }

  const includedItems = [
    includesUniform && "Uniform",
    includesTracksuit && "Tracksuit",
    includesShoes && "Shoes",
    includesBall && "Basketball",
    includesBag && "Bag",
  ].filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-1 text-lg font-semibold text-gray-900">Make Offer</h3>
        <p className="mb-4 text-sm text-gray-600">
          Offering <strong>{playerName}</strong> a spot on <strong>{teamName}</strong>
        </p>

        {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Template selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Template</label>
            {loadingTemplates ? (
              <div className="mt-1 text-sm text-gray-500">Loading templates...</div>
            ) : templates.length > 0 ? (
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="">Custom (no template)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} - ${t.seasonFee.toFixed(2)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                No templates yet.{" "}
                <a
                  href={`/clubs/${clubId}/offer-templates`}
                  className="text-orange-600 hover:underline"
                  target="_blank"
                >
                  Create one
                </a>{" "}
                for faster offers.
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Fee ($)</label>
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
                    {n === 1 ? "Full" : `${n}x`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sessions</label>
              <input
                type="number"
                min="0"
                value={practiceSessions}
                onChange={(e) => setPracticeSessions(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Included items */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Includes</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  key: "uniform",
                  label: "Uniform",
                  desc: "Shirt + Shorts",
                  checked: includesUniform,
                  set: setIncludesUniform,
                },
                {
                  key: "tracksuit",
                  label: "Tracksuit",
                  desc: "Jacket + Pants",
                  checked: includesTracksuit,
                  set: setIncludesTracksuit,
                },
                {
                  key: "shoes",
                  label: "Shoes",
                  desc: "Basketball shoes",
                  checked: includesShoes,
                  set: setIncludesShoes,
                },
                {
                  key: "ball",
                  label: "Basketball",
                  desc: "Game ball",
                  checked: includesBall,
                  set: setIncludesBall,
                },
                {
                  key: "bag",
                  label: "Bag",
                  desc: "Equipment bag",
                  checked: includesBag,
                  set: setIncludesBag,
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 p-2 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.set(e.target.checked)}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <div>
                    <div className="text-xs font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-400">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Expires In</label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Congratulations! We'd love to have you on the team..."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {/* Preview */}
          {includedItems.length > 0 && (
            <div className="rounded-md bg-orange-50 p-3">
              <div className="mb-1 text-xs font-medium text-orange-700">Offer includes:</div>
              <div className="text-xs text-orange-600">
                ${parseFloat(seasonFee).toFixed(2)}
                {parseInt(installments) > 1 ? ` (${installments} installments)` : ""}
                {parseInt(practiceSessions) > 0 ? ` + ${practiceSessions} practice sessions` : ""}
                {" + "}
                {includedItems.join(", ")}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {isSubmitting ? "Sending..." : "Send Offer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
