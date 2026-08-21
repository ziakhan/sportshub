"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import {
  AnimatedNumber,
  Badge,
  BrandListbox,
  Button,
  Card,
  PanelHeader,
  SmartBack,
  toneForStatus,
} from "@/components/ui"
import type { ReactNode } from "react"

/**
 * Age-group pool console (docs/roadmap/club-tryouts-and-age-pools).
 *
 * The pool is the centre of gravity. Kids land in it from tryout sessions and
 * stay until a person puts them on a team, so "accepted but unassigned" is a
 * resting state, not a gap. The accepted count per age group is the loudest
 * number on the page because it is the one that decides how many teams the
 * club makes.
 *
 * Cross-team privacy: a player another team holds arrives from the API already
 * redacted, name and team tag only. This file never tries to fill that in.
 */

interface ReleaseRequest {
  id: string
  kind: "RELEASE_TO_POOL" | "TRANSFER"
  status: string
  createdAt: string
  requestedById: string
  holdingTeam: { id: string; name: string } | null
  requestingTeam: { id: string; name: string } | null
}

interface PoolMember {
  id: string
  seasonLabel: string
  ageGroup: string
  player: {
    id: string
    firstName: string
    lastName: string
    birthYear?: number | null
    gender?: string | null
  }
  assignedTeam: { id: string; name: string } | null
  assignedAt: string | null
  redacted: boolean
  offer?: { id: string; status: string; seasonFee: number; expiresAt: string } | null
  offerState?: string
  source?: {
    sessionId: string
    sessionTitle: string
    scheduledAt: string
    location: string
    eventId: string | null
    eventTitle: string | null
    checkedInAt: string | null
  } | null
  releaseRequests?: ReleaseRequest[]
}

interface AgeCounts {
  total: number
  accepted: number
  assigned: number
  unassigned: number
  offered: number
}

interface PoolPayload {
  members: PoolMember[]
  counts: Record<string, AgeCounts>
  seasonLabels: { seasonLabel: string; count: number }[]
  ageGroups: { ageGroup: string; count: number }[]
  teams: { id: string; name: string; ageGroup: string | null; gender: string | null }[]
  filters: { seasonLabel: string | null; ageGroup: string | null }
}

interface Template {
  id: string
  name: string
  seasonFee: number
}

interface EventRow {
  id: string
  title: string
  seasonLabel: string
  sessionCount: number
  signupCount: number
}

type Panel = "none" | "sync" | "offers" | "finalize"

function offerLabel(state: string): string {
  if (state === "none") return "No offer"
  if (state === "PENDING") return "Offer pending"
  if (state === "ACCEPTED") return "Accepted"
  if (state === "DECLINED") return "Declined"
  if (state === "EXPIRED") return "Offer expired"
  return state
}

export function PoolConsole({
  clubId,
  isAdmin,
  myTeamIds,
  initialSeason,
  initialAgeGroup,
}: {
  clubId: string
  isAdmin: boolean
  myTeamIds: string[]
  initialSeason: string
  initialAgeGroup: string
}) {
  const [data, setData] = useState<PoolPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [seasonLabel, setSeasonLabel] = useState(initialSeason)
  const [ageGroup, setAgeGroup] = useState(initialAgeGroup)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [templates, setTemplates] = useState<Template[]>([])
  const [events, setEvents] = useState<EventRow[]>([])

  const [panel, setPanel] = useState<Panel>("none")
  const [syncEventId, setSyncEventId] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [finalizeTeamId, setFinalizeTeamId] = useState("")

  /** The row with its assign or release control open. */
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assignTeamId, setAssignTeamId] = useState("")
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [releaseKind, setReleaseKind] = useState<"RELEASE_TO_POOL" | "TRANSFER">("RELEASE_TO_POOL")
  const [releaseTeamId, setReleaseTeamId] = useState("")

  const mine = useMemo(() => new Set(myTeamIds), [myTeamIds])
  const canActOnTeam = useCallback(
    (teamId: string | null | undefined) => !!teamId && (isAdmin || mine.has(teamId)),
    [isAdmin, mine]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (seasonLabel) p.set("seasonLabel", seasonLabel)
      if (ageGroup) p.set("ageGroup", ageGroup)
      const res = await fetch(`/api/clubs/${clubId}/tryout-pool?${p}`)
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not load the pool")
      setData(await res.json())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the pool")
    } finally {
      setLoading(false)
    }
  }, [clubId, seasonLabel, ageGroup])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    fetch(`/api/clubs/${clubId}/offer-templates`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setTemplates(j.templates ?? []))
      .catch(() => {})
    fetch(`/api/clubs/${clubId}/tryout-events`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setEvents(j.events ?? []))
      .catch(() => {})
  }, [clubId])

  // A filter change invalidates a selection made against the old list.
  useEffect(() => setSelected(new Set()), [seasonLabel, ageGroup])

  /** Every mutation is one POST, one loading state, one strip at the end. */
  async function act(body: unknown, describe: (json: any) => string): Promise<boolean> {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/clubs/${clubId}/tryout-pool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "That did not go through")
      setNotice(describe(json))
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not go through")
      return false
    } finally {
      setBusy(false)
    }
  }

  const members = useMemo(() => data?.members ?? [], [data])
  const counts = data?.counts ?? {}
  const teams = data?.teams ?? []
  const chosenTemplate = templates.find((t) => t.id === templateId) ?? null
  const chosenTeam = teams.find((t) => t.id === finalizeTeamId) ?? null

  /** Rows you may act on in bulk: never a redacted one, never a placed one. */
  const selectable = useMemo(
    () => members.filter((m) => !m.redacted && !m.assignedTeam),
    [members]
  )
  const allSelected = selectable.length > 0 && selectable.every((m) => selected.has(m.id))

  const pendingRequests = useMemo(() => {
    const rows: { member: PoolMember; request: ReleaseRequest }[] = []
    for (const member of members) {
      for (const request of member.releaseRequests ?? []) {
        if (request.status === "PENDING") rows.push({ member, request })
      }
    }
    return rows
  }, [members])

  const seasonOptions = [
    { value: "", label: "All seasons" },
    ...(data?.seasonLabels ?? []).map((s) => ({
      value: s.seasonLabel,
      label: `${s.seasonLabel} (${s.count})`,
    })),
  ]
  const ageOptions = [
    { value: "", label: "All age groups" },
    ...(data?.ageGroups ?? []).map((a) => ({
      value: a.ageGroup,
      label: `${a.ageGroup} (${a.count})`,
    })),
  ]
  const teamOptions = teams.map((t) => ({
    value: t.id,
    label: t.ageGroup ? `${t.name} (${t.ageGroup})` : t.name,
  }))
  const myTeamOptions = teamOptions.filter((t) => canActOnTeam(t.value))

  const ageKeys = Object.keys(counts).sort()

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <SmartBack
          fallback={`/clubs/${clubId}/tryouts`}
          fallbackLabel="Tryouts"
          className="-ml-1 mb-1"
        />
        <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
          Age-group pools
        </h2>
        <p className="text-ink-600 mt-1 text-sm">
          Everyone who tried out, by age group. Accepted players wait here until someone puts them
          on a team, and that is a normal place to wait.
        </p>
      </div>

      {notice && (
        <div
          className="border-court-200 bg-court-50 text-court-700 mb-4 rounded-xl border p-3 text-sm"
          data-testid="pool-notice"
        >
          {notice}
        </div>
      )}
      {error && (
        <div
          className="border-hoop-200 bg-hoop-50 text-hoop-700 mb-4 rounded-xl border p-3 text-sm"
          role="alert"
          data-testid="pool-error"
        >
          {error}
        </div>
      )}

      {/* Toolbar */}
      <Card size="sm" className="reveal mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[190px]">
            <label htmlFor="pool-season" className="text-ink-700 block text-sm font-medium">
              Season
            </label>
            <div className="mt-1">
              <BrandListbox
                id="pool-season"
                ariaLabel="Season"
                value={seasonLabel}
                onChange={setSeasonLabel}
                options={seasonOptions}
              />
            </div>
          </div>
          <div className="min-w-[190px]">
            <label htmlFor="pool-age" className="text-ink-700 block text-sm font-medium">
              Age group
            </label>
            <div className="mt-1">
              <BrandListbox
                id="pool-age"
                ariaLabel="Age group"
                value={ageGroup}
                onChange={setAgeGroup}
                options={ageOptions}
              />
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                icon={ICONS.download}
                onClick={() => setPanel(panel === "sync" ? "none" : "sync")}
                data-testid="sync-open"
              >
                Sync from event
              </Button>
            )}
            <Button
              variant="subtle"
              size="sm"
              icon={ICONS.flag}
              onClick={() => setPanel(panel === "finalize" ? "none" : "finalize")}
              data-testid="finalize-open"
            >
              Finalize a team
            </Button>
          </div>
        </div>

        {panel === "sync" && (
          <div className="border-ink-100 mt-3 border-t pt-3">
            {events.length === 0 ? (
              <div className="text-sm">
                <p className="text-ink-600 mb-2">
                  There are no tryout events yet, so there is nothing to pull players from.
                </p>
                <Button href={`/clubs/${clubId}/tryouts/events/create`} size="sm">
                  Create a tryout event
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[260px] flex-1">
                  <label htmlFor="sync-event" className="text-ink-700 block text-sm font-medium">
                    Take everyone who signed up for
                  </label>
                  <div className="mt-1">
                    <BrandListbox
                      id="sync-event"
                      ariaLabel="Tryout event"
                      placeholder="Pick an event"
                      value={syncEventId}
                      onChange={setSyncEventId}
                      options={events.map((e) => ({
                        value: e.id,
                        label: `${e.title} (${e.seasonLabel}, ${e.signupCount} signed up)`,
                      }))}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={busy || !syncEventId}
                  onClick={async () => {
                    const ok = await act(
                      { action: "sync-from-event", eventId: syncEventId },
                      (json) =>
                        json.created > 0
                          ? `${json.created} ${json.created === 1 ? "player" : "players"} added to ${json.ageGroups.join(", ")}.${json.skipped ? ` ${json.skipped} were already in the pool or had no player profile.` : ""}`
                          : "Everyone from that event is already in the pool."
                    )
                    if (ok) setPanel("none")
                  }}
                  data-testid="sync-run"
                >
                  {busy ? "Working..." : "Fill the pool"}
                </Button>
                <Button size="sm" variant="subtle" onClick={() => setPanel("none")}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {panel === "finalize" && (
          <div className="border-ink-100 mt-3 border-t pt-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <label htmlFor="finalize-team" className="text-ink-700 block text-sm font-medium">
                  Which team is set
                </label>
                <div className="mt-1">
                  <BrandListbox
                    id="finalize-team"
                    ariaLabel="Team to finalize"
                    placeholder="Pick a team"
                    value={finalizeTeamId}
                    onChange={setFinalizeTeamId}
                    options={myTeamOptions.length > 0 ? myTeamOptions : teamOptions}
                  />
                </div>
              </div>
              <Button
                size="sm"
                disabled={busy || !finalizeTeamId}
                onClick={async () => {
                  const ok = await act({ action: "finalize-team", teamId: finalizeTeamId }, (json) =>
                    json.players > 0
                      ? `${chosenTeam?.name ?? "The team"} is set. ${json.familiesNotified} ${json.familiesNotified === 1 ? "family was" : "families were"} told, covering ${json.players} ${json.players === 1 ? "player" : "players"}.`
                      : `${chosenTeam?.name ?? "That team"} has nobody assigned yet, so nobody was told.`
                  )
                  if (ok) setPanel("none")
                }}
                data-testid="finalize-run"
              >
                {busy ? "Working..." : "Finalize the team"}
              </Button>
              <Button size="sm" variant="subtle" onClick={() => setPanel("none")}>
                Cancel
              </Button>
            </div>
            <p className="text-ink-600 mt-2 text-sm">
              Families of every assigned player will be told the roster is set.
            </p>
          </div>
        )}
      </Card>

      {/* The number that decides how many teams the club makes. */}
      {ageKeys.length > 0 && (
        <div className="reveal mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ageKeys.map((key) => {
            const c = counts[key]
            return (
              <div
                key={key}
                className="border-ink-100 shadow-soft rounded-2xl border bg-white p-4"
                data-testid="age-counts"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setAgeGroup(ageGroup === key ? "" : key)}
                    className={`cursor-pointer rounded-full px-2.5 py-0.5 text-sm font-bold transition ${
                      ageGroup === key
                        ? "bg-ink-900 text-white"
                        : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                    }`}
                  >
                    {key}
                  </button>
                  <span className="text-ink-500 text-xs">{c.total} in the pool</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="font-condensed text-court-700 text-4xl font-bold leading-none">
                    <AnimatedNumber value={c.accepted} />
                  </span>
                  <span className="text-ink-600 pb-0.5 text-sm font-semibold">accepted</span>
                </div>
                <div className="text-ink-500 mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <span>{c.offered} offered</span>
                  <span>{c.assigned} on a team</span>
                  <span>{c.unassigned} still in the pool</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Release and transfer handshakes waiting on somebody. */}
      {pendingRequests.length > 0 && (
        <Card className="reveal mb-4" size="sm">
          <PanelHeader title="Waiting on an answer" />
          <div className="space-y-2">
            {pendingRequests.map(({ member, request }) => {
              const canAnswer = canActOnTeam(request.holdingTeam?.id)
              return (
                <div
                  key={request.id}
                  className="border-ink-100 flex flex-wrap items-center gap-2 rounded-xl border p-3"
                >
                  <div className="min-w-[220px] flex-1 text-sm">
                    <span className="text-ink-900 font-semibold">
                      {member.player.firstName} {member.player.lastName}
                    </span>
                    <span className="text-ink-600">
                      {" "}
                      {request.kind === "TRANSFER"
                        ? `would move from ${request.holdingTeam?.name ?? "their team"} to ${request.requestingTeam?.name ?? "another team"}`
                        : `would go back to the ${member.ageGroup} pool from ${request.holdingTeam?.name ?? "their team"}`}
                    </span>
                    <div className="text-ink-400 text-xs">
                      Asked {format(new Date(request.createdAt), "MMM d")}
                    </div>
                  </div>
                  {canAnswer ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          act(
                            {
                              action: "resolve-release",
                              requestId: request.id,
                              resolution: "accept",
                            },
                            (json) =>
                              json.movedTo
                                ? `${member.player.firstName} is now with ${json.movedTo.name}.`
                                : `${member.player.firstName} is back in the pool.`
                          )
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="subtle"
                        disabled={busy}
                        onClick={() =>
                          act(
                            {
                              action: "resolve-release",
                              requestId: request.id,
                              resolution: "decline",
                            },
                            () => `${member.player.firstName} stays put.`
                          )
                        }
                      >
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <span className="text-ink-500 text-xs">
                      {request.holdingTeam?.name ?? "The holding team"} answers this one.
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Selection actions */}
      {selected.size > 0 && (
        <Card size="sm" className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-700 text-sm font-semibold">
              {selected.size} selected
            </span>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => setPanel(panel === "offers" ? "none" : "offers")}
                data-testid="offers-open"
              >
                Send offers
              </Button>
            )}
            <Button size="sm" variant="subtle" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            {!isAdmin && (
              <span className="text-ink-500 text-xs">
                Club owners and managers send the offers.
              </span>
            )}
          </div>

          {panel === "offers" && isAdmin && (
            <div className="border-ink-100 mt-3 border-t pt-3">
              {templates.length === 0 ? (
                <div className="text-sm">
                  <p className="text-ink-600 mb-2">
                    An offer carries the season fee and what is included, and that comes from a
                    template. You do not have one yet.
                  </p>
                  <Button href={`/clubs/${clubId}/offer-templates`} size="sm">
                    Make an offer template
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="min-w-[260px] max-w-md">
                    <label htmlFor="offer-template" className="text-ink-700 block text-sm font-medium">
                      Offer template
                    </label>
                    <div className="mt-1">
                      <BrandListbox
                        id="offer-template"
                        ariaLabel="Offer template"
                        placeholder="Pick a template"
                        value={templateId}
                        onChange={setTemplateId}
                        options={templates.map((t) => ({
                          value: t.id,
                          label: `${t.name} ($${t.seasonFee.toFixed(2)})`,
                        }))}
                      />
                    </div>
                  </div>
                  {chosenTemplate && (
                    <p className="border-ink-200 bg-ink-50 text-ink-700 rounded-md border px-3 py-2 text-sm">
                      {selected.size} {selected.size === 1 ? "family gets" : "families get"} the{" "}
                      <span className="font-semibold">{chosenTemplate.name}</span> offer at $
                      {chosenTemplate.seasonFee.toFixed(2)}. Nothing is charged until a family
                      accepts.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busy || !templateId}
                      onClick={async () => {
                        const ok = await act(
                          {
                            action: "send-offers",
                            memberIds: [...selected],
                            templateId,
                          },
                          (json) => {
                            const skipped = (json.skipped ?? []) as {
                              playerName: string | null
                              reason: string
                            }[]
                            const head = `${json.sent} ${json.sent === 1 ? "offer" : "offers"} sent.`
                            if (skipped.length === 0) return head
                            const names = skipped
                              .slice(0, 4)
                              .map((s) => `${s.playerName ?? "One player"}: ${s.reason}`)
                              .join(". ")
                            return `${head} ${skipped.length} skipped. ${names}`
                          }
                        )
                        if (ok) {
                          setSelected(new Set())
                          setPanel("none")
                        }
                      }}
                      data-testid="offers-send"
                    >
                      {busy ? "Sending..." : "Send the offers"}
                    </Button>
                    <Button size="sm" variant="subtle" onClick={() => setPanel("none")}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* The pool itself */}
      <Card className="reveal !p-0 overflow-hidden">
        <PanelHeader
          variant="band"
          title="In the pool"
          action={
            <span className="text-ink-600 text-sm font-semibold">
              {members.length} {members.length === 1 ? "player" : "players"}
            </span>
          }
        />

        {loading && members.length === 0 ? (
          <p className="text-ink-500 px-6 py-10 text-center text-sm">Loading the pool...</p>
        ) : members.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <h3 className="font-condensed text-ink-950 mb-1 text-lg font-bold uppercase tracking-wide">
              Nobody in the pool yet
            </h3>
            <p className="text-ink-600 mx-auto mb-4 max-w-md text-sm">
              Players arrive here from a tryout event. Pull them in once the sessions have run, or
              once the signups are in.
            </p>
            {isAdmin ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => setPanel("sync")}>
                  Sync from an event
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  href={`/clubs/${clubId}/tryouts/events/create`}
                >
                  Create a tryout event
                </Button>
              </div>
            ) : (
              <p className="text-ink-500 text-sm">
                Your club owner or manager fills the pool from a tryout event.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-ink-50 text-ink-500 text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select every unassigned player"
                      className="text-play-600 focus:ring-play-500/20 border-ink-300 h-4 w-4 cursor-pointer rounded"
                      checked={allSelected}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? new Set(selectable.map((m) => m.id)) : new Set()
                        )
                      }
                    />
                  </th>
                  <th className="min-w-[190px] px-3 py-2">Player</th>
                  <th className="px-3 py-2">Age group</th>
                  <th className="min-w-[200px] px-3 py-2">Came from</th>
                  <th className="px-3 py-2">Offer</th>
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const state = member.offerState ?? "none"
                  const holdersTeam = member.assignedTeam
                  const canRelease = canActOnTeam(holdersTeam?.id)
                  const hasPending = (member.releaseRequests ?? []).some(
                    (r) => r.status === "PENDING"
                  )
                  return (
                    <tr
                      key={member.id}
                      className={`border-ink-100 border-t align-top ${
                        member.redacted ? "bg-ink-50/40" : "hover:bg-ink-50/60"
                      }`}
                      data-testid="pool-row"
                    >
                      <td className="px-3 py-2">
                        {!member.redacted && !holdersTeam && (
                          <input
                            type="checkbox"
                            aria-label={`Select ${member.player.firstName} ${member.player.lastName}`}
                            className="text-play-600 focus:ring-play-500/20 border-ink-300 h-4 w-4 cursor-pointer rounded"
                            checked={selected.has(member.id)}
                            onChange={(e) => {
                              const next = new Set(selected)
                              if (e.target.checked) next.add(member.id)
                              else next.delete(member.id)
                              setSelected(next)
                            }}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div
                          className={
                            member.redacted
                              ? "text-ink-600 font-medium"
                              : "text-ink-900 font-medium"
                          }
                        >
                          {member.player.firstName} {member.player.lastName}
                        </div>
                        {!member.redacted && member.player.birthYear && (
                          <div className="text-ink-500 text-xs">
                            Born {member.player.birthYear}
                          </div>
                        )}
                      </td>
                      <td className="text-ink-700 px-3 py-2">{member.ageGroup}</td>
                      <td className="px-3 py-2">
                        {member.redacted ? (
                          <span className="text-ink-400 text-xs">
                            Held by another team
                          </span>
                        ) : member.source ? (
                          <div className="text-ink-600 text-xs">
                            <div className="text-ink-800">
                              {member.source.eventTitle ?? member.source.sessionTitle}
                            </div>
                            <div>
                              {format(new Date(member.source.scheduledAt), "MMM d")} at{" "}
                              {member.source.location}
                              {member.source.checkedInAt ? ", checked in" : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-400 text-xs">Added by hand</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {member.redacted ? (
                          <span className="text-ink-300 text-xs">Not shown</span>
                        ) : state === "none" ? (
                          <Badge tone="neutral">No offer</Badge>
                        ) : (
                          <Badge tone={toneForStatus(state)}>{offerLabel(state)}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {holdersTeam ? (
                          <span className="text-ink-700 text-sm">{holdersTeam.name}</span>
                        ) : (
                          <span className="text-ink-400 text-sm">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex justify-end gap-1">
                            {!holdersTeam && !member.redacted && (
                              <Button
                                size="sm"
                                variant="secondary"
                                tone="ink"
                                onClick={() => {
                                  setAssigningId(assigningId === member.id ? null : member.id)
                                  setAssignTeamId("")
                                  setReleasingId(null)
                                }}
                                data-testid="assign-open"
                              >
                                Assign
                              </Button>
                            )}
                            {holdersTeam && canRelease && (
                              <Button
                                size="sm"
                                variant="subtle"
                                disabled={busy}
                                onClick={() =>
                                  act(
                                    { action: "unassign", memberId: member.id },
                                    (json) =>
                                      json.message ??
                                      `${member.player.firstName} is back in the pool.`
                                  )
                                }
                              >
                                Unassign
                              </Button>
                            )}
                            {holdersTeam && !canRelease && !hasPending && (
                              <Button
                                size="sm"
                                variant="subtle"
                                onClick={() => {
                                  setReleasingId(releasingId === member.id ? null : member.id)
                                  setReleaseKind("RELEASE_TO_POOL")
                                  setReleaseTeamId("")
                                  setAssigningId(null)
                                }}
                              >
                                Ask for a release
                              </Button>
                            )}
                            {holdersTeam && hasPending && (
                              <Badge tone="gold">Asked</Badge>
                            )}
                          </div>

                          {assigningId === member.id && (
                            <div className="border-ink-100 bg-ink-50/70 w-full max-w-sm rounded-xl border p-3 text-left">
                              <label
                                htmlFor={`assign-${member.id}`}
                                className="text-ink-700 block text-xs font-semibold uppercase tracking-wide"
                              >
                                Put {member.player.firstName} on
                              </label>
                              <div className="mt-1.5">
                                <BrandListbox
                                  id={`assign-${member.id}`}
                                  ariaLabel="Team"
                                  placeholder="Pick a team"
                                  value={assignTeamId}
                                  onChange={setAssignTeamId}
                                  options={teamOptions}
                                />
                              </div>
                              <div className="mt-2 flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={busy || !assignTeamId}
                                  onClick={async () => {
                                    const ok = await act(
                                      {
                                        action: "assign",
                                        memberId: member.id,
                                        teamId: assignTeamId,
                                      },
                                      (json) =>
                                        json.message ??
                                        `${member.player.firstName} is on the team.`
                                    )
                                    if (ok) setAssigningId(null)
                                  }}
                                  data-testid="assign-run"
                                >
                                  {busy ? "Working..." : "Assign"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="subtle"
                                  onClick={() => setAssigningId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                              <p className="text-ink-500 mt-2 text-xs">
                                Families hear when the team is finalized, not on this.
                              </p>
                            </div>
                          )}

                          {releasingId === member.id && (
                            <div className="border-ink-100 bg-ink-50/70 w-full max-w-sm rounded-xl border p-3 text-left">
                              <span className="text-ink-700 block text-xs font-semibold uppercase tracking-wide">
                                Ask {holdersTeam?.name} about {member.player.firstName}
                              </span>
                              <div className="mt-1.5 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setReleaseKind("RELEASE_TO_POOL")}
                                  className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                    releaseKind === "RELEASE_TO_POOL"
                                      ? "bg-ink-900 text-white"
                                      : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                                  }`}
                                >
                                  Back to the pool
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReleaseKind("TRANSFER")}
                                  className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                    releaseKind === "TRANSFER"
                                      ? "bg-ink-900 text-white"
                                      : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                                  }`}
                                >
                                  Straight to my team
                                </button>
                              </div>
                              {releaseKind === "TRANSFER" && (
                                <div className="mt-2">
                                  <label
                                    htmlFor={`release-team-${member.id}`}
                                    className="text-ink-700 block text-xs font-semibold uppercase tracking-wide"
                                  >
                                    Moving to
                                  </label>
                                  <div className="mt-1.5">
                                    <BrandListbox
                                      id={`release-team-${member.id}`}
                                      ariaLabel="Team the player would move to"
                                      placeholder="Pick your team"
                                      value={releaseTeamId}
                                      onChange={setReleaseTeamId}
                                      options={myTeamOptions}
                                    />
                                  </div>
                                </div>
                              )}
                              <div className="mt-2 flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={
                                    busy || (releaseKind === "TRANSFER" && !releaseTeamId)
                                  }
                                  onClick={async () => {
                                    const ok = await act(
                                      {
                                        action: "request-release",
                                        poolMemberId: member.id,
                                        kind: releaseKind,
                                        ...(releaseKind === "TRANSFER"
                                          ? { requestingTeamId: releaseTeamId }
                                          : {}),
                                      },
                                      () =>
                                        `${holdersTeam?.name ?? "That team"} has been asked about ${member.player.firstName}.`
                                    )
                                    if (ok) setReleasingId(null)
                                  }}
                                >
                                  {busy ? "Sending..." : "Send the request"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="subtle"
                                  onClick={() => setReleasingId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                              <p className="text-ink-500 mt-2 text-xs">
                                {holdersTeam?.name} decides. No manager overrules it.
                              </p>
                            </div>
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

const ICONS: Record<string, ReactNode> = {
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
    </svg>
  ),
  flag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 21V4m0 0h11l-1.5 4L15 12H4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}
