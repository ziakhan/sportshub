"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/countries"
import { Badge, Button, Card, PanelHeader } from "@/components/ui"

interface Template {
  id: string
  name: string
  seasonFee: number
  installments: number
  practiceSessions: number
  gamesMin: number | null
  gamesMax: number | null
  programDescription: string | null
  customItems: string[]
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
  currency,
}: {
  template: Template
  clubId: string
  isAdmin: boolean
  currency?: string
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
  const [gamesMin, setGamesMin] = useState(template.gamesMin?.toString() ?? "")
  const [gamesMax, setGamesMax] = useState(template.gamesMax?.toString() ?? "")
  const [programDescription, setProgramDescription] = useState(template.programDescription ?? "")
  const [customItems, setCustomItems] = useState<string[]>(template.customItems ?? [])
  const [customItemDraft, setCustomItemDraft] = useState("")
  const [includesBall, setIncludesBall] = useState(template.includesBall)
  const [includesBag, setIncludesBag] = useState(template.includesBag)
  const [includesShoes, setIncludesShoes] = useState(template.includesShoes)
  const [includesUniform, setIncludesUniform] = useState(template.includesUniform)
  const [includesTracksuit, setIncludesTracksuit] = useState(template.includesTracksuit)

  const addCustomItem = () => {
    const value = customItemDraft.trim()
    if (!value || customItems.length >= 12) return
    setCustomItems([...customItems, value])
    setCustomItemDraft("")
  }

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
      const parsedMin = gamesMin.trim() ? parseInt(gamesMin, 10) : null
      const parsedMax = gamesMax.trim() ? parseInt(gamesMax, 10) : null

      const res = await fetch(`/api/clubs/${clubId}/offer-templates/${template.id}`, {
        method: "PATCH",
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
          programDescription: programDescription.trim() || null,
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
    setGamesMin(template.gamesMin?.toString() ?? "")
    setGamesMax(template.gamesMax?.toString() ?? "")
    setProgramDescription(template.programDescription ?? "")
    setCustomItems(template.customItems ?? [])
    setCustomItemDraft("")
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
    ...(template.customItems ?? []),
  ].filter(Boolean)

  // Games are the headline (owner ruling 2026-07-24, refines QA-211).
  const gamesLabel =
    template.gamesMin == null && template.gamesMax == null
      ? null
      : template.gamesMin != null && template.gamesMax != null && template.gamesMin !== template.gamesMax
        ? `${template.gamesMin}-${template.gamesMax} games`
        : `${template.gamesMin ?? template.gamesMax} games`

  if (isEditing) {
    return (
      <div className="shadow-soft h-full rounded-2xl border-2 border-[color:var(--brand-line)] bg-white p-5">
        <PanelHeader title="Edit template" />

        {error && (
          <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-600">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-600">Games (from / to)</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="200"
                value={gamesMin}
                onChange={(e) => setGamesMin(e.target.value)}
                placeholder="From"
                className="block w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
              />
              <span className="text-ink-400">&ndash;</span>
              <input
                type="number"
                min="0"
                max="200"
                value={gamesMax}
                onChange={(e) => setGamesMax(e.target.value)}
                placeholder="To"
                className="block w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-600">Season Fee ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={seasonFee}
                onChange={(e) => setSeasonFee(e.target.value)}
                className="mt-1 block w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600">Installments</label>
              <select
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className="mt-1 block w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
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
            <label className="block text-xs font-medium text-ink-600">
              Practice Sessions (total for the season)
            </label>
            <input
              type="number"
              min="0"
              value={practiceSessions}
              onChange={(e) => setPracticeSessions(e.target.value)}
              className="mt-1 block w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-600">Program Description</label>
            <p className="text-ink-400 mb-1 text-[11px]">
              Describe the season: leagues, tournaments, total games (e.g. 2 leagues, 2
              tournaments, about 18 games).
            </p>
            <textarea
              value={programDescription}
              onChange={(e) => setProgramDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. 2 leagues, 2 tournaments, about 18 games"
              className="mt-1 block w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Included Items</label>
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
                    className="rounded border-ink-200 text-play-700 focus:ring-play-500/20"
                  />
                  <span className="text-sm text-ink-700">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">
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
                className="block w-full rounded-md border border-ink-200 px-2.5 py-1.5 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
              />
              <Button
                size="sm"
                type="button"
                variant="subtle"
                className="shrink-0"
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
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="subtle" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <Card size="sm" className="h-full transition-all duration-200 hover:border-[color:var(--brand-line)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-condensed text-ink-950 text-lg font-bold uppercase leading-tight tracking-wide">
            {template.name}
          </h4>
          {gamesLabel && (
            <span className="bg-play-50 text-play-700 mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold">
              {gamesLabel}
            </span>
          )}
        </div>
        {isAdmin && (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="subtle" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-ink-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              {isDeleting ? "..." : "Archive"}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-500">Season Fee</span>
          <span className="font-condensed text-ink-950 text-base font-bold">
            {formatCurrency(template.seasonFee, currency)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink-500">Payment</span>
          <span className="text-ink-700 font-medium">
            {template.installments === 1 ? "Full payment" : `${template.installments} installments`}
          </span>
        </div>
        {template.practiceSessions > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-ink-500">Practice Sessions</span>
            <span className="text-ink-700 font-medium">{template.practiceSessions}</span>
          </div>
        )}
        {template.programDescription && (
          <p className="text-ink-500 text-xs">{template.programDescription}</p>
        )}
      </div>

      {includedItems.length > 0 && (
        <div className="border-ink-100 mt-3 border-t pt-3">
          <div className="text-ink-500 mb-1.5 text-xs font-medium">Includes</div>
          <div className="flex flex-wrap gap-1.5">
            {includedItems.map((item) => (
              <Badge key={item as string} tone="court">
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
