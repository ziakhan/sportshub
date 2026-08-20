"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge, BrandListbox, Button, Card, SectionHeader } from "@/components/ui"
import { MergeDialog } from "./merge-dialog"
import { MachineEditsQueue } from "./enrichments"

/**
 * Club review console (client half).
 *
 * Follows the table idiom of admin/users — this repo has no shared Table,
 * Modal or Pagination component, and the review queue is not the place to
 * invent one.
 */

interface Club {
  id: string
  slug: string
  name: string
  city: string | null
  state: string | null
  region: string | null
  status: string
  publishedAt: string | null
  contactEmail: string | null
  phoneNumber: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  geoPrecision: string | null
  dataSources: string | null
  dataNotes: string | null
  mergedIntoId: string | null
  isDemo: boolean
  reviewedAt: string | null
  _count: { teams: number; clubClaims: number }
}

interface Payload {
  clubs: Club[]
  total: number
  page: number
  totalPages: number
  counts: Record<string, number>
  provinces: Array<{ code: string | null; count: number }>
  regions: Array<{ region: string | null; count: number }>
}

const ISSUES: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "unpublished", label: "Unpublished" },
  { key: "no-contact", label: "No contact" },
  { key: "no-location", label: "No coordinates" },
  { key: "no-city", label: "No city" },
  { key: "no-website", label: "No website" },
  { key: "merged", label: "Merged away" },
]

const EDITABLE: Array<{ key: keyof Club; label: string; type?: string }> = [
  { key: "name", label: "Name" },
  { key: "city", label: "City" },
  { key: "state", label: "Province" },
  { key: "region", label: "Region" },
  { key: "contactEmail", label: "Email", type: "email" },
  { key: "phoneNumber", label: "Phone" },
  { key: "website", label: "Website", type: "url" },
]

/** The two halves of the console: the clubs themselves, and what scripts did to them. */
const VIEWS: Array<{ key: "clubs" | "machine"; label: string }> = [
  { key: "clubs", label: "Clubs" },
  { key: "machine", label: "Machine edits" },
]

export function ClubLifecycleConsole() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [view, setView] = useState<"clubs" | "machine">("clubs")
  // Counted on arrival so the tab says how much is waiting before it is opened.
  const [machinePending, setMachinePending] = useState<number | null>(null)

  const [q, setQ] = useState("")
  const [issue, setIssue] = useState("all")
  const [province, setProvince] = useState("")
  const [region, setRegion] = useState("")
  const [page, setPage] = useState(1)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  // Merging is driven by the same tick-boxes as publishing: select exactly two
  // rows and press Merge. There is deliberately no per-row merge button - one
  // on every row is what let a single mis-click retire the wrong club.
  const [merging, setMerging] = useState(false)

  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams()
      if (q.trim()) p.set("q", q.trim())
      if (issue !== "all") p.set("issue", issue)
      if (province) p.set("province", province)
      if (region) p.set("region", region)
      p.set("page", String(page))
      const res = await fetch(`/api/admin/clubs/lifecycle?${p}`)
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load")
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [q, issue, province, region, page])

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  useEffect(() => {
    fetch("/api/admin/clubs/enrichments?counts=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setMachinePending(j.pendingRows))
      .catch(() => {})
  }, [])

  // Any filter change invalidates the current page number.
  useEffect(() => setPage(1), [q, issue, province, region])

  async function act(body: unknown, describe: (r: any) => string) {
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch("/api/admin/clubs/lifecycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Action failed")
      setNotice(describe(json))
      setSelected(new Set())
      setExpanded(null)
      setMerging(false)
      setSelected(new Set())
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(false)
    }
  }

  const clubs = data?.clubs ?? []

  /** The two ticked clubs, in list order, or null until exactly two are ticked. */
  const mergePair = useMemo(() => {
    if (selected.size !== 2) return null
    const picked = clubs.filter((c) => selected.has(c.id))
    return picked.length === 2 ? ([picked[0], picked[1]] as [Club, Club]) : null
  }, [selected, clubs])
  const allSelected = clubs.length > 0 && clubs.every((c) => selected.has(c.id))

  const provinceOptions = useMemo(
    () => [
      { value: "", label: "All provinces" },
      ...(data?.provinces ?? [])
        .filter((p) => p.code)
        .map((p) => ({ value: p.code as string, label: `${p.code} (${p.count})` })),
    ],
    [data?.provinces]
  )
  const regionOptions = useMemo(
    () => [
      { value: "", label: "All regions" },
      ...(data?.regions ?? [])
        .filter((r) => r.region)
        .map((r) => ({ value: r.region as string, label: `${r.region} (${r.count})` })),
    ],
    [data?.regions]
  )

  function startEdit(c: Club) {
    setExpanded(expanded === c.id ? null : c.id)
    setDraft(
      Object.fromEntries(EDITABLE.map((f) => [f.key, (c[f.key] as string | null) ?? ""]))
    )
  }

  function saveEdit(c: Club) {
    // Send only what actually changed, so an untouched field is never cleared.
    const fields: Record<string, string> = {}
    for (const f of EDITABLE) {
      const now = draft[f.key as string] ?? ""
      const was = (c[f.key] as string | null) ?? ""
      if (now !== was) fields[f.key as string] = now
    }
    if (!Object.keys(fields).length) {
      setExpanded(null)
      return
    }
    void act({ action: "edit", id: c.id, fields }, () => `Saved ${c.name}`)
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <SectionHeader
        title="Club review"
        description={
          view === "machine"
            ? machinePending
              ? `${machinePending.toLocaleString()} ${machinePending === 1 ? "edit" : "edits"} made by a script, waiting for a person to check`
              : "What the scripts changed, and where they got it"
            : data
              ? `${data.total.toLocaleString()} ${data.total === 1 ? "club" : "clubs"} matching. ${(data.counts.unpublished ?? 0).toLocaleString()} still unpublished`
              : "Loading…"
        }
      />

      <div className="border-ink-200 bg-ink-50 mb-4 mt-5 inline-flex rounded-full border p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              view === v.key ? "shadow-soft text-ink-900 bg-white" : "text-ink-500 hover:text-ink-800"
            }`}
          >
            {v.label}
            {v.key === "machine" && machinePending ? (
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  view === v.key ? "bg-hoop-50 text-hoop-600" : "bg-ink-200 text-ink-600"
                }`}
              >
                {machinePending.toLocaleString()}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {view === "machine" && <MachineEditsQueue onPendingChange={setMachinePending} />}

      {view === "clubs" && (
      <>
      {notice && (
        <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Data-quality queue */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ISSUES.map((t) => (
          <button
            key={t.key}
            onClick={() => setIssue(t.key)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              issue === t.key
                ? "bg-ink-900 text-white"
                : "bg-ink-100 text-ink-700 hover:bg-ink-200"
            }`}
          >
            {t.label}
            {data?.counts?.[t.key] !== undefined && (
              <span className="ml-1.5 opacity-70">{data.counts[t.key].toLocaleString()}</span>
            )}
          </button>
        ))}
      </div>

      <Card size="sm" className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, city, slug or email…"
            className="min-w-[240px] flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
          />
          <BrandListbox
            ariaLabel="Province"
            value={province}
            onChange={setProvince}
            options={provinceOptions}
            className="min-w-[170px]"
          />
          <BrandListbox
            ariaLabel="Region"
            value={region}
            onChange={setRegion}
            options={regionOptions}
            className="min-w-[210px]"
          />
        </div>

        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
            <span className="text-sm text-ink-600">{selected.size} selected</span>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                act({ action: "publish", ids: [...selected] }, (r) => `Published ${r.count}`)
              }
            >
              Publish
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                act({ action: "unpublish", ids: [...selected] }, (r) => `Unpublished ${r.count}`)
              }
            >
              Unpublish
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || selected.size !== 2}
              title={selected.size === 2 ? undefined : "Merging works on exactly two clubs"}
              onClick={() => setMerging(true)}
            >
              Merge
            </Button>
            <Button size="sm" variant="subtle" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            {selected.size !== 2 && (
              <span className="text-ink-500 text-xs">Tick two clubs to merge them.</span>
            )}
          </div>
        )}

      </Card>

      {merging && mergePair && (
        <MergeDialog
          clubs={mergePair}
          busy={busy}
          onCancel={() => setMerging(false)}
          onConfirm={({ sourceId, targetId }) =>
            act({ action: "merge", sourceId, targetId }, () => {
              const kept = mergePair.find((c) => c.id === targetId)!
              const gone = mergePair.find((c) => c.id === sourceId)!
              return `${gone.name} is now part of ${kept.name}`
            })
          }
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-ink-100">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) =>
                    setSelected(e.target.checked ? new Set(clubs.map((c) => c.id)) : new Set())
                  }
                />
              </th>
              <th className="min-w-[260px] px-3 py-2">Club</th>
              <th className="min-w-[170px] px-3 py-2">Location</th>
              <th className="min-w-[200px] px-3 py-2">Contact</th>
              <th className="px-3 py-2">Geo</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-ink-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && clubs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-ink-500">
                  No clubs match these filters.
                </td>
              </tr>
            )}
            {clubs.map((c) => (
              <>
                <tr key={c.id} className="border-t border-ink-100 align-top hover:bg-ink-50/60">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={(e) => {
                        const next = new Set(selected)
                        e.target.checked ? next.add(c.id) : next.delete(c.id)
                        setSelected(next)
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink-900">{c.name}</div>
                    <div className="text-xs text-ink-500">
                      {c.slug}
                      {c.isDemo && " · demo"}
                      {c._count.teams > 0 && ` · ${c._count.teams} teams`}
                      {c._count.clubClaims > 0 && ` · ${c._count.clubClaims} claims`}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-ink-700">
                    {c.city || <span className="text-red-600">no city</span>}
                    {c.state && `, ${c.state}`}
                    {c.region && <div className="text-xs text-ink-500">{c.region}</div>}
                  </td>
                  <td className="px-3 py-2 text-ink-700">
                    {c.contactEmail || c.phoneNumber ? (
                      <>
                        {c.contactEmail && <div className="truncate max-w-[200px]">{c.contactEmail}</div>}
                        {c.phoneNumber && <div className="text-xs text-ink-500">{c.phoneNumber}</div>}
                      </>
                    ) : (
                      <span className="text-red-600">none</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-600">
                    {c.latitude != null ? (
                      <>
                        {c.latitude.toFixed(3)}, {c.longitude?.toFixed(3)}
                        <div className="text-ink-400">{c.geoPrecision}</div>
                      </>
                    ) : (
                      <span className="text-red-600">none</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.mergedIntoId ? (
                      <Badge tone="neutral">merged</Badge>
                    ) : c.publishedAt ? (
                      <Badge tone="success">published</Badge>
                    ) : (
                      <Badge tone="warning">draft</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                        <Button size="sm" variant="subtle" onClick={() => startEdit(c)}>
                          {expanded === c.id ? "Close" : "Edit"}
                        </Button>
                        {c.mergedIntoId && (
                          <Button
                            size="sm"
                            variant="subtle"
                            disabled={busy}
                            onClick={() =>
                              act({ action: "undo-merge", sourceId: c.id }, (r) => {
                                const back = Object.values(
                                  (r.returned ?? {}) as Record<string, number>
                                ).reduce((a, b) => a + b, 0)
                                return back
                                  ? `${c.name} is back, with ${back} ${back === 1 ? "record" : "records"} returned`
                                  : `${c.name} is back`
                              })
                            }
                          >
                            Undo merge
                          </Button>
                        )}
                        {!c.mergedIntoId && (
                          <>
                            <Button
                              size="sm"
                              variant="subtle"
                              disabled={busy}
                              onClick={() =>
                                act(
                                  {
                                    action: c.publishedAt ? "unpublish" : "publish",
                                    ids: [c.id],
                                  },
                                  () => (c.publishedAt ? `Unpublished ${c.name}` : `Published ${c.name}`)
                                )
                              }
                            >
                              {c.publishedAt ? "Unpublish" : "Publish"}
                            </Button>
                          </>
                        )}
                    </div>
                  </td>
                </tr>

                {expanded === c.id && (
                  <tr key={`${c.id}-edit`} className="border-t border-ink-100 bg-ink-50/40">
                    <td colSpan={7} className="px-3 py-3">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {EDITABLE.map((f) => (
                          <label key={f.key as string} className="text-xs text-ink-600">
                            {f.label}
                            <input
                              type={f.type ?? "text"}
                              value={draft[f.key as string] ?? ""}
                              onChange={(e) =>
                                setDraft({ ...draft, [f.key as string]: e.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-ink-200 px-2 py-1.5 text-sm text-ink-900"
                            />
                          </label>
                        ))}
                      </div>
                      {(c.dataSources || c.dataNotes) && (
                        <p className="mt-3 text-xs text-ink-500">
                          {c.dataSources && <>sources: {c.dataSources}. </>}
                          {c.dataNotes}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" disabled={busy} onClick={() => saveEdit(c)}>
                          Save
                        </Button>
                        <Button size="sm" variant="subtle" onClick={() => setExpanded(null)}>
                          Cancel
                        </Button>
                        <a
                          href={`/club/${c.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="self-center text-xs text-ink-500 underline"
                        >
                          view public page
                        </a>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-500">
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
