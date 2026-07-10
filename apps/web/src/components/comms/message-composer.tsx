"use client"

// Re-engagement message composer — shared by the club, league, and platform
// (admin) Messages pages. Audiences are computed server-side with live
// counts; consent suppression happens at send time on the server, so the UI
// only previews and confirms. docs/season-continuity-plan.md §4.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge, Button, Card, PanelHeader } from "@/components/ui"

interface AudienceOption {
  kind: string
  label: string
  recipientCount: number
}

interface LogEntry {
  id: string
  audience: string
  subject: string
  recipientCount: number
  suppressedCount: number
  createdAt: string
}

interface MessageComposerProps {
  scope: "TENANT" | "LEAGUE" | "PLATFORM"
  orgId: string | null
  orgName: string
}

const SUBJECT_MAX = 150
const BODY_MAX = 5000

export function MessageComposer({ scope, orgId, orgName }: MessageComposerProps) {
  const [audiences, setAudiences] = useState<AudienceOption[]>([])
  const [audiencesLoading, setAudiencesLoading] = useState(true)
  const [audience, setAudience] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ sent: number; suppressed: number } | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  const query = useMemo(() => {
    const params = new URLSearchParams({ scope })
    if (orgId) params.set("orgId", orgId)
    return params.toString()
  }, [scope, orgId])

  useEffect(() => {
    let cancelled = false
    setAudiencesLoading(true)
    fetch(`/api/comms/audiences?${query}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load audiences"))))
      .then((data) => {
        if (cancelled) return
        setAudiences(data.audiences || [])
      })
      .catch(() => {
        if (!cancelled) setError("Could not load audiences. Refresh to try again.")
      })
      .finally(() => {
        if (!cancelled) setAudiencesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [query])

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/comms/messages?${query}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.messages || [])
      }
    } finally {
      setLogsLoading(false)
    }
  }, [query])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const selected = audiences.find((a) => a.kind === audience)
  const canSend = !!selected && subject.trim().length > 0 && body.trim().length > 0 && !sending

  const audienceLabel = useCallback(
    (kind: string) => audiences.find((a) => a.kind === kind)?.label.replace(/\s*\(\d+\)$/, "") || kind,
    [audiences]
  )

  async function handleSend() {
    if (!selected) return
    setSending(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/comms/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          orgId,
          audience: selected.kind,
          subject: subject.trim(),
          body: body.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Failed to send the message.")
        return
      }
      setResult({ sent: data.sent, suppressed: data.suppressed })
      setSubject("")
      setBody("")
      loadLogs()
    } catch {
      setError("Failed to send the message.")
    } finally {
      setSending(false)
      setConfirming(false)
    }
  }

  const previewParagraphs = body
    .trim()
    .split(/\n{2,}/)
    .filter((p) => p.length > 0)

  return (
    <div className="space-y-6">
      <Card>
        <PanelHeader
          title="Compose message"
          action={selected ? <Badge tone="play">~{selected.recipientCount} recipients</Badge> : null}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <label htmlFor="comms-audience" className="text-ink-700 mb-1 block text-sm font-semibold">
                Audience
              </label>
              <select
                id="comms-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                disabled={audiencesLoading}
                className="border-ink-200 text-ink-900 focus:border-ink-400 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none"
              >
                <option value="">
                  {audiencesLoading ? "Loading audiences…" : "Select an audience"}
                </option>
                {audiences.map((a) => (
                  <option key={a.kind} value={a.kind}>
                    {a.label}
                  </option>
                ))}
              </select>
              <p className="text-ink-500 mt-1 text-xs">
                Audiences are computed from engagement — recipients who haven&apos;t consented to
                marketing email are skipped automatically at send time.
              </p>
            </div>

            <div>
              <label htmlFor="comms-subject" className="text-ink-700 mb-1 block text-sm font-semibold">
                Subject
              </label>
              <input
                id="comms-subject"
                type="text"
                value={subject}
                maxLength={SUBJECT_MAX}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Tryouts for next season are open"
                className="border-ink-200 text-ink-900 focus:border-ink-400 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none"
              />
              <p className="text-ink-400 mt-1 text-right text-xs">
                {subject.length}/{SUBJECT_MAX}
              </p>
            </div>

            <div>
              <label htmlFor="comms-body" className="text-ink-700 mb-1 block text-sm font-semibold">
                Message
              </label>
              <textarea
                id="comms-body"
                value={body}
                maxLength={BODY_MAX}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder={"Hi families,\n\nWe would love to see you back this season…"}
                className="border-ink-200 text-ink-900 focus:border-ink-400 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none"
              />
              <p className="text-ink-400 mt-1 text-right text-xs">
                {body.length}/{BODY_MAX}
              </p>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}
            {result && (
              <div className="bg-court-50 text-court-700 rounded-xl px-4 py-3 text-sm font-medium">
                Sent to {result.sent}, {result.suppressed} skipped for consent
              </div>
            )}

            <Button onClick={() => setConfirming(true)} disabled={!canSend}>
              Send message
            </Button>
          </div>

          {/* Live preview */}
          <div>
            <p className="text-ink-500 mb-2 text-xs font-semibold uppercase tracking-[0.12em]">
              Email preview
            </p>
            <div className="border-ink-100 bg-ink-50 rounded-2xl border p-5">
              <p className="text-ink-500 text-xs">From {orgName} via SportsHub</p>
              <p className="text-ink-950 mt-2 text-base font-bold">
                {subject.trim() || "Your subject line"}
              </p>
              <div className="text-ink-700 mt-3 space-y-3 text-sm leading-relaxed">
                {previewParagraphs.length > 0 ? (
                  previewParagraphs.map((para, i) => (
                    <p key={i}>
                      {para.split("\n").map((line, j) => (
                        <span key={j}>
                          {j > 0 && <br />}
                          {line}
                        </span>
                      ))}
                    </p>
                  ))
                ) : (
                  <p className="text-ink-400">Your message will appear here as you type.</p>
                )}
              </div>
              <div className="border-ink-200 mt-4 border-t pt-3">
                <p className="text-ink-400 text-xs">
                  Sent by {orgName} via SportsHub · Unsubscribe from {orgName} · Manage all email
                  preferences
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent messages */}
      <Card>
        <PanelHeader
          title="Recent messages"
          action={logs.length > 0 ? <Badge tone="neutral">{logs.length}</Badge> : null}
        />
        {logsLoading ? (
          <p className="text-ink-500 text-sm">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-ink-500 text-sm">
            No messages sent yet. Every send is logged here with its audience and delivery counts.
          </p>
        ) : (
          <ul className="divide-ink-100 divide-y">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-ink-950 truncate text-sm font-semibold">{log.subject}</p>
                  <p className="text-ink-500 text-xs">
                    {new Date(log.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {audienceLabel(log.audience)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Badge tone="court">{log.recipientCount} sent</Badge>
                  {log.suppressedCount > 0 && (
                    <Badge tone="warning">{log.suppressedCount} suppressed</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Confirm dialog */}
      {confirming && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="comms-confirm-title"
        >
          <div className="shadow-soft w-full max-w-md rounded-2xl bg-white p-6">
            <h3 id="comms-confirm-title" className="text-ink-950 text-lg font-bold">
              Send to ~{selected.recipientCount} recipients?
            </h3>
            <p className="text-ink-600 mt-2 text-sm">
              Recipients without marketing consent are skipped automatically.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="subtle" onClick={() => setConfirming(false)} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? "Sending…" : "Send now"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
