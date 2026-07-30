"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { PanelHeader, Button } from "@/components/ui"
import { inputClass, panelClass } from "./types"

/**
 * Settings › Registration — compact, checkbox-driven (owner 2026-07-30:
 * "two settings taking half a page… nobody wants to read"). Explanations
 * live in one short line under each control, not paragraphs.
 */
export function RegistrationSettingsTab({
  league,
  patchSeason,
}: {
  league: any
  patchSeason: (body: Record<string, any>) => Promise<void>
}) {
  const params = useParams()
  const leagueId = params?.id as string

  const [depositOn, setDepositOn] = useState<boolean>(league?.depositPct != null)
  const [depositDraft, setDepositDraft] = useState<string>(
    league?.depositPct != null ? String(league.depositPct) : "50"
  )
  const [balanceDays, setBalanceDays] = useState<string>(
    String(league?.balanceDueDaysBeforeStart ?? 14)
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
        depositPct: depositOn && depositDraft !== "" ? Number(depositDraft) : null,
        balanceDueDaysBeforeStart: balanceDays === "" ? null : Number(balanceDays),
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
      <PanelHeader
        title="Registration"
        action={
          <div className="flex items-center gap-3">
            {saved && <span className="text-court-700 text-sm font-medium">✓ Saved</span>}
            <Button size="sm" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={depositOn}
            onChange={(e) => setDepositOn(e.target.checked)}
          />
          <span className="text-ink-900 font-medium">Deposit required</span>
          {depositOn && (
            <span className="flex items-center gap-1.5">
              <input
                value={depositDraft}
                onChange={(e) => setDepositDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
                inputMode="numeric"
                aria-label="Deposit percentage"
                className={inputClass + " w-16"}
              />
              <span className="text-ink-500">% of the team fee, due at approval</span>
            </span>
          )}
        </label>

        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-ink-900 font-medium">Remaining balance due</span>
          <input
            value={balanceDays}
            onChange={(e) => setBalanceDays(e.target.value.replace(/\D/g, "").slice(0, 3))}
            inputMode="numeric"
            aria-label="Balance due days before start"
            className={inputClass + " w-16"}
          />
          <span className="text-ink-500">days before the season starts</span>
        </label>
        <p className="text-ink-400 -mt-2 text-xs">
          Paid deposits show a gold badge; a missed balance date shows red &quot;overdue&quot;.
        </p>

        <div>
          <p className="text-ink-900 text-sm font-medium">Club application questions</p>
          <textarea
            value={questionsDraft}
            onChange={(e) => setQuestionsDraft(e.target.value)}
            rows={3}
            placeholder={"One question per line, e.g.\nWhy do you want to join this league?"}
            className="border-ink-200 mt-1 w-full max-w-2xl rounded-lg border px-3 py-2 text-sm"
          />
          <p className="text-ink-400 mt-0.5 text-xs">
            Asked once per club at entry; answers appear on the Clubs tab. The club agreement
            itself lives on the{" "}
            <Link href={`/manage/leagues/${leagueId}/waivers`} className="text-play-600 hover:underline">
              Waivers page
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
