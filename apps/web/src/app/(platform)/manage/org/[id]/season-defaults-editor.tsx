"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, PanelHeader, DateTimePicker } from "@/components/ui"
import { QuestionBuilder } from "@/components/question-builder"
import { normalizeQuestions, type ApplicationQuestion } from "@/lib/registration/questions"

const inputCls =
  "rounded-lg border border-ink-200 px-2 py-1.5 text-sm text-ink-900 focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

const TIEBREAKERS = [
  { key: "HEAD_TO_HEAD", label: "Head-to-head" },
  { key: "POINT_DIFFERENTIAL", label: "Point diff" },
  { key: "POINTS_SCORED", label: "Points scored" },
  { key: "POINTS_ALLOWED", label: "Points allowed" },
  { key: "WINS", label: "Wins" },
  { key: "COIN_FLIP", label: "Coin flip" },
]

/**
 * The organization's season rulebook (Phase A): set once here, every league
 * inherits live; a league only overrides where it genuinely differs. Every
 * field is optional — empty = "each league decides".
 */
export function SeasonDefaultsEditor({
  orgId,
  orgName,
  initial,
}: {
  orgId: string
  orgName: string
  initial: Record<string, any> | null
}) {
  const router = useRouter()
  const d = initial ?? {}
  const num = (v: any) => (v == null ? "" : String(v))
  // Cycle dates
  const [cycleStart, setCycleStart] = useState<string>(d.cycleStartDate?.slice(0, 10) ?? "")
  const [cycleEnd, setCycleEnd] = useState<string>(d.cycleEndDate?.slice(0, 10) ?? "")
  const [cycleDeadline, setCycleDeadline] = useState<string>(
    d.cycleRegistrationDeadline?.slice(0, 10) ?? ""
  )
  // Games & format
  const [gamesGuaranteed, setGamesGuaranteed] = useState(num(d.gamesGuaranteed))
  const [gamePeriods, setGamePeriods] = useState<string>(d.gamePeriods ?? "")
  const [periodLength, setPeriodLength] = useState(num(d.periodLengthMinutes))
  const [gameLength, setGameLength] = useState(num(d.gameLengthMinutes))
  const [slotLength, setSlotLength] = useState(num(d.gameSlotMinutes))
  // Money
  const [teamFee, setTeamFee] = useState(num(d.teamFee))
  const [depositOn, setDepositOn] = useState<boolean>(d.depositPct != null)
  const [depositPct, setDepositPct] = useState(num(d.depositPct ?? 50))
  const [balanceDays, setBalanceDays] = useState(num(d.balanceDueDaysBeforeStart))
  // Rules
  const [tiebreakers, setTiebreakers] = useState<string[]>(
    Array.isArray(d.tiebreakerOrder) ? d.tiebreakerOrder : []
  )
  const [guests, setGuests] = useState<"" | "yes" | "no">(
    d.allowGuestPlayers == null ? "" : d.allowGuestPlayers ? "yes" : "no"
  )
  const [minGames, setMinGames] = useState(num(d.playoffMinGames))
  // Registration
  const [questions, setQuestions] = useState<ApplicationQuestion[]>(
    normalizeQuestions(d.applicationQuestions)
  )

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const body = {
        seasonDefaults: {
          cycleStartDate: cycleStart ? new Date(cycleStart).toISOString() : null,
          cycleEndDate: cycleEnd ? new Date(cycleEnd).toISOString() : null,
          cycleRegistrationDeadline: cycleDeadline
            ? new Date(cycleDeadline).toISOString()
            : null,
          gamesGuaranteed: gamesGuaranteed ? parseInt(gamesGuaranteed) : null,
          gamePeriods: gamePeriods || null,
          periodLengthMinutes: periodLength ? parseInt(periodLength) : null,
          gameLengthMinutes: gameLength ? parseInt(gameLength) : null,
          gameSlotMinutes: slotLength ? parseInt(slotLength) : null,
          teamFee: teamFee ? parseFloat(teamFee) : null,
          depositPct: depositOn && depositPct ? parseInt(depositPct) : null,
          balanceDueDaysBeforeStart: balanceDays ? parseInt(balanceDays) : null,
          tiebreakerOrder: tiebreakers.length > 0 ? tiebreakers : null,
          allowGuestPlayers: guests === "" ? null : guests === "yes",
          playoffMinGames: minGames ? parseInt(minGames) : null,
          applicationQuestions: (() => {
            const filled = questions.filter((q) => q.label.trim())
            return filled.length > 0 ? filled : null
          })(),
        },
      }
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't save")
      setMessage("Saved — every league inherits these unless it overrides.")
      router.refresh()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't save")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-ink-100 shadow-soft space-y-5 rounded-2xl border bg-white p-5">
      <PanelHeader
        title="Season defaults"
        action={
          <Button size="sm" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save defaults"}
          </Button>
        }
      />
      <p className="text-ink-500 -mt-3 text-sm">
        {orgName}&apos;s rulebook. Every league inherits these automatically — a league only
        sets what genuinely differs. Empty fields mean &quot;each league decides&quot;.
      </p>

      <section>
        <h3 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">
          Season cycle
        </h3>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-ink-600 mb-0.5 block text-xs">Start</label>
            <DateTimePicker mode="date" value={cycleStart} onChange={setCycleStart} className="w-36" />
          </div>
          <div>
            <label className="text-ink-600 mb-0.5 block text-xs">End</label>
            <DateTimePicker mode="date" value={cycleEnd} onChange={setCycleEnd} className="w-36" />
          </div>
          <div>
            <label className="text-ink-600 mb-0.5 block text-xs">Registration deadline</label>
            <DateTimePicker mode="date" value={cycleDeadline} onChange={setCycleDeadline} className="w-36" />
          </div>
        </div>
        <p className="text-ink-400 mt-1 text-xs">
          New seasons start prefilled with these dates (editable per season).
        </p>
      </section>

      <section>
        <h3 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">
          Games &amp; format
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-ink-600 mb-0.5 block text-xs">Games per team</label>
            <input value={gamesGuaranteed} onChange={(e) => setGamesGuaranteed(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputCls + " w-20"} />
          </div>
          <div>
            <label className="text-ink-600 mb-0.5 block text-xs">Format</label>
            <select value={gamePeriods} onChange={(e) => setGamePeriods(e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option value="HALVES">2 Halves</option>
              <option value="QUARTERS">4 Quarters</option>
            </select>
          </div>
          <div>
            <label className="text-ink-600 mb-0.5 block text-xs">Half/quarter (min)</label>
            <input value={periodLength} onChange={(e) => setPeriodLength(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputCls + " w-20"} />
          </div>
          <div>
            <label className="text-ink-600 mb-0.5 block text-xs">Game length (min)</label>
            <input value={gameLength} onChange={(e) => setGameLength(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputCls + " w-20"} />
          </div>
          <div>
            <label className="text-ink-600 mb-0.5 block text-xs">Slot length (min)</label>
            <input value={slotLength} onChange={(e) => setSlotLength(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputCls + " w-20"} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">Money</h3>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-ink-600 mb-0.5 block text-xs">Team entry fee ($)</label>
            <input value={teamFee} onChange={(e) => setTeamFee(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className={inputCls + " w-24"} />
          </div>
          <label className="flex items-center gap-2 pt-4 text-sm">
            <input type="checkbox" checked={depositOn} onChange={(e) => setDepositOn(e.target.checked)} />
            <span className="text-ink-900 font-medium">Deposit</span>
            {depositOn && (
              <span className="flex items-center gap-1">
                <input value={depositPct} onChange={(e) => setDepositPct(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className={inputCls + " w-14"} />
                <span className="text-ink-500 text-xs">%</span>
              </span>
            )}
          </label>
          <label className="flex items-center gap-1.5 pt-4 text-sm">
            <span className="text-ink-900 font-medium">Balance due</span>
            <input value={balanceDays} onChange={(e) => setBalanceDays(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" className={inputCls + " w-16"} />
            <span className="text-ink-500 text-xs">days before start</span>
          </label>
        </div>
      </section>

      <section>
        <h3 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">Rules</h3>
        <div className="space-y-2">
          <div>
            <span className="text-ink-600 block text-xs">Tiebreaker order (click to add)</span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {tiebreakers.map((k, i) => (
                <button
                  key={k}
                  onClick={() => setTiebreakers((prev) => prev.filter((x) => x !== k))}
                  className="bg-play-600 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                  title="Remove"
                >
                  {i + 1}. {TIEBREAKERS.find((t) => t.key === k)?.label ?? k} ×
                </button>
              ))}
              {TIEBREAKERS.filter((t) => !tiebreakers.includes(t.key)).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTiebreakers((prev) => [...prev, t.key])}
                  className="border-ink-200 text-ink-600 hover:border-play-300 rounded-full border px-2.5 py-1 text-xs"
                >
                  + {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-ink-600 mb-0.5 block text-xs">Guest players</label>
              <select value={guests} onChange={(e) => setGuests(e.target.value as any)} className={inputCls}>
                <option value="">—</option>
                <option value="yes">Allowed</option>
                <option value="no">Not allowed</option>
              </select>
            </div>
            <div>
              <label className="text-ink-600 mb-0.5 block text-xs">Playoff min games</label>
              <input value={minGames} onChange={(e) => setMinGames(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className={inputCls + " w-16"} />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide">
          Registration
        </h3>
        <p className="text-ink-600 mb-1.5 text-xs">Club application questions</p>
        <div className="max-w-2xl">
          <QuestionBuilder value={questions} onChange={setQuestions} />
        </div>
      </section>

      {message && (
        <p className="text-ink-700 bg-court-50 border-court-200 rounded-lg border px-3 py-2 text-sm">
          {message}
        </p>
      )}
    </div>
  )
}
