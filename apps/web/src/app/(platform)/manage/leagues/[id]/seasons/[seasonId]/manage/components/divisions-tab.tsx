"use client"

import { useState } from "react"
import { Button, BrandListbox, ChipGroup } from "@/components/ui"
import { inputClass, panelClass } from "./types"
import { AGE_GROUPS, composeDivisionName } from "@/lib/teams/naming"

const LOCKED_STATUSES = ["FINALIZED", "IN_PROGRESS", "COMPLETED"]

/**
 * Structured division editor (league-ia-redesign §4): identity is age group
 * + gender + tier — the display name is ALWAYS composed, never typed. Fixes
 * "sometimes Tier 1 is in the name, sometimes a dropdown".
 */
export function DivisionsTab({
  seasonId,
  divisions,
  seasonStatus,
  refresh,
}: {
  seasonId: string
  divisions: any[]
  seasonStatus?: string
  refresh: () => void
}) {
  const locked = LOCKED_STATUSES.includes(seasonStatus ?? "")
  // Create form — structure pickers only
  const [divAgeGroup, setDivAgeGroup] = useState("")
  const [divGender, setDivGender] = useState("MALE")
  const [divTier, setDivTier] = useState("1")
  const [divMaxTeams, setDivMaxTeams] = useState("")
  // Inline edit — same pickers, only while the season is unlocked
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAgeGroup, setEditAgeGroup] = useState("")
  const [editGender, setEditGender] = useState("")
  const [editTier, setEditTier] = useState("1")
  const [editMaxTeams, setEditMaxTeams] = useState("")
  const [saving, setSaving] = useState(false)

  const startEdit = (d: any) => {
    setEditingId(d.id)
    setEditAgeGroup(d.ageGroup ?? "")
    setEditGender(d.gender ?? "")
    setEditTier(String(d.tier ?? 1))
    setEditMaxTeams(d.maxTeams ? String(d.maxTeams) : "")
  }

  const saveEdit = async (d: any) => {
    const body: Record<string, unknown> = {}
    if (editAgeGroup && editAgeGroup !== d.ageGroup) body.ageGroup = editAgeGroup
    if ((editGender || null) !== (d.gender ?? null)) body.gender = editGender || null
    if (parseInt(editTier) !== (d.tier ?? 1)) body.tier = parseInt(editTier)
    const nextMax = editMaxTeams ? parseInt(editMaxTeams) : null
    if (nextMax !== (d.maxTeams ?? null)) body.maxTeams = nextMax
    if (Object.keys(body).length === 0) {
      setEditingId(null)
      return
    }
    setSaving(true)
    const res = await fetch(`/api/seasons/${seasonId}/divisions?divisionId=${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      window.alert(data.error || "Couldn't update the division.")
      return
    }
    setEditingId(null)
    refresh()
  }

  const addDivision = async () => {
    if (!divAgeGroup) return
    const res = await fetch(`/api/seasons/${seasonId}/divisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ageGroup: divAgeGroup,
        gender: divGender || undefined,
        tier: parseInt(divTier),
        maxTeams: divMaxTeams ? parseInt(divMaxTeams) : undefined,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      window.alert(data.error || "Couldn't create the division.")
      return
    }
    setDivAgeGroup("")
    setDivGender("MALE")
    setDivTier("1")
    setDivMaxTeams("")
    refresh()
  }

  const previewName = divAgeGroup
    ? composeDivisionName({
        ageGroup: divAgeGroup,
        gender: (divGender || null) as any,
        tier: parseInt(divTier),
      })
    : null

  const genderPicker = (value: string, onChange: (v: string) => void) => (
    <ChipGroup
      ariaLabel="Gender"
      value={value}
      onChange={onChange}
      options={[
        { value: "MALE", label: "Boys" },
        { value: "FEMALE", label: "Girls" },
        { value: "", label: "Co-ed" },
      ]}
    />
  )
  const tierPicker = (value: string, onChange: (v: string) => void) => (
    <ChipGroup
      ariaLabel="Tier"
      value={value}
      onChange={onChange}
      options={[
        { value: "1", label: "Tier 1 (Top)" },
        { value: "2", label: "Tier 2" },
        { value: "3", label: "Tier 3" },
        { value: "4", label: "Tier 4" },
      ]}
    />
  )
  const agePicker = (value: string, onChange: (v: string) => void) => (
    <BrandListbox
      ariaLabel="Age group"
      placeholder="Age group..."
      value={value}
      onChange={onChange}
      options={AGE_GROUPS.map((a) => ({ value: a, label: a }))}
    />
  )

  return (
    <div className="grid gap-6">
      {/* Divisions */}
      <div className={panelClass}>
        <h3 className="text-ink-900 mb-1 font-semibold">Divisions</h3>
        <p className="text-ink-500 mb-4 text-xs">
          Pick the structure — age group, gender, tier — and the division&apos;s name writes
          itself, the same way every time.
        </p>
        {locked && (
          <div className="border-amber-200 bg-amber-50 text-amber-800 mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Season is {seasonStatus === "IN_PROGRESS" ? "in progress" : seasonStatus?.toLowerCase()} —
            divisions are locked. Structural changes need the season reopened.
          </div>
        )}
        {divisions.map((d: any) =>
          editingId === d.id ? (
            <div
              key={d.id}
              className="border-court-100 bg-court-50 mb-2 rounded-xl border px-3 py-2"
            >
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {agePicker(editAgeGroup, setEditAgeGroup)}
                  {genderPicker(editGender, setEditGender)}
                  {tierPicker(editTier, setEditTier)}
                </div>
                <input
                  type="number"
                  min="1"
                  max="128"
                  value={editMaxTeams}
                  onChange={(e) => setEditMaxTeams(e.target.value)}
                  placeholder="Max teams (blank = unlimited)"
                  className={inputClass}
                />
                {editAgeGroup && (
                  <p className="text-ink-500 text-xs">
                    Will be named{" "}
                    <span className="text-ink-900 font-semibold">
                      {composeDivisionName({
                        ageGroup: editAgeGroup,
                        gender: (editGender || null) as any,
                        tier: parseInt(editTier),
                      })}
                    </span>
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => saveEdit(d)} disabled={saving || !editAgeGroup}>
                    Save
                  </Button>
                  <Button size="sm" variant="subtle" onClick={() => setEditingId(null)} disabled={saving}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
          <div
            key={d.id}
            className="border-court-100 bg-court-50 mb-2 flex items-center justify-between rounded-xl border px-3 py-2"
          >
            <div>
              <span className="text-ink-900 font-medium">{d.name}</span>
              <span className="text-ink-500 ml-2 text-xs">
                {d.ageGroup}
                {d.gender ? ` • ${d.gender}` : ""}
              </span>
              {d.maxTeams ? (
                <div className="text-ink-500 mt-0.5 text-xs">
                  Capacity: {d._count?.teams || 0}/{d.maxTeams}
                </div>
              ) : (
                <div className="text-ink-400 mt-0.5 text-xs">Capacity: unlimited</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink-400 text-xs">{d._count?.teams || 0} teams</span>
              {!locked && (
                <>
                  <button
                    onClick={() => startEdit(d)}
                    className="text-ink-400 hover:text-ink-700 transition"
                    title="Edit structure"
                    aria-label={`Edit ${d.name}`}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                  <button
                    onClick={async () => {
                      const teamCount = d._count?.teams || 0
                      const warning =
                        teamCount > 0
                          ? `Delete division "${d.name}"? ${teamCount} team${teamCount !== 1 ? "s are" : " is"} assigned to it — this cannot be undone.`
                          : `Delete division "${d.name}"? This cannot be undone.`
                      if (!window.confirm(warning)) return
                      const res = await fetch(
                        `/api/seasons/${seasonId}/divisions?divisionId=${d.id}`,
                        { method: "DELETE" }
                      )
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}))
                        window.alert(data.error || "Couldn't delete the division.")
                      }
                      refresh()
                    }}
                    className="hover:text-hoop-700 text-xs text-red-500"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </div>
          )
        )}
        {!locked && (
        <div className="border-ink-200 mt-4 space-y-2 border-t pt-4">
          <div className="grid grid-cols-3 gap-2">
            {agePicker(divAgeGroup, setDivAgeGroup)}
            {genderPicker(divGender, setDivGender)}
            {tierPicker(divTier, setDivTier)}
          </div>
          <p className="text-ink-400 text-xs">
            Tier groups divisions by competitive level — Tier 1 is the top bracket. Used for
            seeding and standings grouping.
          </p>
          <input
            type="number"
            min="1"
            max="128"
            value={divMaxTeams}
            onChange={(e) => setDivMaxTeams(e.target.value)}
            placeholder="Max teams (optional)"
            className={inputClass}
          />
          {previewName && (
            <p className="text-ink-500 text-xs">
              Will be named <span className="text-ink-900 font-semibold">{previewName}</span>
            </p>
          )}
          <button
            onClick={addDivision}
            disabled={!divAgeGroup}
            className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
          >
            Add Division
          </button>
        </div>
        )}
      </div>
    </div>
  )
}
