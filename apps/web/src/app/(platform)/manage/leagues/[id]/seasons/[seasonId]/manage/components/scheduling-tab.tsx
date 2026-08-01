"use client"

import { useState } from "react"
import { Button, PanelHeader, DateTimePicker } from "@/components/ui"
import { inputClass, panelClass, type SchedSettings } from "./types"

// Mutations previously ignored res.ok — a 403/500 looked like success and
// refresh() quietly reverted the UI (gap-audit P1 #20). All mutating fetches
// in this tab go through here.
async function checkedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    window.alert((data as { error?: string }).error || "The change couldn't be saved")
  }
  return res
}


export function SchedulingTab({
  seasonId,
  league,
  divisions,
  schedulingGroups,
  schedSettings,
  setSchedSettings,
  patchSeason,
  refresh,
  // Org inheritance (Phase A): when the format settings are inherited (and
  // summarized above), hide the philosophy + settings panels — groups and
  // cross-division stay, they're genuinely per-league.
  hideFormatSettings = false,
  sessionCount,
}: {
  seasonId: string
  league: any
  divisions: any[]
  schedulingGroups: any[]
  schedSettings: SchedSettings
  setSchedSettings: React.Dispatch<React.SetStateAction<SchedSettings>>
  patchSeason: (body: Record<string, any>) => Promise<void>
  refresh: () => void
  hideFormatSettings?: boolean
  /** REGULAR session count — the derived games-per-session line needs it. */
  sessionCount?: number
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
    await checkedFetch(`/api/seasons/${seasonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gamesGuaranteed: schedSettings.gamesGuaranteed
          ? parseInt(schedSettings.gamesGuaranteed)
          : null,
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
    await checkedFetch(`/api/seasons/${seasonId}/scheduling-groups`, {
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
    await checkedFetch(`/api/seasons/${seasonId}/scheduling-groups/${editingGroupId}`, {
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
    await checkedFetch(`/api/seasons/${seasonId}/scheduling-groups/${groupId}`, { method: "DELETE" })
    if (editingGroupId === groupId) setEditingGroupId(null)
    refresh()
  }

  return (
    <div className="space-y-6">
      {/* Philosophy + cross-division + groups */}
      <div className={`reveal ${panelClass}`}>
        <PanelHeader title="Scheduling approach" />
        <div className="space-y-4">
          {!hideFormatSettings && (
          <div>
            <label className="text-ink-700 mb-2 block text-xs font-medium">
              Weekend style (league default)
            </label>
            <div className="space-y-2">
              {[
                {
                  key: "SAME_DAY",
                  label: "One trip",
                  hint: "Both weekend games on the same day, with a break in between — families drive once.",
                },
                {
                  key: "SPLIT_DAYS",
                  label: "Split days",
                  hint: "One game Saturday, one game Sunday — more rest between games.",
                },
              ].map((opt) => {
                const current =
                  league.defaultWeekendStyle ??
                  (league.schedulingPhilosophy === "SPREAD_DAYS" ? "SPLIT_DAYS" : "SAME_DAY")
                return (
                <label
                  key={opt.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
                    current === opt.key
                      ? "border-play-400 bg-play-50"
                      : "border-ink-200 hover:border-ink-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="defaultWeekendStyle"
                    value={opt.key}
                    checked={current === opt.key}
                    onChange={() => patchSeason({ defaultWeekendStyle: opt.key })}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="text-ink-900 block font-medium">{opt.label}</span>
                    <span className="text-ink-500 block text-xs">{opt.hint}</span>
                  </span>
                </label>
                )
              })}
            </div>
            <p className="text-ink-400 mt-1.5 text-[11px]">
              Individual teams can override this on their team page — the team&apos;s choice wins.
            </p>
          </div>
          )}

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
      <div className={`reveal ${panelClass}`} style={{ animationDelay: "70ms" }}>
        <PanelHeader title="Scheduling groups" />
        <p className="text-ink-500 -mt-2 mb-3 text-xs">
          Group divisions that can share a slate (e.g. nearby age groups). Games still
          follow division rules unless cross-division scheduling is on.
        </p>

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
                        <Button size="sm" onClick={saveEditGroup}>
                          Save
                        </Button>
                        <Button size="sm" variant="subtle" onClick={() => setEditingGroupId(null)}>
                          Cancel
                        </Button>
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
          <Button size="sm" block onClick={createSchedulingGroup} disabled={!newGroupName.trim()}>
            Add scheduling group
          </Button>
        </div>
      </div>

      {/* Scheduling Settings */}
      {!hideFormatSettings && (
      <div className={`reveal ${panelClass}`} style={{ animationDelay: "140ms" }}>
        <PanelHeader
          title="Scheduling Settings"
          action={
            <Button size="sm" onClick={saveSchedulingSettings} disabled={schedSaving}>
              {schedSaving ? "Saving…" : "Save Settings"}
            </Button>
          }
        />
        <p className="text-ink-400 -mt-2 mb-5 text-xs">
          Fields marked <span className="text-hoop-600 font-semibold">*</span> are required
          before the league can be finalized
        </p>
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
          {/* Games per session — DERIVED, never typed (owner 2026-07-31:
              "20 games, 1 per session, but there aren't 20 sessions" — the
              old input was dead config the scheduler ignored) */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Games per session per team
            </label>
            <div className="border-ink-100 bg-ink-50/60 rounded-xl border border-dashed px-3 py-2 text-sm">
              {(() => {
                const g = parseInt(schedSettings.gamesGuaranteed) || 0
                const s = sessionCount ?? 0
                if (!g || !s) return <span className="text-ink-400">Set games + sessions first</span>
                return (
                  <span className="text-ink-800">
                    ≈ {Math.ceil(g / s)}{" "}
                    <span className="text-ink-400 text-xs">
                      ({g} games ÷ {s} session{s === 1 ? "" : "s"})
                    </span>
                  </span>
                )
              })()}
            </div>
            <p className="text-ink-400 mt-0.5 text-[10px]">
              Derived. Override per session in the session editor if a weekend differs.
            </p>
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
              <DateTimePicker
                mode="time"
                value={schedSettings.defaultVenueOpenTime}
                onChange={(v) =>
                  setSchedSettings((s) => ({ ...s, defaultVenueOpenTime: v }))
                }
                className="w-28"
              />
              <span className="text-ink-400 text-xs">–</span>
              <DateTimePicker
                mode="time"
                value={schedSettings.defaultVenueCloseTime}
                onChange={(v) =>
                  setSchedSettings((s) => ({ ...s, defaultVenueCloseTime: v }))
                }
                className="w-28"
              />
            </div>
            <p className="text-ink-400 mt-0.5 text-[10px]">
              Session-day times override these defaults
            </p>
          </div>
        </div>

      </div>
      )}
    </div>
  )
}
