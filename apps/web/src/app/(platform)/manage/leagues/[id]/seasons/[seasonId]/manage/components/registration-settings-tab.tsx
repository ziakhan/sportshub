"use client"

import { useState } from "react"
import { PanelHeader, Button } from "@/components/ui"
import { panelClass } from "./types"

/**
 * Registration › Settings (owner 2026-07-29: "why are the onboarding
 * questions in the Playoffs tab?" — they aren't anymore). Everything about
 * HOW clubs enter this season lives here, fully explained.
 */
export function RegistrationSettingsTab({
  league,
  patchSeason,
}: {
  league: any
  patchSeason: (body: Record<string, any>) => Promise<void>
}) {
  const [depositDraft, setDepositDraft] = useState<string>(
    league?.depositPct != null ? String(league.depositPct) : ""
  )
  const [questionsDraft, setQuestionsDraft] = useState<string>(
    Array.isArray(league?.applicationQuestions) ? league.applicationQuestions.join("\n") : ""
  )
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setBusy(true)
    setSaved(false)
    try {
      await patchSeason({
        depositPct: depositDraft === "" ? null : Number(depositDraft),
        applicationQuestions: questionsDraft
          .split("\n")
          .map((q) => q.trim())
          .filter(Boolean),
      })
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`reveal ${panelClass}`}>
      <PanelHeader title="Registration settings" />

      <div className="space-y-6">
        <div>
          <h3 className="text-ink-900 text-sm font-semibold">Entry-fee deposit</h3>
          <p className="text-ink-500 mt-0.5 max-w-2xl text-sm">
            When set, an approved team owes this percentage of the team fee right away and the
            remaining balance 14 days before the season starts. Teams that have paid the deposit
            show a gold &quot;deposit paid&quot; badge; a missed balance date shows red
            &quot;overdue&quot;. Leave empty to ask for the full fee with no schedule.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={depositDraft}
              onChange={(e) => setDepositDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
              inputMode="numeric"
              aria-label="Deposit percentage"
              className="border-ink-200 w-20 rounded-lg border px-3 py-2 text-sm"
            />
            <span className="text-ink-500 text-sm">% of the team fee, due at approval</span>
          </div>
        </div>

        <div>
          <h3 className="text-ink-900 text-sm font-semibold">Club application questions</h3>
          <p className="text-ink-500 mt-0.5 max-w-2xl text-sm">
            Asked ONCE per club when it enters the season (never per team). Write one question
            per line — each line becomes its own answer box on the club&apos;s entry form, and
            the answers appear on the Clubs tab under each entry&apos;s Application.
          </p>
          <textarea
            value={questionsDraft}
            onChange={(e) => setQuestionsDraft(e.target.value)}
            rows={4}
            placeholder={"Brief synopsis of your team and top prospects\nWhy do you want to join this league?\nProgram vision — goals over the next 1, 3 and 5 years"}
            className="border-ink-200 mt-2 w-full max-w-2xl rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        <div className="border-ink-100 rounded-xl border border-dashed p-3">
          <p className="text-ink-500 text-xs">
            The club agreement (terms clubs sign when entering) is a waiver document with the
            &quot;club official&quot; audience — manage it under the league&apos;s Waivers page.
            Parent waivers are separate and go out automatically when teams are approved.
          </p>
        </div>

        {saved && <p className="text-court-700 text-sm font-medium">✓ Saved</p>}
        <Button disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save registration settings"}
        </Button>
      </div>
    </div>
  )
}
