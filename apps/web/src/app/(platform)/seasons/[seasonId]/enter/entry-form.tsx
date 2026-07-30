"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"

export function EntryForm({
  seasonId,
  tenants,
  existing,
  questions,
  agreement,
}: {
  seasonId: string
  tenants: Array<{ id: string; name: string }>
  existing: Array<{ tenantId: string; status: string }>
  questions: string[]
  agreement: { id: string; title: string; body: string } | null
}) {
  const router = useRouter()
  const entered = new Map(existing.map((e) => [e.tenantId, e.status]))
  const available = tenants.filter((t) => !entered.has(t.id))
  const [tenantId, setTenantId] = useState(available[0]?.id ?? "")
  const [planned, setPlanned] = useState("1")
  const [planNote, setPlanNote] = useState("")
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [signature, setSignature] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/seasons/${seasonId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          plannedTeams: Number(planned),
          planNote: planNote.trim() || undefined,
          answers,
          signatureName: signature.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't submit the entry")
      setDone(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit the entry")
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="border-court-200 bg-court-50 rounded-2xl border p-5">
        <p className="text-court-700 font-semibold">Entry submitted.</p>
        <p className="text-ink-600 mt-1 text-sm">
          The league will review your application. Once approved, register each team from your
          club dashboard — rosters, divisions and fees flow from there.
        </p>
      </div>
    )
  }

  const missingAnswers = questions.some((q) => !(answers[q] ?? "").trim())
  const needsSignature = !!agreement && signature.trim().length < 3

  return (
    <div className="border-ink-100 shadow-soft space-y-4 rounded-2xl border bg-white p-5">
      {existing.length > 0 && (
        <p className="text-ink-500 text-xs">
          Already entered:{" "}
          {existing
            .map((e) => `${tenants.find((t) => t.id === e.tenantId)?.name ?? "club"} (${e.status.toLowerCase()})`)
            .join(", ")}
        </p>
      )}
      {available.length === 0 ? (
        <p className="text-ink-600 text-sm">All of your clubs have already entered this season.</p>
      ) : (
        <>
          {available.length > 1 && (
            <div>
              <label className="text-ink-600 mb-1 block text-xs font-medium">Club</label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="border-ink-200 w-full rounded-lg border px-3 py-2 text-sm"
              >
                {available.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-ink-600 mb-1 block text-xs font-medium">
              How many teams do you plan to enter?
            </label>
            <input
              value={planned}
              onChange={(e) => setPlanned(e.target.value.replace(/\D/g, "").slice(0, 2))}
              inputMode="numeric"
              className="border-ink-200 w-24 rounded-lg border px-3 py-2 text-sm"
            />
            <input
              value={planNote}
              onChange={(e) => setPlanNote(e.target.value)}
              placeholder="Optional: which divisions (e.g. 2× U15 Tier 1, 1× U17 Tier 2)"
              className="border-ink-200 mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
            <p className="text-ink-400 mt-1 text-xs">
              Helps the league plan courts and sessions. You can register more or fewer — each
              team is approved individually.
            </p>
          </div>
          {questions.map((q) => (
            <div key={q}>
              <label className="text-ink-600 mb-1 block text-xs font-medium">{q}</label>
              <textarea
                value={answers[q] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })}
                rows={3}
                className="border-ink-200 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          ))}
          {agreement && (
            <div className="border-ink-100 rounded-xl border p-3">
              <p className="text-ink-900 text-sm font-semibold">{agreement.title}</p>
              <div className="text-ink-600 mt-2 max-h-44 overflow-y-auto whitespace-pre-wrap text-xs">
                {agreement.body}
              </div>
              <label className="text-ink-600 mb-1 mt-3 block text-xs font-medium">
                Type your full name to sign on behalf of your club
              </label>
              <input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Full name"
                className="border-ink-200 w-full max-w-sm rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          )}
          {error && <p className="text-hoop-600 text-sm">{error}</p>}
          <Button
            disabled={busy || !tenantId || !planned || missingAnswers || needsSignature}
            onClick={submit}
          >
            {busy ? "Submitting…" : "Submit entry"}
          </Button>
          {(missingAnswers || needsSignature) && (
            <p className="text-ink-400 text-xs">
              {missingAnswers ? "Answer every question. " : ""}
              {needsSignature ? "The agreement must be signed to enter." : ""}
            </p>
          )}
        </>
      )}
    </div>
  )
}
