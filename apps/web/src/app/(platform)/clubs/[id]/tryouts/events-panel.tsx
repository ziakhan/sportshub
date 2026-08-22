"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Badge, Button, Card, PanelHeader } from "@/components/ui"

/**
 * Club tryout EVENTS on the tryouts page
 * (docs/roadmap/club-tryouts-and-age-pools).
 *
 * The team-posted tryout below this panel stays the simple case. An event is
 * the club-level announcement covering several age groups at once, and the
 * age-group pool it fills is where team decisions are actually made, so both
 * doors are at the top of the page.
 */

interface EventRow {
  id: string
  title: string
  description: string | null
  seasonLabel: string
  isPublished: boolean
  showSignupCount: boolean
  sessionCount: number
  signupCount: number
  ageGroups: string[]
  startsAt: string | null
}

export function TryoutEventsPanel({ clubId, canEdit }: { clubId: string; canEdit: boolean }) {
  const router = useRouter()
  const [events, setEvents] = useState<EventRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetch(`/api/clubs/${clubId}/tryout-events`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load your tryout events")
        return res.json()
      })
      .then((json) => live && setEvents(json.events ?? []))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not load your tryout events"))
    return () => {
      live = false
    }
  }, [clubId])

  /** Turn evaluation on for this event (idempotent) and go to the floor. */
  const startEvaluating = async (eventId: string) => {
    setStarting(eventId)
    try {
      const res = await fetch(`/api/clubs/${clubId}/evaluation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.sessionId) {
        router.push(`/clubs/${clubId}/tryouts/evaluate/${json.sessionId}`)
        return
      }
    } finally {
      setStarting(null)
    }
  }

  return (
    <Card className="reveal mb-8">
      <PanelHeader
        title="Tryout events"
        action={
          <span className="flex flex-wrap gap-2">
            <Button
              href={`/clubs/${clubId}/tryouts/pool`}
              variant="secondary"
              size="sm"
              icon={ICONS.users}
              data-testid="open-pool"
            >
              Age-group pools
            </Button>
            {canEdit && (
              <Button
                href={`/clubs/${clubId}/tryouts/events/create`}
                size="sm"
                icon={ICONS.plus}
                data-testid="new-event"
              >
                New event
              </Button>
            )}
          </span>
        }
      />

      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-xl border p-3 text-sm">
          {error}
        </div>
      )}

      {!error && events === null && <p className="text-ink-500 text-sm">Loading...</p>}

      {!error && events !== null && events.length === 0 && (
        <div className="border-ink-300 rounded-2xl border border-dashed p-8 text-center">
          <h3 className="font-condensed text-ink-950 mb-1 text-lg font-bold uppercase tracking-wide">
            No tryout events yet
          </h3>
          <p className="text-ink-600 mx-auto mb-4 max-w-md text-sm">
            One event covers every age group you are trying out, each with its own gym slot.
            Players land in an age-group pool, and you decide how many teams to make from what
            turns up.
          </p>
          {canEdit ? (
            <Button href={`/clubs/${clubId}/tryouts/events/create`} size="sm" icon={ICONS.plus}>
              Create your first event
            </Button>
          ) : (
            <p className="text-ink-500 text-sm">
              Your club owner or manager sets these up.
            </p>
          )}
        </div>
      )}

      {!error && events !== null && events.length > 0 && (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="border-ink-100 hover:border-[color:var(--brand-line)] rounded-2xl border p-4 transition duration-200"
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <h3 className="text-ink-900 text-base font-semibold">{event.title}</h3>
                {event.isPublished ? (
                  <Badge tone="court" dot>
                    Published
                  </Badge>
                ) : (
                  <Badge tone="hoop">Draft</Badge>
                )}
                <Badge tone="neutral">{event.seasonLabel}</Badge>
              </div>
              <div className="text-ink-500 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>
                  {event.sessionCount} {event.sessionCount === 1 ? "session" : "sessions"}
                </span>
                {event.ageGroups.length > 0 && <span>{event.ageGroups.join(", ")}</span>}
                {event.startsAt && (
                  <span>Starts {format(new Date(event.startsAt), "MMM d, yyyy")}</span>
                )}
                <span>{event.signupCount} signed up</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  href={`/clubs/${clubId}/tryouts/events/${event.id}`}
                  variant="secondary"
                  size="sm"
                >
                  Open event
                </Button>
                <Button
                  href={`/clubs/${clubId}/tryouts/pool?seasonLabel=${encodeURIComponent(event.seasonLabel)}`}
                  variant="subtle"
                  size="sm"
                >
                  Its pools
                </Button>
                {/* Evaluation is off until a club admin turns it on, so this
                    posts first and then lands on the scoring screen. Nothing
                    changes for a club that only ever wanted attendance. */}
                <Button
                  onClick={() => startEvaluating(event.id)}
                  variant="subtle"
                  size="sm"
                  disabled={starting === event.id}
                >
                  {starting === event.id ? "Opening…" : "Evaluate"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

const ICONS = {
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
    </svg>
  ),
}
