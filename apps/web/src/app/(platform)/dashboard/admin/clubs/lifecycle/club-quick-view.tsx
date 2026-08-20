"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Badge, Button } from "@/components/ui"

/**
 * Club quick view (owner 2026-08-20): a dialog over the machine-edits queue so
 * reviewing never loses its place. The whole club record in one glance, with
 * every value interactive (website opens, email mails, phone dials, the pin
 * opens a map beside a name search so the two can be compared), where each
 * value came from, how complete the record is, this club's pending machine
 * edits, and in-place editing with an explicit Save. Closing lands the admin
 * exactly where they were in the worksheet.
 */

interface QueueRow {
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

interface FullClub {
  id: string
  slug: string
  name: string
  shortName: string | null
  city: string | null
  state: string | null
  region: string | null
  status: string
  publishedAt: string | null
  mergedIntoId: string | null
  isDemo: boolean
  contactEmail: string | null
  phoneNumber: string | null
  website: string | null
  address: string | null
  postalCode: string | null
  latitude: number | null
  longitude: number | null
  geoSource: string | null
  geoPrecision: string | null
  dataSources: string | null
  dataNotes: string | null
  searchAliases: string | null
  description: string | null
  createdAt: string
  _count: { teams: number; clubClaims: number }
}

/** The record slots that count toward "how complete is this club". */
const COMPLETENESS: { key: string; label: string; filled: (c: FullClub) => boolean }[] = [
  { key: "website", label: "Website", filled: (c) => !!c.website },
  { key: "contactEmail", label: "Email", filled: (c) => !!c.contactEmail },
  { key: "phoneNumber", label: "Phone", filled: (c) => !!c.phoneNumber },
  { key: "city", label: "City", filled: (c) => !!c.city },
  { key: "state", label: "Province", filled: (c) => !!c.state },
  { key: "region", label: "Region", filled: (c) => !!c.region },
  { key: "address", label: "Address", filled: (c) => !!c.address },
  { key: "location", label: "Map pin", filled: (c) => c.latitude != null && c.longitude != null },
  { key: "description", label: "Description", filled: (c) => !!c.description },
]

const EDIT_FIELDS: { key: string; label: string; placeholder?: string }[] = [
  { key: "name", label: "Name" },
  { key: "city", label: "City" },
  { key: "state", label: "Province", placeholder: "ON" },
  { key: "region", label: "Region" },
  { key: "contactEmail", label: "Email" },
  { key: "phoneNumber", label: "Phone" },
  { key: "website", label: "Website", placeholder: "https://" },
  { key: "address", label: "Address" },
]

function hrefFor(field: string, value: string): string | null {
  if (field === "website") return /^https?:\/\//i.test(value) ? value : `https://${value}`
  if (field === "contactEmail") return `mailto:${value}`
  if (field === "phoneNumber") return `tel:${value.replace(/[^\d+]/g, "")}`
  return null
}

function sourceChip(source: string): { label: string; tone: "play" | "court" | "gold" | "hoop" | "neutral" } {
  if (source.startsWith("discovered")) return { label: "AI search", tone: "play" }
  if (source.startsWith("verified")) return { label: "re-checked", tone: "court" }
  if (source.startsWith("edits")) return { label: "developer sheet", tone: "gold" }
  if (source.startsWith("dead-site")) return { label: "dead site", tone: "hoop" }
  if (source.startsWith("seed-adoption")) return { label: "seed fix", tone: "neutral" }
  return { label: source, tone: "neutral" }
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" })
}

const FIELD_LABELS: Record<string, string> = {
  website: "Website",
  contactEmail: "Email",
  phoneNumber: "Phone",
  latitude: "Latitude",
  longitude: "Longitude",
  status: "Status",
  city: "City",
  state: "Province",
  region: "Region",
  address: "Address",
}
const fieldLabel = (f: string) =>
  FIELD_LABELS[f] ?? f.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())

export function ClubQuickView({
  clubId,
  rows,
  busy,
  onQueueAction,
  onOpenFull,
  onChanged,
  onClose,
}: {
  clubId: string
  /** This club's machine-edit rows, straight from the queue's live data. */
  rows: QueueRow[]
  busy: boolean
  /** The queue's act(): approve/revert with the same payloads and refresh. */
  onQueueAction: (body: unknown, describe: (r: unknown & { count?: number }) => string) => Promise<void>
  /** Optional escape hatch to the full Clubs tab (merge tools live there). */
  onOpenFull?: (club: { id: string; name: string }) => void
  /** Fired after a save or publish so the queue refreshes its club headers. */
  onChanged?: () => void
  onClose: () => void
}) {
  const [club, setClub] = useState<FullClub | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [confirmingRow, setConfirmingRow] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/clubs/lifecycle?id=${encodeURIComponent(clubId)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to load the club")
      const c = (json.clubs ?? [])[0] ?? null
      if (!c) throw new Error("This club could not be found")
      setClub(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the club")
    } finally {
      setLoading(false)
    }
  }, [clubId])

  useEffect(() => {
    void load()
  }, [load])

  // Escape closes; the page behind must not scroll while the dialog is up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  /** Latest machine edit per field, for the "where this came from" line. */
  const provenance = useMemo(() => {
    const byField = new Map<string, QueueRow>()
    for (const r of rows) {
      const seen = byField.get(r.field)
      if (!seen || r.appliedAt > seen.appliedAt) byField.set(r.field, r)
    }
    return byField
  }, [rows])

  const pendingRows = rows.filter((r) => !r.reviewedAt)
  const filled = club ? COMPLETENESS.filter((f) => f.filled(club)) : []
  const missing = club ? COMPLETENESS.filter((f) => !f.filled(club)) : []

  function startEditing() {
    if (!club) return
    setDraft(
      Object.fromEntries(
        EDIT_FIELDS.map((f) => [f.key, ((club as unknown as Record<string, unknown>)[f.key] as string | null) ?? ""])
      )
    )
    setEditing(true)
  }

  async function saveEdits() {
    if (!club) return
    const fields: Record<string, string> = {}
    for (const f of EDIT_FIELDS) {
      const now = draft[f.key] ?? ""
      const was = ((club as unknown as Record<string, unknown>)[f.key] as string | null) ?? ""
      if (now !== was) fields[f.key] = now
    }
    if (!Object.keys(fields).length) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/clubs/lifecycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", id: club.id, fields }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Save failed")
      setNotice("Saved")
      setEditing(false)
      await load()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function togglePublish() {
    if (!club) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/clubs/lifecycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: club.publishedAt ? "unpublish" : "publish", ids: [club.id] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Action failed")
      setNotice(club.publishedAt ? "Unpublished" : "Published")
      await load()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setSaving(false)
    }
  }

  const mapPin =
    club && club.latitude != null && club.longitude != null
      ? `https://www.google.com/maps?q=${club.latitude},${club.longitude}`
      : null
  const mapByName = club
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [club.name, club.city, club.state].filter(Boolean).join(" ")
      )}`
    : null

  /** One display row of the record: label, interactive value, provenance. */
  function FieldRow({ label, fieldKey, value }: { label: string; fieldKey: string; value: string | null }) {
    const prov = provenance.get(fieldKey)
    const href = value ? hrefFor(fieldKey, value) : null
    return (
      <div className="flex items-baseline gap-3 py-1.5">
        <div className="text-ink-500 w-24 shrink-0 text-xs font-semibold">{label}</div>
        <div className="min-w-0 flex-1">
          {value ? (
            href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-ink-900 decoration-ink-300 hover:decoration-ink-600 block truncate text-sm font-medium underline underline-offset-2"
                title={value}
              >
                {value}
              </a>
            ) : (
              <span className="text-ink-900 block truncate text-sm" title={value}>
                {value}
              </span>
            )
          ) : (
            <span className="text-ink-400 text-sm italic">empty</span>
          )}
        </div>
        {prov && (
          <span className="flex shrink-0 items-center gap-1.5">
            <span title={`${shortDate(prov.appliedAt)} by ${prov.appliedBy}${prov.confidence ? `, ${prov.confidence} confidence` : ""}`}>
              <Badge tone={sourceChip(prov.source).tone}>{sourceChip(prov.source).label}</Badge>
            </span>
            {prov.sourceUrl && (
              <a
                href={prov.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-play-600 text-xs underline"
              >
                source
              </a>
            )}
          </span>
        )}
      </div>
    )
  }

  if (typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/40 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={club ? `${club.name} record` : "Club record"}
    >
      <div className="border-ink-100 shadow-soft w-full max-w-3xl rounded-2xl border bg-white">
        {/* header */}
        <div className="border-ink-100 bg-ink-50/60 flex items-start justify-between gap-3 rounded-t-2xl border-b px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-ink-950 truncate text-lg font-semibold">
                {club?.name ?? "Loading"}
              </h2>
              {club?.mergedIntoId ? (
                <Badge tone="neutral">merged</Badge>
              ) : club?.publishedAt ? (
                <Badge tone="success">published</Badge>
              ) : club ? (
                <Badge tone="warning">draft</Badge>
              ) : null}
              {club?.isDemo && <Badge tone="neutral">demo</Badge>}
            </div>
            {club && (
              <div className="text-ink-500 mt-0.5 text-xs">
                {club.slug}
                {club.city ? ` · ${club.city}` : ""}
                {club.state ? `, ${club.state}` : ""}
                {" · "}
                {club._count.teams} {club._count.teams === 1 ? "team" : "teams"} ·{" "}
                {club._count.clubClaims} {club._count.clubClaims === 1 ? "claim" : "claims"} ·
                listed {shortDate(club.createdAt)}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-400 hover:text-ink-700 -mr-1 -mt-1 cursor-pointer rounded-lg p-1.5 transition"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {notice && (
            <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div>
          )}
          {error && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {loading && <p className="text-ink-500 py-8 text-center text-sm">Loading…</p>}

          {club && !editing && (
            <>
              {/* completeness */}
              <div className="bg-ink-50/70 mb-4 rounded-xl px-3.5 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-ink-900 text-sm font-semibold">
                    {filled.length} of {COMPLETENESS.length} fields filled
                  </span>
                  <span className="bg-ink-200 h-1.5 w-32 overflow-hidden rounded-full">
                    <span
                      className="bg-court-500 block h-full rounded-full"
                      style={{ width: `${Math.round((filled.length / COMPLETENESS.length) * 100)}%` }}
                    />
                  </span>
                  {missing.length > 0 && (
                    <span className="text-ink-500 text-xs">
                      missing: {missing.map((m) => m.label.toLowerCase()).join(", ")}
                    </span>
                  )}
                </div>
              </div>

              {/* the record, every value interactive */}
              <div className="divide-ink-100 divide-y">
                <FieldRow label="Website" fieldKey="website" value={club.website} />
                <FieldRow label="Email" fieldKey="contactEmail" value={club.contactEmail} />
                <FieldRow label="Phone" fieldKey="phoneNumber" value={club.phoneNumber} />
                <FieldRow
                  label="Address"
                  fieldKey="address"
                  value={
                    club.address ??
                    ([club.city, club.state, club.postalCode].filter(Boolean).join(", ") || null)
                  }
                />
                <div className="flex items-baseline gap-3 py-1.5">
                  <div className="text-ink-500 w-24 shrink-0 text-xs font-semibold">Map pin</div>
                  <div className="min-w-0 flex-1">
                    {club.latitude != null && club.longitude != null ? (
                      <span className="flex flex-wrap items-center gap-x-2 text-sm">
                        <a
                          href={mapPin!}
                          target="_blank"
                          rel="noreferrer"
                          className="text-ink-900 decoration-ink-300 hover:decoration-ink-600 font-medium underline underline-offset-2"
                          title="Opens the saved pin on a map"
                        >
                          {club.latitude.toFixed(4)}, {club.longitude.toFixed(4)}
                        </a>
                        <a
                          href={mapByName!}
                          target="_blank"
                          rel="noreferrer"
                          className="text-play-600 text-xs underline"
                          title="Search the club by name on the map, to compare with the pin"
                        >
                          find by name
                        </a>
                        {(club.geoSource || club.geoPrecision) && (
                          <span className="text-ink-400 text-xs">
                            {[club.geoSource, club.geoPrecision].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-ink-400 text-sm italic">empty</span>
                    )}
                  </div>
                  {(provenance.get("latitude") || provenance.get("longitude")) && (
                    <span className="shrink-0">
                      {(() => {
                        const p = provenance.get("latitude") ?? provenance.get("longitude")!
                        return (
                          <span title={`${shortDate(p.appliedAt)} by ${p.appliedBy}`}>
                            <Badge tone={sourceChip(p.source).tone}>{sourceChip(p.source).label}</Badge>
                          </span>
                        )
                      })()}
                    </span>
                  )}
                </div>
                <FieldRow label="Region" fieldKey="region" value={club.region} />
                {club.searchAliases && (
                  <FieldRow label="Also known" fieldKey="searchAliases" value={club.searchAliases} />
                )}
                {club.description && (
                  <div className="flex items-baseline gap-3 py-1.5">
                    <div className="text-ink-500 w-24 shrink-0 text-xs font-semibold">About</div>
                    <p className="text-ink-700 line-clamp-3 min-w-0 flex-1 text-sm" title={club.description}>
                      {club.description}
                    </p>
                  </div>
                )}
              </div>

              {/* where the record came from */}
              {(club.dataSources || club.dataNotes) && (
                <div className="border-ink-100 mt-3 border-t pt-3">
                  <div className="text-ink-500 text-xs">
                    <span className="font-semibold">Record sources:</span>{" "}
                    {club.dataSources ? club.dataSources.split(",").map((s) => s.trim()).filter(Boolean).join(" · ") : "none saved"}
                    {club.dataNotes ? ` · ${club.dataNotes}` : ""}
                  </div>
                </div>
              )}

              {/* this club's machine edits, workable right here */}
              {rows.length > 0 && (
                <div className="border-ink-100 mt-4 border-t pt-3">
                  <div className="text-ink-900 mb-1.5 text-sm font-semibold">
                    Machine edits{pendingRows.length > 0 ? ` · ${pendingRows.length} waiting` : ""}
                  </div>
                  <ul className="divide-ink-100 divide-y">
                    {rows.map((r) => (
                      <li key={r.id} className={`flex items-center gap-2 py-1.5 ${r.reviewedAt ? "opacity-60" : ""}`}>
                        <span className="text-ink-700 w-20 shrink-0 truncate text-xs font-semibold">
                          {fieldLabel(r.field)}
                        </span>
                        <span className="text-ink-900 min-w-0 flex-1 truncate text-xs" title={r.toValue ?? "cleared"}>
                          {r.toValue ?? <span className="italic">cleared</span>}
                        </span>
                        <Badge tone={sourceChip(r.source).tone}>{sourceChip(r.source).label}</Badge>
                        {r.reviewedAt ? (
                          <span className={`shrink-0 text-xs ${r.reverted ? "text-amber-700" : "text-emerald-700"}`}>
                            {r.reverted ? "put back" : "kept"}
                          </span>
                        ) : confirmingRow === r.id ? (
                          <span className="flex shrink-0 items-center gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              tone="hoop"
                              disabled={busy}
                              onClick={() => {
                                setConfirmingRow(null)
                                void onQueueAction({ action: "revert", id: r.id }, () => `${r.field} is back to what it was`)
                              }}
                            >
                              Yes
                            </Button>
                            <Button size="sm" variant="subtle" onClick={() => setConfirmingRow(null)}>
                              Cancel
                            </Button>
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              tone="court"
                              disabled={busy}
                              onClick={() =>
                                void onQueueAction({ action: "approve", ids: [r.id] }, () => `Kept the ${r.field}`)
                              }
                            >
                              Keep
                            </Button>
                            {r.revertable && (
                              <Button size="sm" variant="subtle" disabled={busy} onClick={() => setConfirmingRow(r.id)}>
                                Put back
                              </Button>
                            )}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {club && editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              {EDIT_FIELDS.map((f) => (
                <label key={f.key} className={f.key === "name" || f.key === "address" ? "sm:col-span-2" : ""}>
                  <span className="text-ink-500 mb-1 block text-xs font-semibold">{f.label}</span>
                  <input
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="border-ink-200 text-ink-900 placeholder:text-ink-300 focus:border-ink-400 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none"
                  />
                </label>
              ))}
              <p className="text-ink-400 text-xs sm:col-span-2">
                Websites need the full address starting with https. Leaving a field blank clears it.
              </p>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="border-ink-100 bg-ink-50/40 flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t px-5 py-3">
          <div className="flex items-center gap-2">
            {club && !editing && (
              <>
                <Button size="sm" variant="secondary" tone="ink" onClick={startEditing} disabled={saving}>
                  Edit fields
                </Button>
                <Button size="sm" variant="secondary" tone={club.publishedAt ? "ink" : "court"} onClick={() => void togglePublish()} disabled={saving}>
                  {club.publishedAt ? "Unpublish" : "Publish"}
                </Button>
              </>
            )}
            {club && editing && (
              <>
                <Button size="sm" tone="ink" onClick={() => void saveEdits()} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
                <Button size="sm" variant="subtle" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {club && (
              <a
                href={`/club/${club.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-ink-400 hover:text-ink-600 text-xs underline"
              >
                public page
              </a>
            )}
            {club && onOpenFull && (
              <button
                type="button"
                onClick={() => onOpenFull({ id: club.id, name: club.name })}
                className="text-ink-400 hover:text-ink-600 cursor-pointer text-xs underline"
                title="The full Clubs tab holds the merge tools"
              >
                open in Clubs tab
              </button>
            )}
            <Button size="sm" variant="subtle" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
