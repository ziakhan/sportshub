"use client"

import { useState } from "react"
import { Button, PanelHeader, DateTimePicker } from "@/components/ui"
import { inputClass, panelClass, type SchedSettings } from "./types"
import { RegistrationSettingsTab } from "./registration-settings-tab"
import { SchedulingTab } from "./scheduling-tab"
import { RulesSettings } from "./rules-settings"
import { DivisionsTab } from "./divisions-tab"

/**
 * ⚙ Settings — the ONE place decisions live (IA redesign 2026-07-30, owner
 * ruling: "settings should be in one place"). One scrollable page, stacked
 * visible sections with anchors; no sub-tabs. Work surfaces (Clubs, Teams,
 * Schedule…) stay tabs; everything you decide once is here.
 */
const SECTIONS = [
  { id: "basics", label: "Basics" },
  { id: "registration", label: "Registration" },
  { id: "game-format", label: "Game format & scheduling" },
  { id: "rules", label: "Rules" },
  { id: "divisions", label: "Divisions" },
]

export function SettingsTab({
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
  return (
    <div className="space-y-8">
      {/* Jump row — anchors on one page, never sub-navigation */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-ink-400 font-semibold uppercase tracking-wide">Jump to</span>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" })
            }}
            className="text-play-700 hover:text-play-800 font-medium hover:underline"
          >
            {s.label}
          </a>
        ))}
      </div>

      <section id="basics" className="scroll-mt-24">
        <SectionHeading n={1} title="Basics" sub="Season dates, deadline and entry fee." />
        <BasicsSettings league={league} patchSeason={patchSeason} />
      </section>

      <section id="registration" className="scroll-mt-24">
        <SectionHeading
          n={2}
          title="Registration"
          sub="How clubs enter this season — deposit, application questions, club agreement."
        />
        <RegistrationSettingsTab league={league} patchSeason={patchSeason} />
      </section>

      <section id="game-format" className="scroll-mt-24">
        <SectionHeading
          n={3}
          title="Game format & scheduling"
          sub="Periods, lengths, slots, and how the scheduler fills your sessions."
        />
        <SchedulingTab
          seasonId={seasonId}
          league={league}
          divisions={divisions}
          schedulingGroups={schedulingGroups}
          schedSettings={schedSettings}
          setSchedSettings={setSchedSettings}
          patchSeason={patchSeason}
          refresh={refresh}
        />
      </section>

      <section id="rules" className="scroll-mt-24">
        <SectionHeading
          n={4}
          title="Rules"
          sub="Playoff eligibility and format, guest players, tiebreakers."
        />
        <RulesSettings league={league} patchSeason={patchSeason} />
      </section>

      <section id="divisions" className="scroll-mt-24">
        <SectionHeading
          n={5}
          title="Divisions"
          sub="The brackets teams compete in. Names are composed from age, gender and tier."
        />
        <DivisionsTab
          seasonId={seasonId}
          divisions={divisions}
          seasonStatus={league?.leagueStatus}
          refresh={refresh}
        />
      </section>
    </div>
  )
}

function SectionHeading({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-condensed text-ink-950 text-xl font-bold uppercase tracking-wide">
        <span className="text-ink-300 mr-2">{n}.</span>
        {title}
      </h2>
      <p className="text-ink-500 mt-0.5 text-sm">{sub}</p>
    </div>
  )
}

/** Season basics — previously only editable from the league page's season form. */
function BasicsSettings({
  league,
  patchSeason,
}: {
  league: any
  patchSeason: (body: Record<string, any>) => Promise<void>
}) {
  const toDateInput = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "")
  const [label, setLabel] = useState<string>(league?.label ?? "")
  const [startDate, setStartDate] = useState<string>(toDateInput(league?.startDate))
  const [endDate, setEndDate] = useState<string>(toDateInput(league?.endDate))
  const [deadline, setDeadline] = useState<string>(toDateInput(league?.registrationDeadline))
  const [teamFee, setTeamFee] = useState<string>(
    league?.teamFee != null ? String(league.teamFee) : ""
  )
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setBusy(true)
    setSaved(false)
    try {
      const body: Record<string, any> = {}
      if (label.trim()) body.label = label.trim()
      if (startDate) body.startDate = new Date(startDate).toISOString()
      if (endDate) body.endDate = new Date(endDate).toISOString()
      if (deadline) body.registrationDeadline = new Date(deadline).toISOString()
      body.teamFee = teamFee === "" ? undefined : parseFloat(teamFee)
      await patchSeason(body)
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`reveal ${panelClass}`}>
      <PanelHeader title="Season basics" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-ink-700 mb-1 block text-xs font-medium">Season label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Winter 2026-27"
            className={inputClass + " w-full"}
          />
        </div>
        <div>
          <label className="text-ink-700 mb-1 block text-xs font-medium">Start date</label>
          <DateTimePicker mode="date" value={startDate} onChange={setStartDate} className="w-full" />
        </div>
        <div>
          <label className="text-ink-700 mb-1 block text-xs font-medium">End date</label>
          <DateTimePicker mode="date" value={endDate} onChange={setEndDate} className="w-full" />
        </div>
        <div>
          <label className="text-ink-700 mb-1 block text-xs font-medium">
            Registration deadline
          </label>
          <DateTimePicker mode="date" value={deadline} onChange={setDeadline} className="w-full" />
        </div>
        <div>
          <label className="text-ink-700 mb-1 block text-xs font-medium">Team entry fee ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={teamFee}
            onChange={(e) => setTeamFee(e.target.value)}
            placeholder="e.g. 3990"
            className={inputClass + " w-full"}
          />
          <p className="text-ink-400 mt-0.5 text-[10px]">
            Charged per approved team. The deposit split is under Registration below.
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save basics"}
        </Button>
        {saved && <p className="text-court-700 text-sm font-medium">✓ Saved</p>}
      </div>
    </div>
  )
}
