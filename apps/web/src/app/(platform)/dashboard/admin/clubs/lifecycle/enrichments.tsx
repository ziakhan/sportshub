"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge, Button, Card, type BadgeTone } from "@/components/ui"
import { ClubQuickView } from "./club-quick-view"

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
    region: string | null
    status: string
    publishedAt: string | null
    mergedIntoId: string | null
  }
  pending: number
  oldestPending: string | null
  rows: EnrichmentRow[]
}

interface PlaceOption {
  value: string
  count: number
}

interface Payload {
  clubs: ClubGroup[]
  pendingRows: number
  pendingClubs: number
  shownRows: number
  truncated: boolean
  includeReviewed: boolean
  provinces: PlaceOption[]
  regions: PlaceOption[]
  cities: PlaceOption[]
}

/** Matches the API's "(no region)" sentinel. */
const NONE = "__none__"

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
  if (source.startsWith("verified")) return { key: "verified-scrape", tone: "court", label: "re-checked" }
  if (source.startsWith("edits")) return { key: "edits", tone: "gold", label: "developer sheet" }
  if (source.startsWith("dead-site")) return { key: "dead-site-clear", tone: "hoop", label: "dead site" }
  if (source.startsWith("seed-adoption")) return { key: "seed-adoption-fix", tone: "neutral", label: "seed fix" }
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

/** Values that can be checked with one click open as links, old and new both:
 *  a dead-site clear is only checkable by visiting the OLD address. */
function valueHref(field: string, value: string): string | null {
  if (field === "website") return /^https?:\/\//i.test(value) ? value : `https://${value}`
  if (field === "contactEmail") return `mailto:${value}`
  if (field === "phoneNumber") return `tel:${value.replace(/[^\d+]/g, "")}`
  return null
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


export function MachineEditsQueue({
  onPendingChange,
  onOpenClub,
}: {
  /** Keeps the tab badge in the console honest after every action. */
  onPendingChange?: (pending: number) => void
  /** Jumps to the Clubs tab with this club searched and its edit form open. */
  onOpenClub?: (club: { id: string; name: string }) => void
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
  const [query, setQuery] = useState("")
  /** Place filters, applied server side, so GTA can be worked as its own pass. */
  const [province, setProvince] = useState("")
  const [region, setRegion] = useState("")
  const [city, setCity] = useState("")
  /** The one row asking "are you sure" right now. */
  const [confirming, setConfirming] = useState<string | null>(null)
  /** The "keep everything shown" button asking "are you sure". */
  const [bulkConfirming, setBulkConfirming] = useState(false)
  /** The club open in the quick-view dialog, so review never loses its place. */
  const [quickViewId, setQuickViewId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams()
      if (showAll) p.set("all", "1")
      if (province) p.set("province", province)
      if (region) p.set("region", region)
      if (city) p.set("city", city)
      const qs = p.toString()
      const res = await fetch(`/api/admin/clubs/enrichments${qs ? `?${qs}` : ""}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to load")
      setData(json)
      onPendingChange?.(json.pendingRows)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [showAll, province, region, city, onPendingChange])

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

  // A changed upstream place filter can strand a narrower one; drop what no
  // longer exists in the options.
  useEffect(() => {
    if (!data) return
    if (province && !data.provinces.some((o) => o.value === province)) setProvince("")
    if (region && !data.regions.some((o) => o.value === region)) setRegion("")
    if (city && !data.cities.some((o) => o.value === city)) setCity("")
  }, [data, province, region, city])

  const visibleClubs = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = clubs
    if (q) {
      list = list.filter(
        (g) =>
          g.club.name.toLowerCase().includes(q) ||
          g.club.slug.toLowerCase().includes(q) ||
          (g.club.city ?? "").toLowerCase().includes(q)
      )
    }
    if (!sourceFilter) return list
    return list
      .map((g) => ({ ...g, rows: g.rows.filter((r) => sourceKind(r.source).key === sourceFilter) }))
      .filter((g) => g.rows.length > 0)
  }, [clubs, sourceFilter, query])

  /** Everything pending in the current view, for the one-click sweep. */
  const shownPendingIds = useMemo(
    () => visibleClubs.flatMap((g) => g.rows.filter((r) => !r.reviewedAt).map((r) => r.id)),
    [visibleClubs]
  )

  return (
    <div>
      {quickViewId && (
        <ClubQuickView
          clubId={quickViewId}
          onOpenFull={onOpenClub}
          onChanged={() => void load()}
          onClose={() => setQuickViewId(null)}
        />
      )}
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
            Each line below is one value a script wrote to a club. Look at it, then either{" "}
            <span className="text-ink-900 font-semibold">Keep</span> it or{" "}
            <span className="text-ink-900 font-semibold">Put back</span> the old value.
            Every click saves itself right away: there is no save button and nothing else to
            submit.
          </p>
          <div className="border-ink-200 bg-ink-50 inline-flex shrink-0 rounded-full border p-1">
            {[
              { key: false, label: "Needs review" },
              { key: true, label: "Everything" },
            ].map((t) => (
              <button
                key={String(t.key)}
                onClick={() => setShowAll(t.key)}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition ${
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

        <div className="border-ink-100 mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a club by name"
            className="border-ink-200 text-ink-900 placeholder:text-ink-400 focus:border-ink-400 min-w-[180px] flex-1 rounded-lg border bg-white px-3 py-2 text-sm outline-none"
          />
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            aria-label="Province"
            className="border-ink-200 text-ink-900 cursor-pointer rounded-lg border bg-white px-3 py-2 text-sm outline-none"
          >
            <option value="">All provinces</option>
            {(data?.provinces ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </select>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            aria-label="Region"
            className="border-ink-200 text-ink-900 max-w-[220px] cursor-pointer rounded-lg border bg-white px-3 py-2 text-sm outline-none"
          >
            <option value="">All regions</option>
            {(data?.regions ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.value === NONE ? "No region set" : o.value} ({o.count})
              </option>
            ))}
          </select>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label="City"
            className="border-ink-200 text-ink-900 max-w-[200px] cursor-pointer rounded-lg border bg-white px-3 py-2 text-sm outline-none"
          >
            <option value="">All cities</option>
            {(data?.cities ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.value} ({o.count})
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <span className="text-ink-500 text-xs font-semibold">Show</span>
            <select
              value={sourceFilter ?? ""}
              onChange={(e) => setSourceFilter(e.target.value || null)}
              className="border-ink-200 text-ink-900 cursor-pointer rounded-lg border bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="">
                Every run ({legend.reduce((n, [, m]) => n + m.count, 0)})
              </option>
              {legend.map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label} ({meta.count})
                </option>
              ))}
            </select>
          </label>
          {shownPendingIds.length > 1 &&
            (bulkConfirming ? (
              <span className="flex items-center gap-1.5">
                <span className="text-ink-600 text-xs">
                  Keep all {shownPendingIds.length} edits shown?
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  tone="court"
                  disabled={busy}
                  onClick={() => {
                    setBulkConfirming(false)
                    void act({ action: "approve", ids: shownPendingIds }, (r) =>
                      `Kept ${r.count} ${r.count === 1 ? "edit" : "edits"}`
                    )
                  }}
                >
                  Yes, keep them
                </Button>
                <Button size="sm" variant="subtle" onClick={() => setBulkConfirming(false)}>
                  Cancel
                </Button>
              </span>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                tone="ink"
                disabled={busy}
                onClick={() => setBulkConfirming(true)}
              >
                Keep all shown ({shownPendingIds.length})
              </Button>
            ))}
        </div>

        <p className="text-ink-500 mt-2 text-xs leading-5">
          {sourceFilter
            ? (SOURCE_MEANING[sourceFilter] ?? "Written by an automated run.") + " "
            : ""}
          Showing {visibleClubs.length} {visibleClubs.length === 1 ? "club" : "clubs"} ·{" "}
          {shownPendingIds.length} still to check
          {sourceFilter || query || province || region || city ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => {
                  setSourceFilter(null)
                  setQuery("")
                  setProvince("")
                  setRegion("")
                  setCity("")
                }}
                className="text-play-600 cursor-pointer underline"
              >
                clear filters
              </button>
            </>
          ) : null}
        </p>
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
              {clubs.length === 0
                ? "The queue is clear."
                : query.trim()
                  ? `No club matching "${query.trim()}" here.`
                  : "Nothing from that run in view."}
            </p>
            <p className="text-ink-500 mt-1 text-sm">
              {clubs.length === 0 ? (
                showAll ? (
                  "No script has written to a club yet."
                ) : (
                  "Every machine edit has been looked at."
                )
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("")
                    setSourceFilter(null)
                    setProvince("")
                    setRegion("")
                    setCity("")
                  }}
                  className="text-play-600 cursor-pointer underline"
                >
                  Clear the search and filters
                </button>
              )}
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
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-950 text-base font-semibold">
                      {group.club.name}
                    </span>
                    {group.club.mergedIntoId ? (
                      <Badge tone="neutral">merged</Badge>
                    ) : group.club.publishedAt ? (
                      <Badge tone="success">published</Badge>
                    ) : (
                      <Badge tone="warning">draft</Badge>
                    )}
                  </div>
                  <div className="text-ink-500 mt-0.5 text-xs">
                    {group.club.city && `${group.club.city}`}
                    {group.club.state && `, ${group.club.state}`}
                    {group.club.region && ` · ${group.club.region}`}
                    {(group.club.city || group.club.state || group.club.region) && " · "}
                    {waiting > 0
                      ? `${waiting} waiting`
                      : `${group.rows.length} already looked at`}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {pendingIds.length > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      tone="court"
                      disabled={busy}
                      onClick={() =>
                        act({ action: "approve", ids: pendingIds }, (r) =>
                          `Kept ${r.count} ${r.count === 1 ? "edit" : "edits"} on ${group.club.name}`
                        )
                      }
                    >
                      Keep all {pendingIds.length}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    tone="ink"
                    onClick={() => setQuickViewId(group.club.id)}
                  >
                    Open club
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] table-fixed text-sm">
                  <colgroup>
                    <col className="w-24" />
                    <col />
                    <col />
                    <col className="w-44" />
                    <col className="w-44" />
                  </colgroup>
                  <thead>
                    <tr className="text-ink-400 text-left text-[11px] uppercase tracking-wide">
                      <th className="border-ink-100 border-b py-1.5 pr-3 font-semibold">Field</th>
                      <th className="border-ink-100 border-b py-1.5 pr-3 font-semibold">Was</th>
                      <th className="border-ink-100 border-b py-1.5 pr-3 font-semibold">Now</th>
                      <th className="border-ink-100 border-b py-1.5 pr-3 font-semibold">Run</th>
                      <th className="border-ink-100 border-b py-1.5 font-semibold">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => {
                      const kind = sourceKind(row.source)
                      const hint = row.reviewedAt ? null : checkHint(row)
                      const isConfirming = confirming === row.id
                      const byline = `${shortDate(row.appliedAt)} by ${row.appliedBy}${
                        row.confidence ? `, ${row.confidence} confidence` : ""
                      }${row.source.includes("backfilled") ? ", flagged after the fact" : ""}`
                      const fromHref = row.fromValue ? valueHref(row.field, row.fromValue) : null
                      const toHref = row.toValue ? valueHref(row.field, row.toValue) : null
                      const isCoord = row.field === "latitude" || row.field === "longitude"
                      const lat = isCoord
                        ? row.field === "latitude"
                          ? row.toValue
                          : group.rows.find((x) => x.field === "latitude")?.toValue
                        : null
                      const lng = isCoord
                        ? row.field === "longitude"
                          ? row.toValue
                          : group.rows.find((x) => x.field === "longitude")?.toValue
                        : null
                      const mapHref = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null
                      return (
                        <tr
                          key={row.id}
                          className={`border-ink-100 border-b last:border-b-0 ${
                            row.reviewedAt ? "opacity-60" : ""
                          }`}
                        >
                          <td className="py-2.5 pr-3 align-middle">
                            <span className="text-ink-900 font-semibold">
                              {fieldLabel(row.field)}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 align-middle">
                            {row.fromValue ? (
                              fromHref ? (
                                <a
                                  href={fromHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-ink-400 hover:text-ink-600 block cursor-pointer truncate line-through"
                                  title={`${row.fromValue} (opens the old address)`}
                                >
                                  {row.fromValue}
                                </a>
                              ) : (
                                <div
                                  className="text-ink-400 truncate line-through"
                                  title={row.fromValue}
                                >
                                  {row.fromValue}
                                </div>
                              )
                            ) : (
                              <span className="text-ink-400 italic">empty</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 align-middle">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {row.toValue ? (
                                toHref ? (
                                  <a
                                    href={toHref}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-ink-900 decoration-ink-300 hover:decoration-ink-600 min-w-0 truncate font-medium underline underline-offset-2"
                                    title={row.toValue}
                                  >
                                    {row.toValue}
                                  </a>
                                ) : (
                                  <span
                                    className="text-ink-900 min-w-0 truncate font-medium"
                                    title={row.toValue}
                                  >
                                    {row.toValue}
                                  </span>
                                )
                              ) : (
                                <span className="text-ink-500 italic">cleared</span>
                              )}
                              {mapHref && (
                                <a
                                  href={mapHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-play-600 shrink-0 text-xs underline"
                                  title="Opens this pin on a map"
                                >
                                  map
                                </a>
                              )}
                              {hint && (
                                <span title={hint} className="shrink-0 cursor-help text-amber-500">
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="h-3.5 w-3.5"
                                    fill="currentColor"
                                    aria-hidden
                                  >
                                    <path d="M12 2 1 21h22L12 2Zm1 14h-2v2h2v-2Zm0-7h-2v5h2V9Z" />
                                  </svg>
                                  <span className="sr-only">{hint}</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 align-middle">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span title={byline} className="min-w-0 truncate">
                                <Badge tone={kind.tone} className="whitespace-nowrap">
                                  {kind.label}
                                </Badge>
                              </span>
                              {row.sourceUrl && (
                                <a
                                  href={row.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-play-600 shrink-0 text-xs underline"
                                >
                                  source
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 align-middle">
                            <div className="flex items-center justify-end gap-1.5">
                              {row.reviewedAt && !isConfirming ? (
                                <>
                                  <span
                                    className={`text-xs ${row.reverted ? "text-amber-700" : "text-emerald-700"}`}
                                    title={row.reviewedBy ? `by ${row.reviewedBy}` : undefined}
                                  >
                                    {row.reverted ? "put back" : "kept"}{" "}
                                    {shortDate(row.reviewedAt)}
                                  </span>
                                  {!row.reverted && row.revertable && (
                                    <Button
                                      size="sm"
                                      variant="subtle"
                                      disabled={busy}
                                      onClick={() => setConfirming(row.id)}
                                    >
                                      Put back
                                    </Button>
                                  )}
                                </>
                              ) : isConfirming ? (
                                <>
                                  <span className="text-ink-600 text-xs">Put back?</span>
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
                                    Yes
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="subtle"
                                    onClick={() => setConfirming(null)}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
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
                                    Keep
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="subtle"
                                    disabled={busy || !row.revertable}
                                    title={
                                      row.revertable
                                        ? undefined
                                        : "This field has to be changed by hand from Edit club"
                                    }
                                    onClick={() => setConfirming(row.id)}
                                  >
                                    Put back
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
