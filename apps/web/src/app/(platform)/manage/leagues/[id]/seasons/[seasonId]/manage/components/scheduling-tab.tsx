"use client"

import { useState } from "react"
import { inputClass, type SchedSettings } from "./types"

export function SchedulingTab({
  seasonId,
  league,
  divisions,
  schedulingGroups,
  schedSettings,
  setSchedSettings,
  patchSeason,
  refresh,
}: {
  seasonId: string
  league: any
  divisions: any[]
  schedulingGroups: any[]
  schedSettings: SchedSettings
  setSchedSettings: React.Dispatch<React.SetStateAction<SchedSettings>>
  patchSeason: (body: Record<string, any>) => Promise<void>
  refresh: () => void
}) {
  // Scheduling group form
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDivisionIds, setNewGroupDivisionIds] = useState<string[]>([])
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState("")
  const [editGroupDivisionIds, setEditGroupDivisionIds] = useState<string[]>([])

  const [schedSaving, setSchedSaving] = useState(false)

  const saveSchedulingSettings = async () => {
    setSchedSaving(true)
    await fetch(`/api/seasons/${seasonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gamesGuaranteed: schedSettings.gamesGuaranteed
          ? parseInt(schedSettings.gamesGuaranteed)
          : null,
        targetGamesPerSession: parseInt(schedSettings.gamesPerSession) || 1,
        gameLengthMinutes: parseInt(schedSettings.gameLengthMinutes) || 40,
        gameSlotMinutes: parseInt(schedSettings.gameSlotMinutes) || 90,
        gamePeriods: schedSettings.gamePeriods,
        periodLengthMinutes: schedSettings.periodLengthMinutes
          ? parseInt(schedSettings.periodLengthMinutes)
          : null,
        idealGamesPerDayPerTeam: parseInt(schedSettings.idealGamesPerDayPerTeam) || 1,
        defaultVenueOpenTime: schedSettings.defaultVenueOpenTime,
        defaultVenueCloseTime: schedSettings.defaultVenueCloseTime,
      }),
    })
    setSchedSaving(false)
    refresh()
  }

  const createSchedulingGroup = async () => {
    if (!newGroupName.trim()) return
    await fetch(`/api/seasons/${seasonId}/scheduling-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim(), divisionIds: newGroupDivisionIds }),
    })
    setNewGroupName("")
    setNewGroupDivisionIds([])
    refresh()
  }

  const startEditGroup = (group: any) => {
    setEditingGroupId(group.id)
    setEditGroupName(group.name)
    setEditGroupDivisionIds((group.divisions ?? []).map((d: any) => d.divisionId ?? d.division?.id))
  }

  const saveEditGroup = async () => {
    if (!editingGroupId) return
    await fetch(`/api/seasons/${seasonId}/scheduling-groups/${editingGroupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editGroupName, divisionIds: editGroupDivisionIds }),
    })
    setEditingGroupId(null)
    setEditGroupName("")
    setEditGroupDivisionIds([])
    refresh()
  }

  const deleteSchedulingGroup = async (groupId: string) => {
    if (!confirm("Remove this scheduling group?")) return
    await fetch(`/api/seasons/${seasonId}/scheduling-groups/${groupId}`, { method: "DELETE" })
    if (editingGroupId === groupId) setEditingGroupId(null)
    refresh()
  }

  return (
    <div className="space-y-6">
      {/* Philosophy + cross-division + groups */}
      <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
        <h3 className="text-ink-900 mb-4 font-semibold">Scheduling approach</h3>
        <div className="space-y-4">
          <div>
            <label className="text-ink-700 mb-2 block text-xs font-medium">Philosophy</label>
            <div className="space-y-2">
              {[
                {
                  key: "FAMILY_FRIENDLY",
                  label: "Family-friendly",
                  hint: "Pack each team's games into fewer days so families spend less time at venues.",
                },
                {
                  key: "SPREAD_DAYS",
                  label: "Spread days",
                  hint: "Distribute each team's games across more session days for more player rest.",
                },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
                    league.schedulingPhilosophy === opt.key
                      ? "border-play-400 bg-play-50"
                      : "border-ink-200 hover:border-ink-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="schedulingPhilosophy"
                    value={opt.key}
                    checked={league.schedulingPhilosophy === opt.key}
                    onChange={() => patchSeason({ schedulingPhilosophy: opt.key })}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="text-ink-900 block font-medium">{opt.label}</span>
                    <span className="text-ink-500 block text-xs">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <label className="border-ink-200 hover:border-ink-300 flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition">
            <input
              type="checkbox"
              checked={!!league.allowCrossDivisionScheduling}
              onChange={(e) =>
                patchSeason({ allowCrossDivisionScheduling: e.target.checked })
              }
              className="mt-0.5"
            />
            <span>
              <span className="text-ink-900 block font-medium">
                Allow cross-division scheduling
              </span>
              <span className="text-ink-500 block text-xs">
                When enabled, the scheduler may place games between teams in different
                divisions (within a scheduling group) to fill the slate.
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* Scheduling groups */}
      <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-ink-900 font-semibold">Scheduling groups</h3>
            <p className="text-ink-500 mt-0.5 text-xs">
              Group divisions that can share a slate (e.g. nearby age groups). Games still
              follow division rules unless cross-division scheduling is on.
            </p>
          </div>
        </div>

        {schedulingGroups.length === 0 ? (
          <p className="text-ink-500 text-sm">No groups yet. Create one below.</p>
        ) : (
          <div className="space-y-2">
            {schedulingGroups.map((g: any) => {
              const editing = editingGroupId === g.id
              const groupDivisions = (g.divisions ?? []).map(
                (d: any) => d.division ?? d
              ) as any[]
              return (
                <div
                  key={g.id}
                  className="border-court-100 bg-court-50 rounded-xl border px-3 py-2"
                >
                  {editing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        className={inputClass + " w-full"}
                      />
                      <div className="grid grid-cols-2 gap-1">
                        {divisions.map((d: any) => (
                          <label
                            key={d.id}
                            className="bg-white text-ink-700 flex items-center gap-2 rounded-lg px-2 py-1 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={editGroupDivisionIds.includes(d.id)}
                              onChange={(e) =>
                                setEditGroupDivisionIds((ids) =>
                                  e.target.checked
                                    ? [...ids, d.id]
                                    : ids.filter((x) => x !== d.id)
                                )
                              }
                            />
                            {d.name}{" "}
                            <span className="text-ink-400">
                              ({d.ageGroup}
                              {d.gender ? `·${d.gender}` : ""})
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveEditGroup}
                          className="bg-play-600 hover:bg-play-700 rounded-lg px-3 py-1 text-xs font-semibold text-white"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingGroupId(null)}
                          className="text-ink-500 hover:text-ink-700 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-ink-900 font-medium">{g.name}</span>
                        <div className="text-ink-500 mt-0.5 text-xs">
                          {groupDivisions.length === 0
                            ? "No divisions"
                            : groupDivisions
                                .map((d: any) => d?.name)
                                .filter(Boolean)
                                .join(", ")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => startEditGroup(g)}
                          className="text-play-700 hover:text-play-800 text-xs font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteSchedulingGroup(g.id)}
                          className="hover:text-hoop-700 text-xs text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="border-ink-200 mt-4 space-y-2 border-t pt-4">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name (e.g. U10 + U12 boys)"
            className={inputClass + " w-full"}
          />
          {divisions.length > 0 && (
            <div className="grid grid-cols-2 gap-1">
              {divisions.map((d: any) => (
                <label
                  key={d.id}
                  className="bg-ink-50 text-ink-700 flex items-center gap-2 rounded-lg px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={newGroupDivisionIds.includes(d.id)}
                    onChange={(e) =>
                      setNewGroupDivisionIds((ids) =>
                        e.target.checked ? [...ids, d.id] : ids.filter((x) => x !== d.id)
                      )
                    }
                  />
                  {d.name}{" "}
                  <span className="text-ink-400">
                    ({d.ageGroup}
                    {d.gender ? `·${d.gender}` : ""})
                  </span>
                </label>
              ))}
            </div>
          )}
          <button
            onClick={createSchedulingGroup}
            disabled={!newGroupName.trim()}
            className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
          >
            Add scheduling group
          </button>
        </div>
      </div>

      {/* Scheduling Settings */}
      <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-ink-900 font-semibold">Scheduling Settings</h3>
            <p className="text-ink-400 mt-0.5 text-xs">
              Fields marked <span className="text-hoop-600 font-semibold">*</span> are required
              before the league can be finalized
            </p>
          </div>
          <button
            onClick={saveSchedulingSettings}
            disabled={schedSaving}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
          >
            {schedSaving ? "Saving…" : "Save Settings"}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Max games per season */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Max games per team per season <span className="text-hoop-600">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={schedSettings.gamesGuaranteed}
              onChange={(e) => setSchedSettings((s) => ({ ...s, gamesGuaranteed: e.target.value }))}
              placeholder="e.g. 10"
              className={inputClass + " w-full"}
            />
          </div>
          {/* Games per session */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Games per session per team
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={schedSettings.gamesPerSession}
              onChange={(e) => setSchedSettings((s) => ({ ...s, gamesPerSession: e.target.value }))}
              className={inputClass + " w-full"}
            />
          </div>
          {/* Ideal games per day */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Ideal games per day per team
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={schedSettings.idealGamesPerDayPerTeam}
              onChange={(e) =>
                setSchedSettings((s) => ({ ...s, idealGamesPerDayPerTeam: e.target.value }))
              }
              className={inputClass + " w-full"}
            />
            <p className="text-ink-400 mt-0.5 text-[10px]">
              Scheduler only exceeds this if unavoidable
            </p>
          </div>

          {/* Game format — periods */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">Game format</label>
            <select
              value={schedSettings.gamePeriods}
              onChange={(e) => setSchedSettings((s) => ({ ...s, gamePeriods: e.target.value }))}
              className={inputClass + " w-full"}
            >
              <option value="HALVES">2 Halves</option>
              <option value="QUARTERS">4 Quarters</option>
            </select>
          </div>
          {/* Period / half length */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Half / quarter length (min) <span className="text-hoop-600">*</span>
            </label>
            <input
              type="number"
              min="5"
              max="30"
              value={schedSettings.periodLengthMinutes}
              onChange={(e) =>
                setSchedSettings((s) => ({ ...s, periodLengthMinutes: e.target.value }))
              }
              placeholder="e.g. 20 for halves, 10 for quarters"
              className={inputClass + " w-full"}
            />
          </div>
          {/* Total game length */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">Game length (min)</label>
            <input
              type="number"
              min="20"
              max="60"
              value={schedSettings.gameLengthMinutes}
              onChange={(e) =>
                setSchedSettings((s) => ({ ...s, gameLengthMinutes: e.target.value }))
              }
              className={inputClass + " w-full"}
            />
          </div>

          {/* Game slot */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Game slot length (min)
            </label>
            <input
              type="number"
              min="30"
              max="180"
              value={schedSettings.gameSlotMinutes}
              onChange={(e) => setSchedSettings((s) => ({ ...s, gameSlotMinutes: e.target.value }))}
              className={inputClass + " w-full"}
            />
            <p className="text-ink-400 mt-0.5 text-[10px]">Includes warmup + transition buffer</p>
          </div>
          {/* Default courts per venue */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Default courts per venue <span className="text-hoop-600">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={schedSettings.defaultCourtsPerVenue}
              onChange={(e) =>
                setSchedSettings((s) => ({ ...s, defaultCourtsPerVenue: e.target.value }))
              }
              placeholder="e.g. 2"
              className={inputClass + " w-full"}
            />
            <p className="text-ink-400 mt-0.5 text-[10px]">
              Can be overridden per venue in the Venues panel
            </p>
          </div>
          {/* Venue hours */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Default venue hours
            </label>
            <div className="flex items-center gap-1">
              <input
                type="time"
                value={schedSettings.defaultVenueOpenTime}
                onChange={(e) =>
                  setSchedSettings((s) => ({ ...s, defaultVenueOpenTime: e.target.value }))
                }
                className={inputClass + " flex-1"}
              />
              <span className="text-ink-400 text-xs">–</span>
              <input
                type="time"
                value={schedSettings.defaultVenueCloseTime}
                onChange={(e) =>
                  setSchedSettings((s) => ({ ...s, defaultVenueCloseTime: e.target.value }))
                }
                className={inputClass + " flex-1"}
              />
            </div>
            <p className="text-ink-400 mt-0.5 text-[10px]">
              Session-day times override these defaults
            </p>
          </div>
        </div>

        {/* Playoff settings */}
        <div className="border-ink-100 mt-5 border-t pt-4">
          <p className="text-ink-600 mb-3 text-xs font-medium">
            Playoffs (optional — can be set later)
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-ink-700 mb-1 block text-xs font-medium">Playoff format</label>
              <select
                value={league.playoffFormat || ""}
                onChange={async (e) => {
                  await fetch(`/api/seasons/${seasonId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ playoffFormat: e.target.value || null }),
                  })
                  refresh()
                }}
                className={inputClass + " w-full"}
              >
                <option value="">None / TBD</option>
                <option value="SINGLE_ELIMINATION">Single Elimination</option>
                <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                <option value="ROUND_ROBIN">Round Robin</option>
              </select>
            </div>
            <div>
              <label className="text-ink-700 mb-1 block text-xs font-medium">
                Teams advancing to playoffs
              </label>
              <input
                type="number"
                min="2"
                max="64"
                defaultValue={league.playoffTeams || ""}
                placeholder="e.g. 8"
                onBlur={async (e) => {
                  await fetch(`/api/seasons/${seasonId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      playoffTeams: e.target.value ? parseInt(e.target.value) : null,
                    }),
                  })
                  refresh()
                }}
                className={inputClass + " w-full"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
