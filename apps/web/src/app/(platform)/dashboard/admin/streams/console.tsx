"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge, Button, Card, SectionHeader } from "@/components/ui"
import { isSignalFresh } from "@/lib/streaming/health"
import { ChannelCard } from "./channel-card"
import { ChannelFormDialog, type ChannelDraft } from "./channel-form"
import { ChannelHandoffDialog } from "./handoff"
import { PlacementDialog, TakeoverDialog } from "./placement-dialog"
import { ErrorStrip, NoticeStrip, PlusIcon, SignalIcon, agoLabel } from "./bits"
import type {
  Channel,
  ChannelHealth,
  PlacementTarget,
  ProviderOption,
  StreamOpsAuditEntry,
  StreamOpsSchedule,
  StreamOpsVenue,
  TakeoverConflict,
} from "./types"

/**
 * Streams ops dashboard (client half).
 *
 * Follows the club review console: a thin server page resolves auth, this
 * component owns the reads, the dialogs and every async state. Three endpoints
 * feed it and each keeps its own job:
 *
 *   GET  /api/admin/streams/channels   the rigs, secrets included (the one door)
 *   GET  /api/admin/streams/overview   what they are showing, where they can go
 *   GET  /api/admin/streams/health     are they actually pushing a picture
 *   POST /api/admin/streams/placement  move one, with the take-over guard
 *
 * Every button here says what it is doing while it does it and says what
 * happened afterwards. On a page whose whole subject is "is this thing on",
 * a control that goes quiet is the worst possible affordance.
 */

/** How often the relative timestamps re-render. No fetching, just the clock. */
const TICK_MS = 15_000

/**
 * Turn an API error envelope into something a person can act on.
 *
 * `withAuth` answers a schema failure with `{ error: "Invalid input", details:
 * [zod issues] }`. "Invalid input" alone tells an operator nothing about which
 * of six fields the server disliked, so the issue paths get folded back in.
 */
function describeApiError(json: any, fallback = "Something went wrong"): string {
  const base = json?.error ?? fallback
  const issues = Array.isArray(json?.details) ? json.details : []
  const named = issues
    .map((issue: any) => {
      const field = Array.isArray(issue?.path) ? issue.path.join(".") : null
      return field ? `${field} (${issue.message ?? "not accepted"})` : null
    })
    .filter(Boolean)
  return named.length ? `${base}: ${named.join(", ")}` : base
}

interface Overview {
  now: string
  schedules: StreamOpsSchedule[]
  venues: StreamOpsVenue[]
  audit: StreamOpsAuditEntry[]
  placedBy: Record<string, string>
}

export function StreamsConsole() {
  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [health, setHealth] = useState<Record<string, ChannelHealth>>({})

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [checking, setChecking] = useState(false)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [moving, setMoving] = useState<Channel | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [takeover, setTakeover] = useState<{
    channel: Channel
    target: PlacementTarget
    conflict: TakeoverConflict
  } | null>(null)

  const [editing, setEditing] = useState<Channel | null>(null)
  const [adding, setAdding] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [providers, setProviders] = useState<ProviderOption[] | null>(null)
  /** A camera just created for us — the RTMP pair to carry to the gym. */
  const [handoff, setHandoff] = useState<Channel | null>(null)

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(timer)
  }, [])

  /* ── reads ─────────────────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [channelsRes, overviewRes] = await Promise.all([
        fetch("/api/admin/streams/channels"),
        fetch("/api/admin/streams/overview"),
      ])
      if (!channelsRes.ok) throw new Error(describeApiError(await channelsRes.json(), "Could not load the cameras"))
      if (!overviewRes.ok) throw new Error(describeApiError(await overviewRes.json(), "Could not load today's schedule"))
      const channelsJson = await channelsRes.json()
      setChannels(channelsJson.channels ?? [])
      setOverview(await overviewRes.json())
      return (channelsJson.channels ?? []) as Channel[]
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load the cameras")
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const checkSignal = useCallback(async (channelId?: string) => {
    if (channelId) setCheckingId(channelId)
    else setChecking(true)
    setCheckError(null)
    try {
      const res = await fetch(
        `/api/admin/streams/health${channelId ? `?channelId=${encodeURIComponent(channelId)}` : ""}`
      )
      if (!res.ok) throw new Error(describeApiError(await res.json(), "The signal check failed"))
      const json = await res.json()
      setHealth((prev) => {
        const next = { ...prev }
        for (const entry of json.channels as ChannelHealth[]) next[entry.id] = entry
        return next
      })
      setCheckedAt(json.checkedAt)
      setNow(new Date())
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : "The signal check failed")
    } finally {
      setChecking(false)
      setCheckingId(null)
    }
  }, [])

  useEffect(() => {
    let live = true
    void load().then((loaded) => {
      // Probe on arrival, so the page is never green-by-default on stale stamps.
      if (live && loaded.some((c) => c.status === "ACTIVE")) void checkSignal()
    })
    return () => {
      live = false
    }
  }, [load, checkSignal])

  /**
   * Which providers this server can use. Read once — the answer is env vars,
   * which cannot change without a restart. Kept off the main load path: if
   * this fails the form simply offers Custom, which always works.
   */
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const res = await fetch("/api/admin/streams/providers")
        if (!res.ok) throw new Error("providers unavailable")
        const json = await res.json()
        if (live) setProviders((json.providers ?? []) as ProviderOption[])
      } catch {
        if (live) setProviders([])
      }
    })()
    return () => {
      live = false
    }
  }, [])

  /* ── writes ────────────────────────────────────────────────────────────── */

  const place = useCallback(
    async (channel: Channel, target: PlacementTarget, force: boolean) => {
      setBusyId(channel.id)
      setMoveError(null)
      setActionError(null)
      try {
        const res = await fetch("/api/admin/streams/placement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: channel.id,
            ...(target.courtId ? { courtId: target.courtId } : { venueId: target.venueId }),
            ...(force ? { force: true } : {}),
          }),
        })
        const json = await res.json()

        if (!res.ok) {
          // The guard hands back the other court's live game so the dialog can
          // name what goes dark. Anything else is an ordinary failure.
          if (json.code === "TAKEOVER_REQUIRED" && json.details) {
            // The picker closes as the confirm opens. Two stacked dialogs would
            // make "leave it where it is" ambiguous — leave what, the move or
            // the whole picker? One question on screen at a time.
            setMoving(null)
            setMoveError(null)
            setTakeover({ channel, target, conflict: json.details as TakeoverConflict })
            return
          }
          throw new Error(describeApiError(json, "Could not move the camera"))
        }

        const mapped = Array.isArray(json.mapped) ? json.mapped.length : 0
        const dropped = Array.isArray(json.unmapped) ? json.unmapped.length : 0
        setTakeover(null)
        setMoving(null)
        setNotice(
          `${channel.name} is at ${target.label}. ` +
            (mapped
              ? `It now shows ${mapped} ${mapped === 1 ? "game" : "games"} today`
              : "No games today at that spot yet") +
            (dropped ? `, and ${dropped} ${dropped === 1 ? "game" : "games"} it left behind went dark.` : ".")
        )
        await load()
        void checkSignal(channel.id)
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not move the camera"
        if (takeover) setActionError(message)
        else setMoveError(message)
      } finally {
        setBusyId(null)
      }
    },
    [load, checkSignal, takeover]
  )

  const saveChannel = useCallback(
    async (draft: ChannelDraft, channel: Channel | null) => {
      setSaving(true)
      setFormError(null)
      const provisioning = !channel && draft.mode === "cloudflare"
      try {
        const provider = draft.provider.trim()
        const notes = draft.notes.trim()

        const body: Record<string, unknown> = provisioning
          ? {
              // The provider fills in all three addresses; the operator gave
              // us a name and the recording choice (on by default, because on
              // Cloudflare that is what makes the picture exist at all).
              mode: "provision",
              provider: "cloudflare",
              name: draft.name.trim(),
              recording: draft.recording,
              ...(notes ? { notes } : {}),
            }
          : {
              name: draft.name.trim(),
              playbackUrl: draft.playbackUrl.trim(),
              // The ingest pair is optional now. On an edit, an emptied field
              // means CLEAR it (the edit schema takes null); on a create, an
              // empty one is simply not sent.
              ...(channel
                ? {
                    ingestUrl: draft.ingestUrl.trim() || null,
                    provider: provider || null,
                    notes: notes || null,
                  }
                : {
                    ...(draft.ingestUrl.trim() ? { ingestUrl: draft.ingestUrl.trim() } : {}),
                    ...(provider ? { provider } : {}),
                    ...(notes ? { notes } : {}),
                  }),
            }

        // Blank on an edit means "keep the key it already has", which is why
        // this is never sent as null from here.
        if (!provisioning && draft.streamKey.trim()) body.streamKey = draft.streamKey.trim()

        const res = await fetch("/api/admin/streams/channels", {
          method: channel ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(channel ? { id: channel.id, ...body } : body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(describeApiError(json, "Could not save the camera"))

        setEditing(null)
        setAdding(false)

        // A camera we just created hands its RTMP pair straight over: the
        // operator's next move is typing it into a phone, and making them go
        // hunting for it in a collapsed panel is the whole problem this
        // feature exists to remove.
        if (provisioning && json.channel) setHandoff(json.channel as Channel)

        setNotice(
          channel
            ? `${json.channel?.name ?? channel.name} saved.`
            : provisioning
              ? `${json.channel?.name ?? draft.name.trim()} was created at Cloudflare.`
              : `${json.channel?.name ?? draft.name.trim()} added. Place it at a court when the rig is set up.`
        )
        const loaded = await load()
        const saved = json.channel?.id as string | undefined
        if (saved && loaded.some((c) => c.id === saved && c.status === "ACTIVE")) {
          void checkSignal(saved)
        }
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Could not save the camera")
      } finally {
        setSaving(false)
      }
    },
    [load, checkSignal]
  )

  const toggleStatus = useCallback(
    async (channel: Channel) => {
      setBusyId(channel.id)
      setActionError(null)
      try {
        const next = channel.status === "ACTIVE" ? "DISABLED" : "ACTIVE"
        const res = await fetch("/api/admin/streams/channels", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: channel.id, status: next }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(describeApiError(json, "Could not change the camera"))
        setNotice(
          next === "DISABLED"
            ? `${channel.name} is off. Every game page it was showing has gone dark.`
            : `${channel.name} is back in service.`
        )
        await load()
        if (next === "ACTIVE") void checkSignal(channel.id)
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Could not change the camera")
      } finally {
        setBusyId(null)
      }
    },
    [load, checkSignal]
  )

  /* ── derived ───────────────────────────────────────────────────────────── */

  const scheduleByChannel = useMemo(() => {
    const map = new Map<string, StreamOpsSchedule>()
    for (const entry of overview?.schedules ?? []) map.set(entry.channelId, entry)
    return map
  }, [overview])

  /**
   * Rigs standing at the same spot as another rig.
   *
   * The assigner reports this as SHARED_PLACEMENT and then refuses to pick a
   * winner, because there is no right answer: whichever pass ran last owns the
   * court's games. The dashboard is where a person can actually fix it.
   */
  const sharingByChannel = useMemo(() => {
    const byPlacement = new Map<string, Channel[]>()
    for (const channel of channels ?? []) {
      if (channel.status !== "ACTIVE") continue
      const key = channel.currentCourtId
        ? `court:${channel.currentCourtId}`
        : channel.currentVenueId
          ? `venue:${channel.currentVenueId}`
          : null
      if (!key) continue
      byPlacement.set(key, [...(byPlacement.get(key) ?? []), channel])
    }
    const map = new Map<string, string[]>()
    for (const [, sharing] of byPlacement) {
      if (sharing.length < 2) continue
      for (const channel of sharing) {
        map.set(
          channel.id,
          sharing.filter((other) => other.id !== channel.id).map((other) => other.name)
        )
      }
    }
    return map
  }, [channels])

  const counts = useMemo(() => {
    const list = channels ?? []
    const active = list.filter((c) => c.status === "ACTIVE")
    const live = active.filter(
      (c) => health[c.id]?.live === true || isSignalFresh(health[c.id]?.lastSeenLiveAt ?? c.lastSeenLiveAt, now)
    )
    const placed = active.filter((c) => c.currentCourtId || c.currentVenueId)
    const needAttention = active.filter(
      (c) =>
        !(health[c.id]?.live === true || isSignalFresh(health[c.id]?.lastSeenLiveAt ?? c.lastSeenLiveAt, now)) &&
        !!scheduleByChannel.get(c.id)?.nowPlaying
    )
    return {
      total: list.length,
      active: active.length,
      live: live.length,
      placed: placed.length,
      needAttention: needAttention.length,
    }
  }, [channels, health, now, scheduleByChannel])

  const description = loading
    ? "Loading the camera fleet…"
    : counts.total === 0
      ? "No cameras set up yet"
      : `${counts.total} ${counts.total === 1 ? "camera" : "cameras"} · ${counts.live} pushing a picture · ${counts.placed} placed at a court`

  /* ── render ────────────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <SectionHeader title="Streams" description={description} />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          tone="play"
          disabled={checking || counts.active === 0}
          onClick={() => void checkSignal()}
          icon={<SignalIcon />}
          title={counts.active === 0 ? "There are no active cameras to check" : undefined}
        >
          {checking ? "Checking every camera…" : "Check signal"}
        </Button>
        <Button
          onClick={() => {
            setFormError(null)
            setAdding(true)
          }}
          icon={<PlusIcon />}
          tone="play"
        >
          Add a camera
        </Button>
        <span className="text-ink-500 text-xs">
          {checking
            ? "Asking each camera for its manifest…"
            : checkedAt
              ? `Signal checked ${agoLabel(checkedAt, now)}`
              : "Signal not checked yet"}
        </span>
        {counts.needAttention > 0 && (
          <Badge tone="danger" dot>
            {counts.needAttention} need{counts.needAttention === 1 ? "s" : ""} a person
          </Badge>
        )}
      </div>

      <div className="mt-4">
        {notice && <NoticeStrip>{notice}</NoticeStrip>}
        {loadError && <ErrorStrip>{loadError}</ErrorStrip>}
        {actionError && <ErrorStrip>{actionError}</ErrorStrip>}
        {checkError && <ErrorStrip>{checkError}</ErrorStrip>}
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} size="sm">
              <div className="bg-ink-100 aspect-video w-full animate-pulse rounded-xl" />
              <div className="bg-ink-100 mt-3 h-4 w-1/2 animate-pulse rounded" />
              <div className="bg-ink-50 mt-2 h-3 w-2/3 animate-pulse rounded" />
              <div className="bg-ink-50 mt-4 h-12 w-full animate-pulse rounded-xl" />
            </Card>
          ))}
        </div>
      )}

      {!loading && channels?.length === 0 && (
        <Card className="text-center">
          <h2 className="font-display text-ink-950 text-lg font-bold">No cameras yet</h2>
          <p className="text-ink-600 mx-auto mt-2 max-w-md text-sm leading-6">
            A camera here is one physical rig and the fixed addresses it streams on. We can create
            it for you at Cloudflare and hand you the two things to type into the camera app, or you
            can paste in a stream you already have. Then place it at the court it is pointing at and
            today&apos;s games there pick it up on their own.
          </p>
          <div className="mt-4">
            <Button
              onClick={() => {
                setFormError(null)
                setAdding(true)
              }}
              icon={<PlusIcon />}
              tone="play"
            >
              Add the first camera
            </Button>
          </div>
        </Card>
      )}

      {!loading && !!channels?.length && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              schedule={scheduleByChannel.get(channel.id)}
              health={health[channel.id]}
              placedByName={overview?.placedBy?.[channel.id]}
              sharingWith={sharingByChannel.get(channel.id) ?? []}
              now={now}
              busy={busyId === channel.id || saving}
              checking={checking || checkingId === channel.id}
              onCheckSignal={() => void checkSignal(channel.id)}
              onMove={() => {
                setMoveError(null)
                setMoving(channel)
              }}
              onEdit={() => {
                setFormError(null)
                setEditing(channel)
              }}
              onToggleStatus={() => void toggleStatus(channel)}
            />
          ))}
        </div>
      )}

      {/* Placement history */}
      {!loading && (
        <div className="mt-8">
          <h2 className="font-display text-ink-950 text-lg font-bold">Recent moves</h2>
          <p className="text-ink-600 mt-1 text-sm">
            Who put which camera where, and who took one off a live game.
          </p>
          <Card size="sm" className="mt-3">
            {overview?.audit?.length ? (
              <ol className="divide-ink-100 divide-y">
                {overview.audit.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                    {entry.action === "STREAM_TAKEOVER" ? (
                      <Badge tone="danger">Take-over</Badge>
                    ) : entry.action === "STREAM_CHANNEL_PLACE" ? (
                      <Badge tone="play">Placed</Badge>
                    ) : (
                      <Badge tone="neutral">Camera</Badge>
                    )}
                    <span className="text-ink-800 text-sm">{entry.summary}</span>
                    <span className="text-ink-500 text-xs">
                      {entry.actorName} · {agoLabel(entry.createdAt, now)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-ink-600 py-4 text-center text-sm">
                Nothing yet. The first time a camera is placed at a court, it shows up here with the
                name of whoever confirmed it.
              </p>
            )}
          </Card>
        </div>
      )}

      {moving && (
        <PlacementDialog
          channel={moving}
          venues={overview?.venues ?? []}
          busy={busyId === moving.id}
          error={moveError}
          onCancel={() => {
            setMoving(null)
            setMoveError(null)
          }}
          onPlace={(target) => void place(moving, target, false)}
        />
      )}

      {takeover && (
        <TakeoverDialog
          channel={takeover.channel}
          target={takeover.target}
          conflict={takeover.conflict}
          busy={busyId === takeover.channel.id}
          error={actionError}
          onCancel={() => {
            setTakeover(null)
            setActionError(null)
          }}
          onConfirm={() => void place(takeover.channel, takeover.target, true)}
        />
      )}

      {handoff && (
        <ChannelHandoffDialog channel={handoff} provisioned onClose={() => setHandoff(null)} />
      )}

      {(adding || editing) && (
        <ChannelFormDialog
          channel={editing}
          providers={providers}
          busy={saving}
          error={formError}
          onCancel={() => {
            setAdding(false)
            setEditing(null)
            setFormError(null)
          }}
          onSave={(draft) => void saveChannel(draft, editing)}
        />
      )}
    </div>
  )
}
