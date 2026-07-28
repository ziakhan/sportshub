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
  const [gamesMin, setGamesMin] = useState("")
  const [gamesMax, setGamesMax] = useState("")
  const [programDescription, setProgramDescription] = useState("")
  const [customItems, setCustomItems] = useState<string[]>([])
  const [customItemDraft, setCustomItemDraft] = useState("")
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
    setGamesMin("")
    setGamesMax("")
    setProgramDescription("")
    setCustomItems([])
    setCustomItemDraft("")
    setIncludesBall(false)
    setIncludesBag(false)
    setIncludesShoes(false)
    setIncludesUniform(false)
    setIncludesTracksuit(false)
    setError(null)
  }

  const addCustomItem = () => {
    const value = customItemDraft.trim()
    if (!value || customItems.length >= 12) return
    setCustomItems([...customItems, value])
    setCustomItemDraft("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const parsedMin = gamesMin.trim() ? parseInt(gamesMin, 10) : undefined
      const parsedMax = gamesMax.trim() ? parseInt(gamesMax, 10) : undefined

      const res = await fetch(`/api/clubs/${clubId}/offer-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          seasonFee: parseFloat(seasonFee),
          installments: parseInt(installments),
          practiceSessions: parseInt(practiceSessions),
          // A single number (only "from" or only "to" filled) means the
          // same both ways — a fixed game count.
          gamesMin: parsedMin ?? parsedMax,
          gamesMax: parsedMax ?? parsedMin,
          programDescription: programDescription.trim() || undefined,
          customItems,
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

        <div>
          <label className="block text-sm font-medium text-ink-700">Games (from / to)</label>
          <p className="text-ink-400 mb-1 text-xs">
            Games are the headline for families: enter one number if it&apos;s fixed, or a range.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="200"
              value={gamesMin}
              onChange={(e) => setGamesMin(e.target.value)}
              placeholder="From"
              className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm shadow-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
            />
            <span className="text-ink-400 mt-1">&ndash;</span>
            <input
              type="number"
              min="0"
              max="200"
              value={gamesMax}
              onChange={(e) => setGamesMax(e.target.value)}
              placeholder="To (leave blank if same)"
              className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm shadow-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
            />
          </div>
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
            <label className="block text-sm font-medium text-ink-700">
              Practice Sessions (total for the season)
            </label>
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
          <label className="block text-sm font-medium text-ink-700">Program Description</label>
          <p className="text-ink-400 mb-1 text-xs">
            Describe the season: leagues, tournaments, total games (e.g. 2 leagues, 2 tournaments,
            about 18 games).
          </p>
          <textarea
            value={programDescription}
            onChange={(e) => setProgramDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="e.g. 2 leagues, 2 tournaments, about 18 games"
            className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm shadow-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
          />
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

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">
            Custom Extras <span className="text-ink-400 font-normal">(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customItemDraft}
              onChange={(e) => setCustomItemDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addCustomItem()
                }
              }}
              maxLength={60}
              placeholder="e.g. End-of-season banquet"
              disabled={customItems.length >= 12}
              className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm shadow-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
            />
            <Button
              type="button"
              variant="subtle"
              className="mt-1 shrink-0"
              onClick={addCustomItem}
              disabled={!customItemDraft.trim() || customItems.length >= 12}
            >
              Add
            </Button>
          </div>
          {customItems.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {customItems.map((item, i) => (
                <span
                  key={`${item}-${i}`}
                  className="bg-ink-50 text-ink-700 border-ink-200 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => setCustomItems(customItems.filter((_, j) => j !== i))}
                    className="text-ink-400 hover:text-red-500"
                    aria-label={`Remove ${item}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {customItems.length >= 12 && (
            <p className="text-ink-400 mt-1 text-xs">Maximum of 12 custom items.</p>
          )}
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
