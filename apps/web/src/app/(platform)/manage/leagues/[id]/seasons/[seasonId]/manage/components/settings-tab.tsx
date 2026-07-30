"use client"

import { useState } from "react"
import { Button, PanelHeader, DateTimePicker } from "@/components/ui"
import { inputClass, panelClass, type SchedSettings } from "./types"
import { RegistrationSettingsTab } from "./registration-settings-tab"
import { SchedulingTab } from "./scheduling-tab"
import { RulesSettings } from "./rules-settings"
import { DivisionsTab } from "./divisions-tab"

/**
 * ⚙ Settings — ONE page, ordered by importance, with a per-section status
 * strip up top (owner 2026-07-30: "long page is confusing — what's good,
 * what's not, what matters first?"). ✓ = configured, ! = needs attention,
 * ○ = optional and untouched. The chips double as jump links.
 *
 * Org inheritance (Phase A): when the league belongs to an Organization,
 * sections whose values come from the org's season defaults render as
 * read-only SUMMARIES ("Inherited from NPH · Override") — configuration is
 * reading, not entering. Overriding expands the normal form; Reset returns
 * the section to inheritance by clearing its season fields.
 */
type SectionState = "ok" | "attention" | "optional" | "inherited"

/** Which season columns belong to each overridable section (for reset). */
const SECTION_FIELDS: Record<string, Record<string, unknown>> = {
  registration: { depositPct: null, balanceDueDaysBeforeStart: null, applicationQuestions: [] },
  "game-format": {
    gamesGuaranteed: null,
    gamePeriods: null,
    periodLengthMinutes: null,
    gameLengthMinutes: null,
    gameSlotMinutes: null,
    idealGamesPerDayPerTeam: null,
    defaultVenueOpenTime: null,
    defaultVenueCloseTime: null,
    schedulingPhilosophy: null,
  },
  rules: {
    playoffFormat: null,
    playoffTeams: null,
    playoffMinGames: null,
    allowGuestPlayers: null,
    tiebreakerOrder: [],
  },
}

function sectionSource(
  sources: Record<string, string> | undefined,
  sectionKey: string
): "season" | "org" | "mixed" | null {
  if (!sources) return null
  const fields = Object.keys(SECTION_FIELDS[sectionKey] ?? {})
  const relevant = fields.map((f) => sources[f]).filter(Boolean)
  if (relevant.length === 0) return null
  const hasSeason = relevant.includes("season")
  const hasOrg = relevant.includes("org")
  if (hasSeason) return hasOrg ? "mixed" : "season"
  if (hasOrg) return "org"
  return null
}

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
  // Org inheritance context (Phase A): configSources rides on the season
  // payload from getPublicSeason; values on `league` are already EFFECTIVE.
  const sources = league?.configSources as Record<string, string> | undefined
  const orgName: string | null = league?.league?.organization?.name ?? null
  const [overriding, setOverriding] = useState<Record<string, boolean>>({})

  const src = {
    registration: orgName ? sectionSource(sources, "registration") : null,
    "game-format": orgName ? sectionSource(sources, "game-format") : null,
    rules: orgName ? sectionSource(sources, "rules") : null,
  }
  const showsSummary = (key: keyof typeof src) => src[key] === "org" && !overriding[key]

  const stateFor = (key: keyof typeof src, ownState: SectionState): SectionState =>
    src[key] === "org" && (ownState === "ok" || ownState === "optional")
      ? "inherited"
      : ownState

  const sections: Array<{ id: string; label: string; state: SectionState; hint: string }> = [
    {
      id: "basics",
      label: "Basics",
      state:
        league?.startDate && league?.endDate && league?.teamFee != null ? "ok" : "attention",
      hint:
        league?.startDate && league?.endDate && league?.teamFee != null
          ? sources?.teamFee === "org"
            ? "Dates set · fee inherited"
            : "Dates and fee set"
          : "Dates or fee missing",
    },
    {
      id: "divisions",
      label: "Divisions",
      state: divisions.length > 0 ? "ok" : "attention",
      hint: divisions.length > 0 ? `${divisions.length} created` : "None yet",
    },
    {
      id: "registration",
      label: "Registration",
      state: stateFor(
        "registration",
        league?.depositPct != null ||
          (Array.isArray(league?.applicationQuestions) && league.applicationQuestions.length > 0)
          ? "ok"
          : "optional"
      ),
      hint:
        src.registration === "org"
          ? `Inherited from ${orgName}`
          : league?.depositPct != null
            ? `${league.depositPct}% deposit`
            : "Optional — full fee, no questions",
    },
    {
      id: "game-format",
      label: "Game format",
      state: stateFor(
        "game-format",
        league?.gamesGuaranteed && league?.periodLengthMinutes ? "ok" : "attention"
      ),
      hint:
        src["game-format"] === "org"
          ? `Inherited from ${orgName}`
          : league?.gamesGuaranteed && league?.periodLengthMinutes
            ? "Set"
            : "Needed before finalizing",
    },
    {
      id: "rules",
      label: "Rules",
      state: stateFor(
        "rules",
        Array.isArray(league?.tiebreakerOrder) && league.tiebreakerOrder.length > 0
          ? "ok"
          : "attention"
      ),
      hint:
        src.rules === "org"
          ? `Inherited from ${orgName}`
          : Array.isArray(league?.tiebreakerOrder) && league.tiebreakerOrder.length > 0
            ? "Tiebreakers set"
            : "Tiebreakers needed before finalizing",
    },
  ]

  const resetToOrg = async (key: keyof typeof SECTION_FIELDS) => {
    if (
      !window.confirm(
        `Reset this section to ${orgName}'s defaults? This league's own values are cleared.`
      )
    )
      return
    setOverriding((prev) => ({ ...prev, [key]: false }))
    await patchSeason(SECTION_FIELDS[key])
  }

  const overrideBar = (key: keyof typeof SECTION_FIELDS) =>
    orgName && (src[key as keyof typeof src] === "season" || src[key as keyof typeof src] === "mixed" || overriding[key]) ? (
      <div className="border-gold-200 bg-gold-50 mb-2 flex items-center justify-between rounded-xl border px-3 py-1.5 text-xs">
        <span className="text-ink-700 font-medium">Overrides {orgName}&apos;s defaults</span>
        <button
          onClick={() => resetToOrg(key)}
          className="text-play-700 font-semibold hover:underline"
        >
          Reset to organization
        </button>
      </div>
    ) : null

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })

  return (
    <div className="space-y-6">
      {/* Status strip — what's good, what's not, in importance order */}
      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => jump(s.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              s.state === "ok"
                ? "border-court-200 bg-court-50 text-court-700 hover:border-court-300"
                : s.state === "inherited"
                  ? "border-play-200 bg-play-50 text-play-700 hover:border-play-300"
                  : s.state === "attention"
                    ? "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300"
                    : "border-ink-200 bg-white text-ink-500 hover:border-ink-300"
            }`}
            title={s.hint}
          >
            <span>
              {s.state === "ok" || s.state === "inherited"
                ? "✓"
                : s.state === "attention"
                  ? "!"
                  : "○"}
            </span>
            {s.label}
            <span className="hidden font-normal sm:inline">· {s.hint}</span>
          </button>
        ))}
      </div>

      <section id="basics" className="scroll-mt-24">
        <SectionHeading n={1} title="Basics" state={sections[0].state} />
        <BasicsSettings league={league} patchSeason={patchSeason} />
      </section>

      <section id="divisions" className="scroll-mt-24">
        <SectionHeading n={2} title="Divisions" state={sections[1].state} />
        <DivisionsTab
          seasonId={seasonId}
          divisions={divisions}
          seasonStatus={league?.leagueStatus}
          refresh={refresh}
        />
      </section>

      <section id="registration" className="scroll-mt-24">
        <SectionHeading n={3} title="Registration" state={sections[2].state} />
        {showsSummary("registration") ? (
          <InheritedSummary
            orgName={orgName!}
            lines={[
              league?.depositPct != null
                ? `${league.depositPct}% deposit · balance ${league.balanceDueDaysBeforeStart ?? 14} days before start`
                : "Full fee at approval, no deposit",
              `${Array.isArray(league?.applicationQuestions) ? league.applicationQuestions.length : 0} club application question${(league?.applicationQuestions?.length ?? 0) === 1 ? "" : "s"}`,
            ]}
            onOverride={() => setOverriding((p) => ({ ...p, registration: true }))}
          />
        ) : (
          <>
            {overrideBar("registration")}
            <RegistrationSettingsTab league={league} patchSeason={patchSeason} />
          </>
        )}
      </section>

      <section id="game-format" className="scroll-mt-24">
        <SectionHeading n={4} title="Game format & scheduling" state={sections[3].state} />
        {showsSummary("game-format") ? (
          <InheritedSummary
            orgName={orgName!}
            lines={[
              `${league?.gamesGuaranteed ?? "—"} games per team · ${
                league?.gamePeriods === "QUARTERS" ? "4 quarters" : "2 halves"
              }${league?.periodLengthMinutes ? ` × ${league.periodLengthMinutes} min` : ""} · ${league?.gameSlotMinutes ?? 90}-min slots`,
              `Venue hours ${league?.defaultVenueOpenTime ?? "09:00"}–${league?.defaultVenueCloseTime ?? "20:00"} · ${
                league?.schedulingPhilosophy === "SPREAD_DAYS" ? "spread days" : "family-friendly"
              } scheduling`,
            ]}
            onOverride={() => setOverriding((p) => ({ ...p, "game-format": true }))}
          />
        ) : (
          overrideBar("game-format")
        )}
        <SchedulingTab
          seasonId={seasonId}
          league={league}
          divisions={divisions}
          schedulingGroups={schedulingGroups}
          schedSettings={schedSettings}
          setSchedSettings={setSchedSettings}
          patchSeason={patchSeason}
          refresh={refresh}
          hideFormatSettings={showsSummary("game-format")}
        />
      </section>

      <section id="rules" className="scroll-mt-24">
        <SectionHeading n={5} title="Rules" state={sections[4].state} />
        {showsSummary("rules") ? (
          <InheritedSummary
            orgName={orgName!}
            lines={[
              Array.isArray(league?.tiebreakerOrder) && league.tiebreakerOrder.length > 0
                ? `Tiebreakers: ${league.tiebreakerOrder
                    .map((k: string) => k.replaceAll("_", " ").toLowerCase())
                    .join(" → ")}`
                : "No tiebreakers set",
              `Guests ${league?.allowGuestPlayers === false ? "not allowed" : "allowed"}${
                league?.playoffMinGames ? ` · ${league.playoffMinGames} games to be playoff-eligible` : ""
              }${league?.playoffFormat ? ` · playoffs: ${String(league.playoffFormat).replaceAll("_", " ").toLowerCase()}` : ""}`,
            ]}
            onOverride={() => setOverriding((p) => ({ ...p, rules: true }))}
          />
        ) : (
          <>
            {overrideBar("rules")}
            <RulesSettings league={league} patchSeason={patchSeason} />
          </>
        )}
      </section>
    </div>
  )
}

/** Read-only inherited section: configuration as reading, not entering. */
function InheritedSummary({
  orgName,
  lines,
  onOverride,
}: {
  orgName: string
  lines: string[]
  onOverride: () => void
}) {
  return (
    <div className="border-play-100 bg-play-50/40 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {lines.map((line, i) => (
            <p key={i} className="text-ink-800 text-sm">
              {line}
            </p>
          ))}
          <p className="text-ink-400 mt-1.5 text-xs">
            Inherited from <span className="font-semibold">{orgName}</span> — changes there
            apply here automatically.
          </p>
        </div>
        <button
          onClick={onOverride}
          className="border-ink-200 text-ink-700 hover:border-play-300 hover:text-play-700 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
        >
          Override for this league
        </button>
      </div>
    </div>
  )
}

function SectionHeading({ n, title, state }: { n: number; title: string; state: SectionState }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <h2 className="font-condensed text-ink-950 text-lg font-bold uppercase tracking-wide">
        <span className="text-ink-300 mr-1.5">{n}.</span>
        {title}
      </h2>
      {state === "ok" ? (
        <span className="text-court-600 text-sm font-bold">✓</span>
      ) : state === "inherited" ? (
        <span className="bg-play-100 text-play-700 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
          inherited ✓
        </span>
      ) : state === "attention" ? (
        <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
          needs attention
        </span>
      ) : (
        <span className="text-ink-400 text-[10px] font-semibold uppercase">optional</span>
      )}
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
      <PanelHeader
        title="Season basics"
        action={
          <div className="flex items-center gap-3">
            {saved && <span className="text-court-700 text-sm font-medium">✓ Saved</span>}
            <Button size="sm" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      />
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
        </div>
      </div>
    </div>
  )
}
