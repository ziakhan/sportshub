"use client"

import { useEffect, useState } from "react"

/**
 * Offer composer — builds the package options for one offer
 * (docs/offer-package-options-design.md). The club's template library is
 * the pick list; each added template stamps a tweakable option card onto
 * THIS offer. One option = classic single-package offer; two or more =
 * the family chooses at accept time.
 */

export interface TemplateSummary {
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

export interface OfferPackageDraft {
  label: string
  sourceTemplateId: string | null
  seasonFee: string
  installments: string
  practiceSessions: string
  includesBall: boolean
  includesBag: boolean
  includesShoes: boolean
  includesUniform: boolean
  includesTracksuit: boolean
}

export function packagePayload(drafts: OfferPackageDraft[]) {
  return drafts.map((d) => ({
    label: d.label.trim() || "Package",
    sourceTemplateId: d.sourceTemplateId || undefined,
    seasonFee: parseFloat(d.seasonFee) || 0,
    installments: parseInt(d.installments) || 1,
    practiceSessions: parseInt(d.practiceSessions) || 0,
    includesBall: d.includesBall,
    includesBag: d.includesBag,
    includesShoes: d.includesShoes,
    includesUniform: d.includesUniform,
    includesTracksuit: d.includesTracksuit,
  }))
}

const blankDraft = (): OfferPackageDraft => ({
  label: "",
  sourceTemplateId: null,
  seasonFee: "0",
  installments: "1",
  practiceSessions: "0",
  includesBall: false,
  includesBag: false,
  includesShoes: false,
  includesUniform: false,
  includesTracksuit: false,
})

function draftFromTemplate(t: TemplateSummary): OfferPackageDraft {
  return {
    label: t.name,
    sourceTemplateId: t.id,
    seasonFee: String(t.seasonFee),
    installments: String(t.installments),
    practiceSessions: String(t.practiceSessions),
    includesBall: t.includesBall,
    includesBag: t.includesBag,
    includesShoes: t.includesShoes,
    includesUniform: t.includesUniform,
    includesTracksuit: t.includesTracksuit,
  }
}

const ITEM_FIELDS: Array<{ key: keyof OfferPackageDraft; label: string }> = [
  { key: "includesUniform", label: "Uniform" },
  { key: "includesTracksuit", label: "Tracksuit" },
  { key: "includesShoes", label: "Shoes" },
  { key: "includesBall", label: "Basketball" },
  { key: "includesBag", label: "Bag" },
]

export function OfferComposer({
  clubId,
  packages,
  onChange,
}: {
  clubId: string
  packages: OfferPackageDraft[]
  onChange: (packages: OfferPackageDraft[]) => void
}) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/clubs/${clubId}/offer-templates`)
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clubId])

  function patch(index: number, changes: Partial<OfferPackageDraft>) {
    onChange(packages.map((p, i) => (i === index ? { ...p, ...changes } : p)))
  }

  function addFromTemplate(templateId: string) {
    if (templateId === "__blank__") {
      onChange([...packages, blankDraft()])
      return
    }
    const template = templates.find((t) => t.id === templateId)
    if (template) onChange([...packages, draftFromTemplate(template)])
  }

  const inputClass =
    "border-ink-200 focus:border-play-500 rounded-lg border px-2 py-1.5 text-sm focus:outline-none"

  return (
    <div className="space-y-3">
      {packages.map((pkg, i) => (
        <div key={i} className="border-ink-200 bg-ink-50/40 space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="bg-play-100 text-play-700 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                Option {i + 1}
              </span>
              <input
                value={pkg.label}
                onChange={(e) => patch(i, { label: e.target.value })}
                maxLength={60}
                placeholder={packages.length > 1 ? "e.g. Returning Player" : "Package name"}
                className={`${inputClass} min-w-0 flex-1 font-semibold`}
              />
            </div>
            {packages.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(packages.filter((_, j) => j !== i))}
                className="text-ink-400 shrink-0 text-lg leading-none hover:text-red-500"
                aria-label="Remove option"
              >
                ×
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-ink-500 flex items-center gap-1 text-xs">
              Fee $
              <input
                type="number"
                min="0"
                step="0.01"
                value={pkg.seasonFee}
                onChange={(e) => patch(i, { seasonFee: e.target.value })}
                className={`${inputClass} w-24`}
              />
            </label>
            <label className="text-ink-500 flex items-center gap-1 text-xs">
              Installments
              <input
                type="number"
                min="1"
                max="12"
                value={pkg.installments}
                onChange={(e) => patch(i, { installments: e.target.value })}
                className={`${inputClass} w-16`}
              />
            </label>
            <label className="text-ink-500 flex items-center gap-1 text-xs">
              Practices
              <input
                type="number"
                min="0"
                value={pkg.practiceSessions}
                onChange={(e) => patch(i, { practiceSessions: e.target.value })}
                className={`${inputClass} w-16`}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            {ITEM_FIELDS.map(({ key, label }) => (
              <label key={key} className="text-ink-600 flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={pkg[key] as boolean}
                  onChange={(e) => patch(i, { [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      ))}

      {packages.length < 4 && (
        <select
          value=""
          onChange={(e) => e.target.value && addFromTemplate(e.target.value)}
          className="border-ink-300 text-ink-600 w-full rounded-xl border border-dashed px-3 py-2 text-sm"
        >
          <option value="">
            {packages.length === 0
              ? "+ Add a package (pick a template)…"
              : "+ Add another option (e.g. Returning Player)…"}
          </option>
          {loading && <option disabled>Loading templates…</option>}
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} — ${t.seasonFee}
            </option>
          ))}
          <option value="__blank__">Blank package (no template)</option>
        </select>
      )}
      {packages.length > 1 && (
        <p className="text-ink-400 text-[11px]">
          The family picks ONE of these when they accept — sizes are only asked for what their
          chosen package includes.
        </p>
      )}
    </div>
  )
}
