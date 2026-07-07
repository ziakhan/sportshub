"use client"

import { useState } from "react"
import { inputClass, panelClass } from "./types"

const LOCKED_STATUSES = ["FINALIZED", "IN_PROGRESS", "COMPLETED"]

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
  // Division form
  const [divName, setDivName] = useState("")
  const [divAgeGroup, setDivAgeGroup] = useState("")
  const [divGender, setDivGender] = useState("MALE")
  const [divTier, setDivTier] = useState("1")
  const [divMaxTeams, setDivMaxTeams] = useState("")

  const addDivision = async () => {
    if (!divName || !divAgeGroup) return
    await fetch(`/api/seasons/${seasonId}/divisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: divName,
        ageGroup: divAgeGroup,
        gender: divGender || undefined,
        tier: parseInt(divTier),
        maxTeams: divMaxTeams ? parseInt(divMaxTeams) : undefined,
      }),
    })
    setDivName("")
    setDivAgeGroup("")
    setDivGender("")
    setDivTier("1")
    setDivMaxTeams("")
    refresh()
  }

  return (
    <div className="grid gap-6">
      {/* Divisions */}
      <div className={panelClass}>
        <h3 className="text-ink-900 mb-4 font-semibold">Divisions</h3>
        {locked && (
          <div className="border-amber-200 bg-amber-50 text-amber-800 mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Season is {seasonStatus === "IN_PROGRESS" ? "in progress" : seasonStatus?.toLowerCase()} —
            divisions are locked. Structural changes need the season reopened.
          </div>
        )}
        {divisions.map((d: any) => (
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
              )}
            </div>
          </div>
        ))}
        {!locked && (
        <div className="border-ink-200 mt-4 space-y-2 border-t pt-4">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={divName}
              onChange={(e) => setDivName(e.target.value)}
              placeholder="Division name"
              className={inputClass}
            />
            <select
              value={divAgeGroup}
              onChange={(e) => setDivAgeGroup(e.target.value)}
              className={inputClass}
            >
              <option value="">Age group...</option>
              {["U10", "U12", "U14", "U16", "U18", "U19", "Junior", "Senior"].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={divGender}
              onChange={(e) => setDivGender(e.target.value)}
              className={inputClass}
            >
              <option value="MALE">Boys</option>
              <option value="FEMALE">Girls</option>
              <option value="">Co-ed</option>
            </select>
            <select
              value={divTier}
              onChange={(e) => setDivTier(e.target.value)}
              className={inputClass}
            >
              <option value="1">Tier 1 (Top)</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
            </select>
          </div>
          <input
            type="number"
            min="1"
            max="128"
            value={divMaxTeams}
            onChange={(e) => setDivMaxTeams(e.target.value)}
            placeholder="Max teams (optional)"
            className={inputClass}
          />
          <button
            onClick={addDivision}
            className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition"
          >
            Add Division
          </button>
        </div>
        )}
      </div>
    </div>
  )
}
