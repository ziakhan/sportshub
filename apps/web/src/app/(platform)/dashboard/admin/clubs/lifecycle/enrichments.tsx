"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge, Button, Card, type BadgeTone } from "@/components/ui"

/**
 * Machine edits queue (client half of the club review console).
 *
 * Owner order 2026-08-20: when a script changes a club, a person has to be
 * told what was fetched, from where, what it replaced, and what is worth
 * checking. Each row here is one field one pipeline wrote. The admin keeps it
 * or puts the old value back, and either way the row leaves the queue.
 *
 * Same idiom as the club table next door: plain Cards, ink rules, Badge tones,
 * design-system Buttons. No new component vocabulary for one admin screen.
 */

interface EnrichmentRow {
  id: string
  field: string
  fromValue: string | null
  toValue: string | null
  source: string
  sourceUrl: string | null
  confidence: string | null
  appliedAt: string
  appliedBy: string
  reviewedAt: string | null
  reviewedBy: string | null
  reverted: boolean
  revertable: boolean
}

interface ClubGroup {
  club: {
    id: string
    slug: string
    name: string
    city: string | null
    state: string | null
    status: string
    publishedAt: string | null
    mergedIntoId: string | null
  }
  pending: number
  oldestPending: string | null
  rows: EnrichmentRow[]
}

interface Payload {
  clubs: ClubGroup[]
  pendingRows: number
  pendingClubs: number
  shownRows: number
  truncated: boolean
  includeReviewed: boolean
}

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  shortName: "Short name",
  description: "Description",
  website: "Website",
  contactEmail: "Email",
  phoneNumber: "Phone",
  address: "Address",
  city: "City",
  state: "Province",
  region: "Region",
  postalCode: "Postal code",
  zipCode: "Postal code",
  latitude: "Latitude",
  longitude: "Longitude",
  status: "Status",
  publishedAt: "Published",
  placeId: "Place id",
  geoSource: "Geo source",
  geoPrecision: "Geo precision",
  searchAliases: "Also known as",
  dataSources: "Data sources",
  dataNotes: "Notes",
}

function fieldLabel(field: string) {
  return (
    FIELD_LABELS[field] ??
    field.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())
  )
}

/** The kind of run a row came from, with its chip colour and display name.
 *  Attribution matters (owner 2026-08-20): rows that trace back to the other
 *  developer's sheets say so on the chip, not just in the raw source string. */
function sourceKind(source: string): { key: string; tone: BadgeTone; label: string } {
  if (source.startsWith("discovered")) return { key: "discovered", tone: "play", label: "AI search" }
  if (source.startsWith("verified")) return { key: "verified-scrape", tone: "court", label: "developer sheet, re-checked" }
  if (source.startsWith("edits")) return { key: "edits", tone: "gold", label: "developer sheet" }
  if (source.startsWith("dead-site")) return { key: "dead-site-clear", tone: "hoop", label: "dead site cleared" }
  if (source.startsWith("seed-adoption")) return { key: "seed-adoption-fix", tone: "neutral", label: "seed adoption fix" }
  return { key: source, tone: "neutral", label: source }
}

/** What each kind of run actually did, for the legend. */
const SOURCE_MEANING: Record<string, string> = {
  discovered: "An AI search run found this. The link is the page it was found on.",
  "verified-scrape": "From the developer's contact sheet, re-confirmed on the club's own website before it was written.",
  edits: "From the developer's hand-checked corrections sheet.",
  "dead-site-clear": "On the developer's dead-sites list, re-checked by us: the old website did not answer, so the link was cleared.",
  "seed-adoption-fix": "A seeded demo record was matched onto this club.",
}

const CONFIDENCE_TONE: Record<string, BadgeTone> = {
  high: "court",
  medium: "gold",
  low: "warning",
}

/** Only said out loud where the value really can be wrong. */
function checkHint(row: EnrichmentRow): string | null {
  const kind = sourceKind(row.source).key
  if (kind === "discovered" && row.confidence !== "high") {
    return "Search found this, so check the link really is this club and not one with a similar name."
  }
  if (kind === "dead-site-clear") {
    return "Check the old address is really gone before you agree to clear it."
  }
  if (kind === "seed-adoption-fix") {
    return "Check the demo record belongs to this club."
  }
  return null
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Long values (a description, a note) get cut so a row stays one glance. */
function clip(value: string, max = 140) {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

export function MachineEditsQueue({
  onPendingChange,
}: {
  /** Keeps the tab badge in the console honest after every action. */
  onPendingChange?: (pending: number) => void
}) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showAll, setShowAll] = useState(false)
  /** One source kind at a time, so the developer-sheet rows and the AI-search
   *  rows can each be reviewed as their own pass. null = everything. */
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  /** The one row asking "are you sure" right now. */
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/clubs/enrichments${showAll ? "?all=1" : ""}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to load")
      setData(json)
      onPendingChange?.(json.pendingRows)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [showAll, onPendingChange])

  useEffect(() => {
    void load()
  }, [load])

  async function act(body: unknown, describe: (r: any) => string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch("/api/admin/clubs/enrichments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Action failed")
      setNotice(describe(json))
      setConfirming(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(false)
    }
  }

  const clubs = data?.clubs ?? []

  /** The chip meanings actually on screen, with counts, so the legend never
   *  lists ghosts and each chip doubles as a filter. */
  const legend = useMemo(() => {
    const seen = new Map<string, { tone: BadgeTone; label: string; count: number }>()
    for (const g of clubs) {
      for (const r of g.rows) {
        const { key, tone, label } = sourceKind(r.source)
        const cur = seen.get(key)
        if (cur) cur.count += 1
        else seen.set(key, { tone, label, count: 1 })
      }
    }
    return [...seen.entries()]
  }, [clubs])

  // A reload can retire the filtered kind entirely; fall back to everything.
  useEffect(() => {
    if (sourceFilter && !legend.some(([key]) => key === sourceFilter)) {
      setSourceFilter(null)
    }
  }, [legend, sourceFilter])

  const visibleClubs = useMemo(() => {
    if (!sourceFilter) return clubs
    return clubs
      .map((g) => ({ ...g, rows: g.rows.filter((r) => sourceKind(r.source).key === sourceFilter) }))
      .filter((g) => g.rows.length > 0)
  }, [clubs, sourceFilter])

  return (
    <div>
      {notice && (
        <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <Card size="sm" className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="text-ink-600 max-w-2xl text-sm leading-6">
            Every value an automated run wrote to a club waits here, including what came in
            from the developer&apos;s sheets. Each line says what was changed, where it was
            fetched from and when. Keep it, or put the old value back. Click a chip below to
            review one kind of run at a time.
          </p>
          <div className="border-ink-200 bg-ink-50 inline-flex shrink-0 rounded-full border p-1">
            {[
              { key: false, label: "Needs review" },
              { key: true, label: "Everything" },
            ].map((t) => (
              <button
                key={String(t.key)}
                onClick={() => setShowAll(t.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  showAll === t.key
                    ? "shadow-soft text-ink-900 bg-white"
                    : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {legend.length > 0 && (
          <div className="border-ink-100 mt-3 grid gap-x-8 gap-y-2 border-t pt-3 sm:grid-cols-2">
            {legend.map(([key, meta]) => {
              const active = sourceFilter === key
              const dimmed = sourceFilter !== null && !active
              return (
                <div key={key} className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSourceFilter(active ? null : key)}
                    className={`min-w-[190px] shrink-0 cursor-pointer rounded-full text-left transition ${
                      dimmed ? "opacity-40 hover:opacity-70" : ""
                    }`}
                  >
                    <Badge
                      tone={meta.tone}
                      className={`whitespace-nowrap ${active ? "ring-ink-400 ring-2 ring-offset-1" : ""}`}
                    >
                      {meta.label} · {meta.count}
                    </Badge>
                  </button>
                  <span className="text-ink-500 text-xs leading-5">
                    {SOURCE_MEANING[key] ?? "Written by an automated run."}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {sourceFilter && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-ink-600 text-xs">
              Showing only: {legend.find(([key]) => key === sourceFilter)?.[1].label}
            </span>
            <button
              type="button"
              onClick={() => setSourceFilter(null)}
              className="text-play-600 cursor-pointer text-xs underline"
            >
              show every run
            </button>
          </div>
        )}
      </Card>

      {loading && (
        <Card size="sm">
          <p className="text-ink-500 py-6 text-center text-sm">Loading…</p>
        </Card>
      )}

      {!loading && visibleClubs.length === 0 && (
        <Card size="sm">
          <div className="bg-ink-50/70 rounded-xl px-4 py-10 text-center">
            <p className="text-ink-900 text-sm font-semibold">
              {clubs.length > 0 ? "Nothing from that run in view." : "The queue is clear."}
            </p>
            <p className="text-ink-500 mt-1 text-sm">
              {clubs.length > 0
                ? "Pick another chip, or show every run."
                : showAll
                  ? "No script has written to a club yet."
                  : "Every machine edit has been looked at."}
            </p>
          </div>
        </Card>
      )}

      {data?.truncated && (
        <p className="text-ink-500 mb-3 text-xs">
          Showing the {data.shownRows} most recent edits of {data.pendingRows} waiting. Work
          through these and the rest will follow.
        </p>
      )}

      <div className="space-y-3">
        {visibleClubs.map((group) => {
          const pendingIds = group.rows.filter((r) => !r.reviewedAt).map((r) => r.id)
          // Under a source filter the card only holds that run's rows, so the
          // waiting count follows what is actually on screen.
          const waiting = sourceFilter ? pendingIds.length : group.pending
          return (
            <Card key={group.club.id} size="sm">
              <div className="border-ink-100 flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/club/${group.club.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink-950 text-base font-semibold hover:underline"
                    >
                      {group.club.name}
                    </a>
                    {group.club.mergedIntoId ? (
                      <Badge tone="neutral">merged</Badge>
                    ) : group.club.publishedAt ? (
                      <Badge tone="success">published</Badge>
                    ) : (
                      <Badge tone="warning">draft</Badge>
                    )}
                  </div>
                  <div className="text-ink-500 mt-0.5 text-xs">
                    {group.club.slug}
                    {group.club.city && ` · ${group.club.city}`}
                    {group.club.state && `, ${group.club.state}`}
                    {" · "}
                    {waiting > 0
                      ? `${waiting} waiting`
                      : `${group.rows.length} already looked at`}
                  </div>
                </div>
                {pendingIds.length > 1 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    tone="ink"
                    disabled={busy}
                    onClick={() =>
                      act({ action: "approve", ids: pendingIds }, (r) =>
                        `Kept ${r.count} ${r.count === 1 ? "edit" : "edits"} on ${group.club.name}`
                      )
                    }
                  >
                    Looks right for all {pendingIds.length}
                  </Button>
                )}
              </div>

              <ul className="divide-ink-100 divide-y">
                {group.rows.map((row) => {
                  const kind = sourceKind(row.source)
                  const hint = row.reviewedAt ? null : checkHint(row)
                  const isConfirming = confirming === row.id
                  return (
                    <li
                      key={row.id}
                      className={`flex flex-wrap items-start justify-between gap-3 py-3 ${
                        row.reviewedAt ? "opacity-70" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-ink-900 text-sm font-semibold">
                            {fieldLabel(row.field)}
                          </span>
                          <Badge tone={kind.tone}>{kind.label}</Badge>
                          {row.source.includes("backfilled") && (
                            <Badge tone="neutral">flagged after the fact</Badge>
                          )}
                          {row.confidence && (
                            <Badge tone={CONFIDENCE_TONE[row.confidence] ?? "neutral"}>
                              {row.confidence} confidence
                            </Badge>
                          )}
                          {row.reverted && <Badge tone="danger">put back</Badge>}
                          {row.reviewedAt && !row.reverted && <Badge tone="court">kept</Badge>}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-baseline gap-2 text-sm">
                          {row.fromValue ? (
                            <span className="text-ink-400 break-all line-through">
                              {clip(row.fromValue)}
                            </span>
                          ) : (
                            <span className="text-ink-400 italic">was empty</span>
                          )}
                          <span className="text-ink-300" aria-hidden>
                            →
                          </span>
                          <span className="text-ink-900 break-all font-medium">
                            {row.toValue ? clip(row.toValue) : <span className="italic">cleared</span>}
                          </span>
                        </div>

                        <div className="text-ink-500 mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                          <span>
                            {shortDate(row.appliedAt)} by {row.appliedBy}
                          </span>
                          {row.sourceUrl && (
                            <>
                              <span aria-hidden>·</span>
                              <a
                                href={row.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-play-600 underline"
                              >
                                view source
                              </a>
                            </>
                          )}
                          {row.reviewedAt && (
                            <>
                              <span aria-hidden>·</span>
                              <span>
                                {row.reverted ? "put back" : "kept"} {shortDate(row.reviewedAt)}
                                {row.reviewedBy ? ` by ${row.reviewedBy}` : ""}
                              </span>
                            </>
                          )}
                        </div>

                        {hint && (
                          <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs leading-5 text-amber-800">
                            {hint}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {isConfirming ? (
                          <>
                            <span className="text-ink-600 mr-1 text-xs">
                              Put the old value back?
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              tone="hoop"
                              disabled={busy}
                              onClick={() =>
                                act({ action: "revert", id: row.id }, () =>
                                  `${fieldLabel(row.field)} on ${group.club.name} is back to what it was`
                                )
                              }
                            >
                              Yes, revert
                            </Button>
                            <Button
                              size="sm"
                              variant="subtle"
                              onClick={() => setConfirming(null)}
                            >
                              Keep it
                            </Button>
                          </>
                        ) : (
                          <>
                            {!row.reviewedAt && (
                              <Button
                                size="sm"
                                variant="secondary"
                                tone="court"
                                disabled={busy}
                                onClick={() =>
                                  act({ action: "approve", ids: [row.id] }, () =>
                                    `Kept the ${fieldLabel(row.field).toLowerCase()} on ${group.club.name}`
                                  )
                                }
                              >
                                Looks right
                              </Button>
                            )}
                            {!row.reverted && (
                              <Button
                                size="sm"
                                variant="subtle"
                                disabled={busy || !row.revertable}
                                title={
                                  row.revertable
                                    ? undefined
                                    : "This field has to be changed by hand in Club review"
                                }
                                onClick={() => setConfirming(row.id)}
                              >
                                Revert
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
