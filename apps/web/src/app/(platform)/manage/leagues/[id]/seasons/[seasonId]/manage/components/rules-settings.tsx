"use client"

import { useState } from "react"
import { PanelHeader } from "@/components/ui"
import { inputClass, panelClass } from "./types"
import { GameDayPolicies } from "./game-day-policies"
import { TiebreakersTab } from "./tiebreakers-tab"

/**
 * Settings › Rules — the season's competitive rules in one panel. These
 * lived in three tabs before the IA redesign (eligibility in Playoffs,
 * format in Scheduling, guests in Scheduling, tiebreakers alone).
 */
export function RulesSettings({
  league,
  patchSeason,
}: {
  league: any
  patchSeason: (body: Record<string, any>) => Promise<void>
}) {
  const [minGamesDraft, setMinGamesDraft] = useState<string>(
    league?.playoffMinGames != null ? String(league.playoffMinGames) : ""
  )
  const [rulesBusy, setRulesBusy] = useState(false)
  const saveEligibility = async () => {
    setRulesBusy(true)
    try {
      await patchSeason({
        playoffMinGames: minGamesDraft === "" ? null : Number(minGamesDraft),
      })
    } finally {
      setRulesBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className={`reveal ${panelClass}`}>
        <PanelHeader title="Playoffs" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">Playoff format</label>
            <select
              value={league.playoffFormat || ""}
              onChange={(e) => patchSeason({ playoffFormat: e.target.value || null })}
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
              onBlur={(e) =>
                patchSeason({ playoffTeams: e.target.value ? parseInt(e.target.value) : null })
              }
              className={inputClass + " w-full"}
            />
          </div>
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Minimum games played to be playoff-eligible
            </label>
            <div className="flex items-center gap-2">
              <input
                value={minGamesDraft}
                onChange={(e) => setMinGamesDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="e.g. 5"
                inputMode="numeric"
                className={inputClass + " w-24"}
              />
              <button
                onClick={saveEligibility}
                disabled={rulesBusy}
                className="bg-play-600 rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
            <p className="text-ink-400 mt-1 text-[10px]">
              Leave empty for no rule. Eligibility is computed from the scorekeeper&apos;s
              attendance roll call across completed games; overrule any player from their team
              page (a written note is required).
            </p>
          </div>
        </div>
        <p className="text-ink-500 mt-3 text-xs">
          Brackets are generated on the Playoffs tab once the season is underway.
        </p>
      </div>

      <GameDayPolicies league={league} patchSeason={patchSeason} />

      <TiebreakersTab league={league} patchSeason={patchSeason} />
    </div>
  )
}
