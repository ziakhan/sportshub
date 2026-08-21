"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { BrandCheckbox, Button, Card, PanelHeader, SmartBack } from "@/components/ui"
import {
  ICONS,
  inputCls,
  labelCls,
  newSession,
  readError,
  SessionEditor,
  sessionPayload,
  StepTitle,
  type SessionDraft,
} from "../session-editor"

/**
 * Club tryout event builder (docs/roadmap/club-tryouts-and-age-pools).
 *
 * One page, three numbered parts, no wizard: a club announces the whole thing
 * at once ("Fall tryouts: U11 Mon 6pm, U13 Mon 7:30, U15 Wed"), so the sessions
 * are edited together and saved together. The event is created as a draft;
 * publishing is one switch on the event page once the schedule is settled.
 */
export default function CreateTryoutEventPage() {
  const params = useParams()
  const router = useRouter()
  const clubId = params?.id as string

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [seasonLabel, setSeasonLabel] = useState("")
  const [showSignupCount, setShowSignupCount] = useState(false)
  const [sessions, setSessions] = useState<SessionDraft[]>([newSession()])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function save() {
    setError(null)
    setNotice(null)

    if (title.trim().length < 3) {
      setError("Give the event a name of at least 3 characters.")
      return
    }
    if (!seasonLabel.trim()) {
      setError("Name the season these tryouts are for, for example 2026-27.")
      return
    }
    if (sessions.length === 0) {
      setError("Add at least one session.")
      return
    }

    const payloads: Record<string, unknown>[] = []
    for (let i = 0; i < sessions.length; i++) {
      const built = sessionPayload(sessions[i], i)
      if (!built.ok) {
        setError(built.error)
        return
      }
      payloads.push(built.value)
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/tryout-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          seasonLabel: seasonLabel.trim(),
          showSignupCount,
          sessions: payloads,
        }),
      })
      if (!res.ok) throw new Error(await readError(res, "Could not save the event"))
      const json = await res.json()
      setNotice(`${title.trim()} is saved with ${payloads.length} ${payloads.length === 1 ? "session" : "sessions"}. Opening it now.`)
      router.push(`/clubs/${clubId}/tryouts/events/${json.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the event")
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <SmartBack
          fallback={`/clubs/${clubId}/tryouts`}
          fallbackLabel="Tryouts"
          className="-ml-1 mb-1"
        />
        <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
          New tryout event
        </h2>
        <p className="text-ink-600 mt-1 text-sm">
          One event, one session per age group and gym slot. Two age groups can share a slot,
          which is how a combined gym night is set up.
        </p>
      </div>

      <Card className="reveal">
        <div className="space-y-8">
          {error && (
            <div
              className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-xl border p-3 text-sm"
              role="alert"
              data-testid="event-error"
            >
              {error}
            </div>
          )}
          {notice && (
            <div
              className="border-court-200 bg-court-50 text-court-700 rounded-xl border p-3 text-sm"
              data-testid="event-notice"
            >
              {notice}
            </div>
          )}

          <section>
            <PanelHeader title={<StepTitle step={1}>Event</StepTitle>} />
            <div className="space-y-4">
              <div>
                <label htmlFor="event-title" className={labelCls}>
                  Name <span className="text-hoop-600">*</span>
                </label>
                <input
                  id="event-title"
                  type="text"
                  className={inputCls}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Fall tryouts"
                />
              </div>

              <div>
                <label htmlFor="event-season" className={labelCls}>
                  Season <span className="text-hoop-600">*</span>
                </label>
                <input
                  id="event-season"
                  type="text"
                  className={inputCls}
                  value={seasonLabel}
                  onChange={(e) => setSeasonLabel(e.target.value)}
                  placeholder="2026-27"
                />
                <p className="text-ink-500 mt-1 text-xs">
                  Every player who tries out lands in this season&apos;s age-group pool.
                </p>
              </div>

              <div>
                <label htmlFor="event-description" className={labelCls}>
                  What to expect
                </label>
                <textarea
                  id="event-description"
                  rows={3}
                  className={inputCls}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What to bring, how long it runs, when families hear back."
                />
              </div>
            </div>
          </section>

          <SessionEditor
            title={<StepTitle step={2}>Sessions</StepTitle>}
            description="One row per age group and gym slot. Give two rows the same time and place and they run together in one gym."
            sessions={sessions}
            onChange={setSessions}
          />

          <section>
            <PanelHeader title={<StepTitle step={3}>Visibility</StepTitle>} />
            <div className="space-y-3">
              <BrandCheckbox
                id="show-signup-count"
                checked={showSignupCount}
                onChange={setShowSignupCount}
                label="Show signup counts on the public page"
                subLabel="Off by default. Your dashboard always shows the real numbers either way."
              />
              <p className="border-ink-200 bg-ink-50 text-ink-600 rounded-md border px-3 py-2 text-xs">
                The event is saved as a draft. Publish it from the event page when the schedule
                is settled, and every session goes public together.
              </p>
            </div>
          </section>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="subtle" href={`/clubs/${clubId}/tryouts`}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={saving}
              onClick={save}
              icon={ICONS.calendar}
              data-testid="save-event"
            >
              {saving ? "Saving..." : "Save event"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
