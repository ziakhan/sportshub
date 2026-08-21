"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  Badge,
  BrandListbox,
  Button,
  DateTimePicker,
  PanelHeader,
  TimeRangePicker,
} from "@/components/ui"
import { VenueSelector } from "@/components/venue-selector"
import { AGE_GROUPS } from "@/lib/teams/naming"

/**
 * The sessions half of the club tryout event builder
 * (docs/roadmap/club-tryouts-and-age-pools).
 *
 * A session is one row per (age group, time, gym). Two age groups sharing one
 * gym slot is the normal combined-session pattern, so rows that share a time
 * and a place are labelled as combined rather than flagged as a clash: the
 * backend never conflict-checks them either.
 *
 * Shared by the create page and the event detail page so the two can never
 * drift on what a session is.
 */

export const inputCls =
  "mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"

export const labelCls = "block text-sm font-medium text-ink-700"

export const AGE_GROUP_OPTIONS = AGE_GROUPS.map((g) => ({ value: g, label: g }))

export const GENDER_OPTIONS = [
  { value: "", label: "Any" },
  { value: "MALE", label: "Boys" },
  { value: "FEMALE", label: "Girls" },
  { value: "COED", label: "Co-ed" },
]

export interface SessionDraft {
  /** Local list key. Never sent. */
  key: string
  /** Server id when the session already exists. */
  id?: string
  ageGroup: string
  /** "YYYY-MM-DD" */
  date: string
  /** "HH:mm" (24 hour) */
  time: string
  duration: number
  venueId: string
  location: string
  fee: string
  maxParticipants: string
  gender: string
  /** Signups already taken, so the row can say why it cannot be removed. */
  signupCount?: number
}

let seq = 0

export function newSession(seed?: Partial<SessionDraft>): SessionDraft {
  seq += 1
  return {
    key: `s${seq}`,
    ageGroup: "",
    date: "",
    time: "18:00",
    duration: 90,
    venueId: "",
    location: "",
    fee: "0",
    maxParticipants: "",
    gender: "",
    ...seed,
  }
}

/** The API payload for one row, or a sentence saying what is missing. */
export function sessionPayload(
  draft: SessionDraft,
  index: number
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const where = `Session ${index + 1}`
  if (!draft.ageGroup) return { ok: false, error: `${where} needs an age group.` }
  if (!draft.date) return { ok: false, error: `${where} needs a date.` }
  if (!draft.time) return { ok: false, error: `${where} needs a start time.` }
  if (!draft.venueId && draft.location.trim().length < 3) {
    return { ok: false, error: `${where} needs a venue or a location.` }
  }
  const fee = Number(draft.fee)
  if (!Number.isFinite(fee) || fee < 0) return { ok: false, error: `${where} needs a fee of 0 or more.` }

  const scheduledAt = new Date(`${draft.date}T${draft.time}`)
  if (Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, error: `${where} has a date and time that do not read.` }
  }

  const value: Record<string, unknown> = {
    ageGroup: draft.ageGroup,
    scheduledAt: scheduledAt.toISOString(),
    duration: draft.duration || null,
    fee,
  }
  if (draft.id) value.id = draft.id
  if (draft.venueId) value.venueId = draft.venueId
  if (draft.location.trim().length >= 3) value.location = draft.location.trim()
  const cap = Number(draft.maxParticipants)
  value.maxParticipants = draft.maxParticipants && Number.isFinite(cap) && cap > 0 ? Math.round(cap) : null
  value.gender = draft.gender || null
  return { ok: true, value }
}

/** Rows sharing a start time and a place are one combined gym slot. */
function slotKey(draft: SessionDraft): string {
  return `${draft.date}T${draft.time}|${(draft.venueId || draft.location).trim().toLowerCase()}`
}

export function SessionEditor({
  sessions,
  onChange,
  title,
  description,
  onRemoveExisting,
}: {
  sessions: SessionDraft[]
  onChange: (next: SessionDraft[]) => void
  /** Omit when the surrounding card already carries the heading. */
  title?: ReactNode
  description?: string
  /** Detail page hook: removing a saved session goes through the API. */
  onRemoveExisting?: (draft: SessionDraft) => void
}) {
  const slots = useMemo(() => {
    const counts = new Map<string, string[]>()
    for (const s of sessions) {
      if (!s.date || !s.ageGroup) continue
      const key = slotKey(s)
      counts.set(key, [...(counts.get(key) ?? []), s.ageGroup])
    }
    return counts
  }, [sessions])

  const update = (key: string, patch: Partial<SessionDraft>) =>
    onChange(sessions.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  return (
    <section>
      {title ? (
        <PanelHeader
          title={title}
          action={
            <span className="text-ink-500 text-sm">
              {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
            </span>
          }
        />
      ) : null}
      {description && (
        <p className={`text-ink-600 mb-4 text-sm ${title ? "-mt-2" : ""}`}>{description}</p>
      )}

      <div className="space-y-4">
        {sessions.map((session, index) => {
          const shared = (slots.get(slotKey(session)) ?? []).filter((g) => g !== session.ageGroup)
          return (
            <div
              key={session.key}
              className="border-ink-100 rounded-2xl border bg-white p-4 sm:p-5"
              data-testid="session-row"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="bg-[var(--brand-soft)] text-[color:var(--brand-ink)] grid h-6 w-6 place-items-center rounded-full text-xs font-bold">
                  {index + 1}
                </span>
                <span className="text-ink-900 text-sm font-semibold">
                  {session.ageGroup || "New session"}
                </span>
                {shared.length > 0 && (
                  <Badge tone="play">Combined with {shared.join(", ")}</Badge>
                )}
                {session.signupCount ? (
                  <Badge tone="court">
                    {session.signupCount} signed up
                  </Badge>
                ) : null}
                <span className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="subtle"
                    icon={ICONS.copy}
                    onClick={() =>
                      onChange([
                        ...sessions.slice(0, index + 1),
                        newSession({
                          date: session.date,
                          time: session.time,
                          duration: session.duration,
                          venueId: session.venueId,
                          location: session.location,
                          fee: session.fee,
                          maxParticipants: session.maxParticipants,
                          gender: session.gender,
                        }),
                        ...sessions.slice(index + 1),
                      ])
                    }
                  >
                    Same slot, another age group
                  </Button>
                  <Button
                    size="sm"
                    variant="subtle"
                    icon={ICONS.trash}
                    onClick={() => {
                      if (session.id && onRemoveExisting) {
                        onRemoveExisting(session)
                        return
                      }
                      onChange(sessions.filter((s) => s.key !== session.key))
                    }}
                  >
                    Remove
                  </Button>
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`age-${session.key}`} className={labelCls}>
                    Age group <span className="text-hoop-600">*</span>
                  </label>
                  <div className="mt-1">
                    <BrandListbox
                      id={`age-${session.key}`}
                      ariaLabel="Age group"
                      placeholder="Pick an age group"
                      value={session.ageGroup}
                      onChange={(v) => update(session.key, { ageGroup: v })}
                      options={AGE_GROUP_OPTIONS}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={`gender-${session.key}`} className={labelCls}>
                    Who it is for
                  </label>
                  <div className="mt-1">
                    <BrandListbox
                      id={`gender-${session.key}`}
                      ariaLabel="Who the session is for"
                      value={session.gender}
                      onChange={(v) => update(session.key, { gender: v })}
                      options={GENDER_OPTIONS}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={`date-${session.key}`} className={labelCls}>
                    Date <span className="text-hoop-600">*</span>
                  </label>
                  <DateTimePicker
                    id={`date-${session.key}`}
                    mode="date"
                    value={session.date}
                    onChange={(v) => update(session.key, { date: v })}
                    placeholder="Pick a date"
                  />
                </div>

                <div>
                  <label htmlFor={`time-${session.key}`} className={labelCls}>
                    Start time and length
                  </label>
                  <TimeRangePicker
                    id={`time-${session.key}`}
                    time={session.time}
                    minutes={session.duration || 90}
                    onChange={(next) =>
                      update(session.key, { time: next.time, duration: next.minutes })
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <VenueField session={session} onUpdate={(patch) => update(session.key, patch)} />
                </div>

                <div>
                  <label htmlFor={`fee-${session.key}`} className={labelCls}>
                    Tryout fee ($) <span className="text-hoop-600">*</span>
                  </label>
                  <input
                    id={`fee-${session.key}`}
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls}
                    value={session.fee}
                    onChange={(e) => update(session.key, { fee: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label htmlFor={`cap-${session.key}`} className={labelCls}>
                    Gym capacity
                  </label>
                  <input
                    id={`cap-${session.key}`}
                    type="number"
                    min="1"
                    className={inputCls}
                    value={session.maxParticipants}
                    onChange={(e) => update(session.key, { maxParticipants: e.target.value })}
                    placeholder="No limit"
                  />
                  <p className="text-ink-500 mt-1 text-xs">
                    For your planning. Never shown publicly.
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4">
        <Button
          variant="subtle"
          icon={ICONS.plus}
          onClick={() => onChange([...sessions, newSession()])}
          data-testid="add-session"
        >
          Add a session
        </Button>
      </div>
    </section>
  )
}

/**
 * Where the session runs. A saved venue keeps the gym in the directory (and
 * feeds the venue pages); typing the place is the escape hatch for a one-off
 * gym, and the API takes either.
 */
function VenueField({
  session,
  onUpdate,
}: {
  session: SessionDraft
  onUpdate: (patch: Partial<SessionDraft>) => void
}) {
  const [picking, setPicking] = useState(false)

  if (session.venueId) {
    return (
      <div>
        <span className={labelCls}>Where</span>
        <div className="border-ink-200 mt-1 flex flex-wrap items-center gap-2 rounded-md border bg-ink-50/60 px-3 py-2">
          <span className="text-ink-900 text-sm font-medium">{session.location}</span>
          <Badge tone="neutral">Saved venue</Badge>
          <Button
            size="sm"
            variant="subtle"
            className="ml-auto"
            onClick={() => {
              onUpdate({ venueId: "", location: "" })
              setPicking(false)
            }}
          >
            Change
          </Button>
        </div>
      </div>
    )
  }

  if (picking) {
    return (
      <div>
        <span className={labelCls}>Where</span>
        <div className="mt-1">
          <VenueSelector
            value=""
            venueName=""
            onSelect={(v) => {
              onUpdate({ venueId: v.id, location: `${v.name}, ${v.address}` })
              setPicking(false)
            }}
            onClear={() => onUpdate({ venueId: "", location: "" })}
          />
        </div>
        <button
          type="button"
          onClick={() => setPicking(false)}
          className="text-play-600 hover:text-play-700 mt-1.5 cursor-pointer text-xs font-semibold underline"
        >
          Type the place instead
        </button>
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={`where-${session.key}`} className={labelCls}>
        Where <span className="text-hoop-600">*</span>
      </label>
      <input
        id={`where-${session.key}`}
        type="text"
        className={inputCls}
        value={session.location}
        onChange={(e) => onUpdate({ location: e.target.value })}
        placeholder="Sheridan Athletic Centre, Oakville"
      />
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="text-play-600 hover:text-play-700 mt-1.5 cursor-pointer text-xs font-semibold underline"
      >
        Pick a saved venue
      </button>
    </div>
  )
}

/** Numbered section title for the one-page builder. */
export function StepTitle({ step, children }: { step: number; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="bg-ink-900 grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white">
        {step}
      </span>
      {children}
    </span>
  )
}

export const ICONS: Record<string, ReactNode> = {
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  ),
}

/** The one place the builder and the detail page agree on error wording. */
export async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const json = await res.json()
    return json.error || fallback
  } catch {
    return fallback
  }
}
