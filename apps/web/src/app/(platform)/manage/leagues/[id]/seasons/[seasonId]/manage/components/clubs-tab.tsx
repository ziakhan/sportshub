"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge, Button, PanelHeader, toneForStatus } from "@/components/ui"
import { panelClass } from "./types"

/**
 * Clubs view (owner 2026-07-29): the Teams tab groups by team — this groups
 * by CLUB, so the league sees who has entered, each club's teams underneath
 * with status/payment, and drills into the league-side club page. Becomes
 * the Entries view when ClubSeasonEntry ships (league-operator-orgs.md).
 */
export function ClubsTab({
  seasonId,
  leagueId,
  league,
}: {
  seasonId: string
  leagueId: string
  league: any
}) {
  const subs: any[] = league.teams || []
  const byClub = new Map<string, { tenant: any; teams: any[] }>()
  for (const t of subs) {
    const tenant = t.team?.tenant
    if (!tenant) continue
    const entry = byClub.get(tenant.id) ?? { tenant, teams: [] }
    entry.teams.push(t)
    byClub.set(tenant.id, entry)
  }
  const clubs = [...byClub.values()].sort((a, b) => a.tenant.name.localeCompare(b.tenant.name))
  const isPaid = (t: any) => ["PAID_MANUAL", "PAID_STRIPE", "WAIVED"].includes(t.paymentStatus)

  // Season-scoped club blast (owner 2026-07-29): bell + email to every club
  // operator with a team in this season.
  // Level-1 club entries (two-level registration): who committed, planned
  // team counts vs actual submissions, answers, agreement signature.
  const [entries, setEntries] = useState<any[]>([])
  const [questions, setQuestions] = useState<string[]>([])
  const [entryOpen, setEntryOpen] = useState<string | null>(null)
  const [entryBusy, setEntryBusy] = useState<string | null>(null)
  const loadEntries = async () => {
    const res = await fetch(`/api/seasons/${seasonId}/entries`).catch(() => null)
    if (!res?.ok) return
    const data = await res.json()
    setEntries(data.entries ?? [])
    setQuestions(Array.isArray(data.questions) ? data.questions : [])
  }
  useEffect(() => {
    loadEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId])
  const decideEntry = async (entryId: string, status: "APPROVED" | "REJECTED") => {
    setEntryBusy(entryId)
    try {
      await fetch(`/api/seasons/${seasonId}/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      await loadEntries()
    } finally {
      setEntryBusy(null)
    }
  }

  const [blastOpen, setBlastOpen] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [blastResult, setBlastResult] = useState<string | null>(null)
  const sendBlast = async () => {
    setSending(true)
    setBlastResult(null)
    try {
      const res = await fetch(`/api/seasons/${seasonId}/announce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't send")
      setBlastResult(`Sent to ${data.recipients} operator${data.recipients === 1 ? "" : "s"} across ${data.clubs} club${data.clubs === 1 ? "" : "s"} (${data.emailed} emailed).`)
      setSubject("")
      setBody("")
      setBlastOpen(false)
    } catch (e) {
      setBlastResult(e instanceof Error ? e.message : "Couldn't send")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`reveal ${panelClass}`}>
      <PanelHeader
        title={`Clubs (${clubs.length})`}
        action={
          <span className="flex items-center gap-3">
            <span className="text-ink-400 text-xs">
              {subs.length} team{subs.length === 1 ? "" : "s"} across all clubs
            </span>
            <Button size="sm" variant="secondary" onClick={() => setBlastOpen((v) => !v)}>
              Message clubs
            </Button>
          </span>
        }
      />
      {blastResult && (
        <p className="border-court-200 bg-court-50 text-court-700 mb-3 rounded-xl border px-3 py-2 text-xs">
          {blastResult}
        </p>
      )}
      {blastOpen && (
        <div className="border-ink-100 mb-4 rounded-xl border p-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="border-ink-200 mb-2 w-full rounded-lg border px-3 py-2 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message to every club operator in this season (bell + email)…"
            rows={4}
            className="border-ink-200 w-full rounded-lg border px-3 py-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={sending || subject.trim().length < 3 || body.trim().length < 3} onClick={sendBlast}>
              {sending ? "Sending…" : "Send to all clubs"}
            </Button>
            <Button size="sm" variant="subtle" onClick={() => setBlastOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {entries.length > 0 && (
        <div className="border-ink-100 mb-4 rounded-xl border p-3">
          <p className="text-ink-900 mb-2 text-xs font-bold uppercase tracking-wide">
            Club entries ({entries.length})
          </p>
          {entries.map((e: any) => (
            <div key={e.id} className="border-ink-50 border-b py-2 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink-900 text-sm font-medium">
                  {e.tenant.name}
                  <span className="text-ink-500 ml-2 text-xs">
                    planned {e.plannedTeams ?? "?"} team{e.plannedTeams === 1 ? "" : "s"} · submitted{" "}
                    {(byClub.get(e.tenant.id)?.teams ?? []).length}
                    {e.signatureName ? ` · signed by ${e.signatureName}` : " · agreement NOT signed"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={toneForStatus(e.status === "SUBMITTED" ? "PENDING" : e.status)}>
                    {e.status.toLowerCase()}
                  </Badge>
                  {e.status === "SUBMITTED" && (
                    <>
                      <Button size="sm" tone="court" disabled={entryBusy === e.id} onClick={() => decideEntry(e.id, "APPROVED")}>
                        Approve entry
                      </Button>
                      <Button size="sm" variant="secondary" tone="hoop" disabled={entryBusy === e.id} onClick={() => decideEntry(e.id, "REJECTED")}>
                        Decline
                      </Button>
                    </>
                  )}
                  <button
                    onClick={() => setEntryOpen(entryOpen === e.id ? null : e.id)}
                    className="text-play-600 text-xs font-semibold hover:underline"
                  >
                    {entryOpen === e.id ? "Hide" : "Application"}
                  </button>
                </span>
              </div>
              {entryOpen === e.id && (
                <div className="bg-court-50 mt-2 rounded-lg p-3 text-sm">
                  {questions.map((q) => (
                    <p key={q} className="text-ink-700 mb-1.5">
                      <span className="text-ink-400 block text-xs">{q}</span>
                      {e.answers?.[q] ?? "—"}
                    </p>
                  ))}
                  {e.planNote && (
                    <p className="text-ink-700 mb-1.5">
                      <span className="text-ink-400 block text-xs">Team plan</span>
                      {e.planNote}
                    </p>
                  )}
                  {e.signatureName && (
                    <p className="text-ink-500 text-xs">
                      Agreement signed by {e.signatureName} on{" "}
                      {new Date(e.signedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {clubs.length === 0 ? (
        <p className="text-ink-500 text-sm">No clubs have registered teams yet.</p>
      ) : (
        clubs.map(({ tenant, teams }) => {
          const approved = teams.filter((t) => t.status === "APPROVED").length
          const pending = teams.filter((t) => t.status === "PENDING").length
          const rejected = teams.filter((t) => t.status === "REJECTED").length
          const paidCount = teams.filter(isPaid).length
          return (
            <div
              key={tenant.id}
              className="border-court-100 hover:border-court-200 mb-3 rounded-xl border p-3 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/manage/leagues/${leagueId}/seasons/${seasonId}/clubs/${tenant.id}`}
                    className="text-ink-900 hover:text-play-600 font-semibold transition-colors"
                  >
                    {tenant.name}
                  </Link>
                  <span className="text-ink-500 ml-2 text-xs">
                    {teams.length} team{teams.length === 1 ? "" : "s"}
                    {approved > 0 ? ` · ${approved} approved` : ""}
                    {pending > 0 ? ` · ${pending} pending` : ""}
                    {rejected > 0 ? ` · ${rejected} rejected` : ""}
                    {` · ${paidCount}/${teams.length} paid`}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {pending > 0 && <Badge tone="warning">{pending} to review</Badge>}
                  <Link
                    href={`/manage/leagues/${leagueId}/seasons/${seasonId}/clubs/${tenant.id}`}
                    className="text-play-600 hover:text-play-700 whitespace-nowrap text-xs font-semibold"
                  >
                    Club view &rarr;
                  </Link>
                </div>
              </div>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {teams.map((t) => (
                  <Link
                    key={t.id}
                    href={`/manage/leagues/${leagueId}/seasons/${seasonId}/teams/${t.id}`}
                    className="bg-court-50 hover:bg-court-100 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors"
                  >
                    <span className="text-ink-800 min-w-0 truncate font-medium">
                      {t.team.name}
                      {t.division && (
                        <span className="text-ink-400 ml-1.5 text-xs">{t.division.name}</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge tone={toneForStatus(t.status)}>{t.status.toLowerCase()}</Badge>
                      <Badge
                        tone={
                          isPaid(t)
                            ? "success"
                            : t.feeOverdue
                              ? "danger"
                              : (t.feePaid ?? 0) > 0
                                ? "gold"
                                : "warning"
                        }
                      >
                        {isPaid(t)
                          ? "paid"
                          : (t.feePaid ?? 0) > 0
                            ? "deposit paid"
                            : t.feeOverdue
                              ? "overdue"
                              : "unpaid"}
                      </Badge>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
