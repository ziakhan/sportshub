"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, PanelHeader } from "@/components/ui"

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
      <Button
        onClick={() => setIsOpen(true)}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        }
      >
        Create Template
      </Button>
    )
  }

  return (
    <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6">
      <PanelHeader title="New offer template" />

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-700">
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Competitive Package, Development Package"
            required
            className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm shadow-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-700">Season Fee ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={seasonFee}
              onChange={(e) => setSeasonFee(e.target.value)}
              className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm shadow-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700">Installments</label>
            <select
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm shadow-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
            >
              {[1, 2, 3, 4, 6, 12].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "Full payment" : `${n} installments`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700">Practice Sessions</label>
            <input
              type="number"
              min="0"
              value={practiceSessions}
              onChange={(e) => setPracticeSessions(e.target.value)}
              className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm shadow-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">Included Items</label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Uniform", desc: "Shirt + Shorts", checked: includesUniform, set: setIncludesUniform },
              { label: "Tracksuit", desc: "Jacket + Pants", checked: includesTracksuit, set: setIncludesTracksuit },
              { label: "Shoes", desc: "Basketball shoes", checked: includesShoes, set: setIncludesShoes },
              { label: "Basketball", desc: "Game ball", checked: includesBall, set: setIncludesBall },
              { label: "Bag", desc: "Equipment bag", checked: includesBag, set: setIncludesBag },
            ].map((item) => (
              <label
                key={item.label}
                className="border-ink-200 hover:border-ink-300 hover:bg-ink-50 flex cursor-pointer items-center gap-2 rounded-xl border p-3 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => item.set(e.target.checked)}
                  className="rounded border-ink-200 text-play-700 focus:ring-play-500/20"
                />
                <div>
                  <div className="text-sm font-medium text-ink-900">{item.label}</div>
                  <div className="text-xs text-ink-500">{item.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="subtle" onClick={() => { resetForm(); setIsOpen(false) }}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Template"}
          </Button>
        </div>
      </form>
    </div>
  )
}
