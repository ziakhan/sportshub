"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Badge, BrandCheckbox, Button, Card, PanelHeader, SmartBack } from "@/components/ui"
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
 * Tryout event detail and editor (docs/roadmap/club-tryouts-and-age-pools).
 *
 * Publishing is one switch for the whole event: the API flips every session
 * with it, because a club announces the shelf, not the individual gym slots.
 * Removing a session families have already registered for is refused by the
 * API with a sentence that says what to do instead, and that sentence is what
 * is shown here rather than a generic failure.
 */

interface SessionRow {
  id: string
  title: string
  ageGroup: string
  gender: string | null
  scheduledAt: string
  duration: number | null
  location: string
  venueId: string | null
  venue: { id: string; name: string } | null
  fee: number
  maxParticipants: number | null
  isPublished: boolean
  isPublic: boolean
  signupCount: number
  signups: { active: number; byStatus: Record<string, number>; checkedIn: number; inPool: number }
}

interface EventPayload {
  event: {
    id: string
    title: string
    description: string | null
    seasonLabel: string
    isPublished: boolean
    showSignupCount: boolean
    ageGroups: string[]
    startsAt: string | null
  }
  sessions: SessionRow[]
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function toDraft(row: SessionRow): SessionDraft {
  const at = new Date(row.scheduledAt)
  return {
    key: row.id,
    id: row.id,
    ageGroup: row.ageGroup,
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
    duration: row.duration ?? 90,
    venueId: row.venueId ?? "",
    location: row.location ?? "",
    fee: String(row.fee ?? 0),
    maxParticipants: row.maxParticipants != null ? String(row.maxParticipants) : "",
    gender: row.gender ?? "",
    signupCount: row.signupCount,
  }
}

export function EventDetail({
  clubId,
  eventId,
  clubSlug,
  canEdit,
}: {
  clubId: string
  eventId: string
  clubSlug: string
  canEdit: boolean
}) {
  const [data, setData] = useState<EventPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [seasonLabel, setSeasonLabel] = useState("")
  const [showSignupCount, setShowSignupCount] = useState(false)

  const [editingSessions, setEditingSessions] = useState(false)
  const [drafts, setDrafts] = useState<SessionDraft[]>([])
  const [removed, setRemoved] = useState<SessionDraft[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/tryout-events/${eventId}`)
      if (!res.ok) throw new Error(await readError(res, "Could not load this event"))
      const json: EventPayload = await res.json()
      setData(json)
      setTitle(json.event.title)
      setDescription(json.event.description ?? "")
      setSeasonLabel(json.event.seasonLabel)
      setShowSignupCount(json.event.showSignupCount)
      setDrafts(json.sessions.map(toDraft))
      setRemoved([])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this event")
    } finally {
      setLoading(false)
    }
  }, [clubId, eventId])

  useEffect(() => {
    void load()
  }, [load])

  const totalSignups = useMemo(
    () => (data?.sessions ?? []).reduce((sum, s) => sum + s.signupCount, 0),
    [data]
  )
  const inPool = useMemo(
    () => (data?.sessions ?? []).reduce((sum, s) => sum + (s.signups?.inPool ?? 0), 0),
    [data]
  )

  async function patch(body: Record<string, unknown>, success: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/clubs/${clubId}/tryout-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await readError(res, "That did not save"))
      setNotice(success)
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not save")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveEvent() {
    if (title.trim().length < 3) {
      setError("Give the event a name of at least 3 characters.")
      return
    }
    if (!seasonLabel.trim()) {
      setError("Name the season these tryouts are for, for example 2026-27.")
      return
    }
    await patch(
      {
        title: title.trim(),
        description: description.trim() || null,
        seasonLabel: seasonLabel.trim(),
        showSignupCount,
      },
      "Event details saved."
    )
  }

  async function saveSessions() {
    const payloads: Record<string, unknown>[] = []
    for (let i = 0; i < drafts.length; i++) {
      const built = sessionPayload(drafts[i], i)
      if (!built.ok) {
        setError(built.error)
        return
      }
      payloads.push(built.value)
    }
    const removeSessionIds = removed.map((r) => r.id).filter(Boolean) as string[]
    if (payloads.length === 0 && removeSessionIds.length === 0) {
      setError("Add at least one session.")
      return
    }

    const ok = await patch(
      {
        ...(payloads.length > 0 ? { sessions: payloads } : {}),
        ...(removeSessionIds.length > 0 ? { removeSessionIds } : {}),
      },
      "Sessions saved."
    )
    if (ok) {
      setEditingSessions(false)
    } else {
      // Nothing was written, so the rows staged for removal come back, and
      // they come back where they were rather than at the bottom.
      const order = new Map((data?.sessions ?? []).map((s, i) => [s.id, i]))
      setDrafts((current) =>
        [...current, ...removed].sort(
          (a, b) => (order.get(a.id ?? "") ?? 999) - (order.get(b.id ?? "") ?? 999)
        )
      )
      setRemoved([])
    }
  }

  if (loading && !data) {
    return <p className="text-ink-500 py-12 text-center">Loading the event...</p>
  }

  if (!data) {
    return (
      <div className="border-hoop-200 bg-hoop-50 rounded-xl border p-6 text-center">
        <p className="text-hoop-700">{error ?? "That event is not here."}</p>
        <div className="mt-4">
          <Button href={`/clubs/${clubId}/tryouts`} variant="subtle" size="sm">
            Back to tryouts
          </Button>
        </div>
      </div>
    )
  }

  const event = data.event

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <SmartBack
          fallback={`/clubs/${clubId}/tryouts`}
          fallbackLabel="Tryouts"
          className="-ml-1 mb-1"
        />
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
            {event.title}
          </h2>
          {event.isPublished ? (
            <Badge tone="court" dot>
              Published
            </Badge>
          ) : (
            <Badge tone="hoop">Draft</Badge>
          )}
          <Badge tone="neutral">{event.seasonLabel}</Badge>
        </div>
        <div className="text-ink-500 mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>
            {data.sessions.length} {data.sessions.length === 1 ? "session" : "sessions"}
          </span>
          <span>
            {event.ageGroups.length} age {event.ageGroups.length === 1 ? "group" : "groups"}
            {event.ageGroups.length > 0 ? `: ${event.ageGroups.join(", ")}` : ""}
          </span>
          <span>
            {totalSignups} signed up
            {inPool > 0 ? `, ${inPool} in the pool` : ""}
          </span>
        </div>
      </div>

      {error && (
        <div
          className="border-hoop-200 bg-hoop-50 text-hoop-700 mb-4 rounded-xl border p-3 text-sm"
          role="alert"
          data-testid="event-error"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          className="border-court-200 bg-court-50 text-court-700 mb-4 rounded-xl border p-3 text-sm"
          data-testid="event-notice"
        >
          {notice}
        </div>
      )}

      {/* Shelf state first: the one switch that puts every session in public. */}
      <Card className="reveal mb-4" size="sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <p className="text-ink-900 text-sm font-semibold">
              {event.isPublished ? "Live for families" : "Not visible to anyone yet"}
            </p>
            {event.isPublished ? (
              <p className="text-ink-600 mt-0.5 text-sm">
                The event page is at{" "}
                <Link
                  href={`/tryout-event/${eventId}`}
                  className="text-play-600 hover:text-play-700 font-semibold underline"
                >
                  /tryout-event/{eventId.slice(0, 8)}…
                </Link>{" "}
                and every session is on your{" "}
                <Link
                  href={`/club/${clubSlug}`}
                  className="text-play-600 hover:text-play-700 font-semibold underline"
                >
                  club page
                </Link>
                , each with its own signup page. Need something for Instagram?{" "}
                <a
                  href={`/api/tryout-events/${eventId}/card`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-play-600 hover:text-play-700 font-semibold underline"
                >
                  Download the poster
                </a>
                .
              </p>
            ) : (
              <p className="text-ink-600 mt-0.5 text-sm">
                Publishing puts all {data.sessions.length}{" "}
                {data.sessions.length === 1 ? "session" : "sessions"} on your club page together.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              href={`/clubs/${clubId}/tryouts/pool?seasonLabel=${encodeURIComponent(event.seasonLabel)}`}
              variant="secondary"
              size="sm"
              icon={ICONS.users}
            >
              Age-group pools
            </Button>
            {canEdit && (
              <Button
                size="sm"
                disabled={busy}
                variant={event.isPublished ? "subtle" : "primary"}
                onClick={() =>
                  patch(
                    { isPublished: !event.isPublished },
                    event.isPublished
                      ? "The event is off the public page."
                      : "The event is live. Families can sign up now."
                  )
                }
                data-testid="publish-event"
              >
                {busy ? "Working..." : event.isPublished ? "Unpublish" : "Publish"}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 1 Event */}
      <Card className="reveal mb-4">
        <PanelHeader title={<StepTitle step={1}>Event</StepTitle>} />
        {canEdit ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="event-title" className={labelCls}>
                  Name
                </label>
                <input
                  id="event-title"
                  type="text"
                  className={inputCls}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="event-season" className={labelCls}>
                  Season
                </label>
                <input
                  id="event-season"
                  type="text"
                  className={inputCls}
                  value={seasonLabel}
                  onChange={(e) => setSeasonLabel(e.target.value)}
                />
              </div>
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
            <BrandCheckbox
              id="show-signup-count"
              checked={showSignupCount}
              onChange={setShowSignupCount}
              label="Show signup counts on the public page"
              subLabel="Off by default. Your dashboard always shows the real numbers either way."
            />
            <div>
              <Button disabled={busy} onClick={saveEvent} data-testid="save-event">
                {busy ? "Saving..." : "Save event details"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-ink-700">{event.description || "No description yet."}</p>
            <p className="text-ink-500">
              Only club owners and managers can change a tryout event.
            </p>
          </div>
        )}
      </Card>

      {/* 2 Sessions */}
      <Card className="reveal">
        <PanelHeader
          title={<StepTitle step={2}>Sessions</StepTitle>}
          action={
            editingSessions ? (
              <span className="text-ink-500 text-sm">
                {drafts.length} {drafts.length === 1 ? "session" : "sessions"}
              </span>
            ) : canEdit ? (
              <Button
                size="sm"
                variant="subtle"
                onClick={() => {
                  setEditingSessions(true)
                  setError(null)
                  setNotice(null)
                }}
                data-testid="edit-sessions"
              >
                Edit sessions
              </Button>
            ) : null
          }
        />

        {editingSessions ? (
          <div className="space-y-5">
            <SessionEditor
              description="Two rows with the same time and place run together in one gym. That is a combined session, and it is normal."
              sessions={drafts}
              onChange={setDrafts}
              onRemoveExisting={(draft) => {
                setDrafts((current) => current.filter((d) => d.key !== draft.key))
                setRemoved((current) => [...current, draft])
              }}
            />
            {removed.length > 0 && (
              <p className="border-ink-200 bg-ink-50 text-ink-600 rounded-md border px-3 py-2 text-xs">
                {removed.length} {removed.length === 1 ? "session is" : "sessions are"} staged for
                removal. They go when you save.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="subtle"
                disabled={busy}
                onClick={() => {
                  setDrafts(data.sessions.map(toDraft))
                  setRemoved([])
                  setEditingSessions(false)
                  setError(null)
                }}
              >
                Cancel
              </Button>
              <Button disabled={busy} onClick={saveSessions} data-testid="save-sessions">
                {busy ? "Saving..." : "Save sessions"}
              </Button>
            </div>
          </div>
        ) : data.sessions.length === 0 ? (
          <div className="border-ink-300 rounded-2xl border border-dashed p-8 text-center">
            <p className="text-ink-600 mb-3 text-sm">
              This event has no sessions, so there is nothing for a family to sign up to.
            </p>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setDrafts([newSession()])
                  setEditingSessions(true)
                }}
              >
                Add the first session
              </Button>
            )}
          </div>
        ) : (
          <div className="border-ink-100 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-ink-50 text-ink-500 text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2">Age group</th>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Where</th>
                  <th className="px-3 py-2">Fee</th>
                  <th className="px-3 py-2">Signups</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((session) => {
                  const at = new Date(session.scheduledAt)
                  const sharedWith = data.sessions.filter(
                    (other) =>
                      other.id !== session.id &&
                      other.scheduledAt === session.scheduledAt &&
                      other.location === session.location
                  )
                  return (
                    <tr
                      key={session.id}
                      className="border-ink-100 hover:bg-ink-50/60 border-t align-top"
                      data-testid="session-table-row"
                    >
                      <td className="px-3 py-2">
                        <div className="text-ink-900 font-semibold">{session.ageGroup}</div>
                        {session.gender && (
                          <div className="text-ink-500 text-xs">
                            {session.gender === "MALE"
                              ? "Boys"
                              : session.gender === "FEMALE"
                                ? "Girls"
                                : "Co-ed"}
                          </div>
                        )}
                      </td>
                      <td className="text-ink-700 px-3 py-2">
                        <div>{format(at, "EEE MMM d, yyyy")}</div>
                        <div className="text-ink-500 text-xs">
                          {format(at, "h:mm a")}
                          {session.duration ? ` for ${session.duration} min` : ""}
                        </div>
                      </td>
                      <td className="text-ink-700 px-3 py-2">
                        <div>{session.location}</div>
                        {sharedWith.length > 0 && (
                          <div className="mt-1">
                            <Badge tone="play">
                              Combined with {sharedWith.map((s) => s.ageGroup).join(", ")}
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="text-ink-700 px-3 py-2 whitespace-nowrap">
                        ${session.fee.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-ink-900 font-semibold">{session.signupCount}</div>
                        <div className="text-ink-500 text-xs">
                          {session.signups?.checkedIn ?? 0} checked in
                          {session.maxParticipants
                            ? `, room for ${session.maxParticipants}`
                            : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <Button
                            href={`/clubs/${clubId}/tryouts/${session.id}/signups`}
                            size="sm"
                            variant="subtle"
                          >
                            Signups
                          </Button>
                          {session.isPublished && (
                            <Button
                              href={`/tryout/${session.id}`}
                              size="sm"
                              variant="subtle"
                              icon={ICONS.eye}
                            >
                              Public
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
