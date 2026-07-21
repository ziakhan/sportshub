"use client"

// Shared waiver management UI for leagues and clubs (waivers-esign 2026-07-20).
// The owning page authenticates and passes the API base path; this component
// handles list, create-from-template, custom create, edit and deactivate.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge, Button } from "@/components/ui"

export interface WaiverRow {
  id: string
  title: string
  type: string
  version: number
  required: boolean
  annualRenewal: boolean
  active: boolean
  body: string
  signatureCount: number
}

export interface TemplateOption {
  key: string
  title: string
  description: string
  annualRenewal: boolean
  previewBody: string
}

const TYPE_LABELS: Record<string, string> = {
  ACKNOWLEDGMENT_INDEMNITY: "Risk & indemnity",
  CONCUSSION_CODE: "Concussion code",
  MEDIA_CONSENT: "Media consent",
  CUSTOM: "Custom",
}

export function WaiversManager({
  basePath,
  initialWaivers,
  templates,
}: {
  basePath: string
  initialWaivers: WaiverRow[]
  templates: TemplateOption[]
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<WaiverRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call(path: string, method: string, body?: unknown) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Something went wrong")
        return false
      }
      router.refresh()
      return true
    } catch {
      setError("Something went wrong. Please try again.")
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Waivers & agreements</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Documents parents sign before their child participates
          </p>
        </div>
        <Button onClick={() => { setCreating((v) => !v); setEditing(null) }}>
          {creating ? "Cancel" : "Add waiver"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {creating ? (
        <CreatePanel
          templates={templates}
          busy={busy}
          onCreate={async (payload) => {
            if (await call(basePath, "POST", payload)) setCreating(false)
          }}
        />
      ) : null}

      {editing ? (
        <EditPanel
          waiver={editing}
          busy={busy}
          onSave={async (payload) => {
            if (await call(`${basePath}/${editing.id}`, "PATCH", payload)) setEditing(null)
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {initialWaivers.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50/50 p-8 text-center text-sm text-ink-500">
          No waivers yet. Start from a template — the risk acknowledgment and the
          Rowan&apos;s Law concussion code cover most Ontario programs.
        </div>
      ) : null}

      <div className="space-y-3">
        {initialWaivers.map((w) => (
          <div
            key={w.id}
            className={`rounded-xl border bg-white p-4 ${w.active ? "border-ink-200" : "border-ink-100 opacity-60"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink-900">{w.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{TYPE_LABELS[w.type] ?? w.type}</Badge>
                  <Badge tone="neutral">v{w.version}</Badge>
                  {w.required ? <Badge tone="play">Required</Badge> : <Badge tone="neutral">Optional</Badge>}
                  {w.annualRenewal ? <Badge tone="warning">Renews yearly</Badge> : null}
                  {!w.active ? <Badge tone="neutral">Inactive</Badge> : null}
                  <span className="text-xs text-ink-400">
                    {w.signatureCount} signature{w.signatureCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="subtle"
                  onClick={() => { setEditing(w); setCreating(false) }}
                >
                  Edit
                </Button>
                {w.active ? (
                  <Button
                    variant="subtle"
                    onClick={async () => {
                      if (
                        window.confirm(
                          "Deactivate this waiver? Existing signatures are kept, but it stops being sent."
                        )
                      ) {
                        await call(`${basePath}/${w.id}`, "DELETE")
                      }
                    }}
                  >
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    variant="subtle"
                    onClick={() => call(`${basePath}/${w.id}`, "PATCH", { active: true })}
                  >
                    Reactivate
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-ink-400">
        Templates are starting points, not legal advice. Have a lawyer review your final
        text. Editing a waiver&apos;s text creates a new version and everyone signs the
        new text; existing signatures keep the exact text they signed.
      </p>
    </div>
  )
}

function CreatePanel({
  templates,
  busy,
  onCreate,
}: {
  templates: TemplateOption[]
  busy: boolean
  onCreate: (payload: Record<string, unknown>) => void
}) {
  const [templateKey, setTemplateKey] = useState<string | "custom">(templates[0]?.key ?? "custom")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const selected = templates.find((t) => t.key === templateKey)

  return (
    <div className="space-y-4 rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTemplateKey(t.key)}
            className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
              templateKey === t.key
                ? "border-play-600 bg-play-50 text-play-800"
                : "border-ink-200 text-ink-600 hover:border-ink-300"
            }`}
          >
            {t.title}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTemplateKey("custom")}
          className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
            templateKey === "custom"
              ? "border-play-600 bg-play-50 text-play-800"
              : "border-ink-200 text-ink-600 hover:border-ink-300"
          }`}
        >
          Custom document
        </button>
      </div>

      {selected ? (
        <>
          <p className="text-sm text-ink-500">{selected.description}</p>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-ink-100 bg-ink-50/50 p-4">
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink-600">
              {selected.previewBody}
            </pre>
          </div>
          <Button
            disabled={busy}
            onClick={() => onCreate({ templateKey: selected.key })}
          >
            {busy ? "Adding..." : `Add "${selected.title}"`}
          </Button>
        </>
      ) : (
        <>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-200"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Full document text parents will read and sign"
            rows={10}
            className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm leading-relaxed focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-200"
          />
          <Button
            disabled={busy || title.trim().length < 2 || body.trim().length < 20}
            onClick={() => onCreate({ title: title.trim(), body: body.trim() })}
          >
            {busy ? "Adding..." : "Add custom waiver"}
          </Button>
        </>
      )}
    </div>
  )
}

function EditPanel({
  waiver,
  busy,
  onSave,
  onCancel,
}: {
  waiver: WaiverRow
  busy: boolean
  onSave: (payload: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(waiver.title)
  const [body, setBody] = useState(waiver.body)
  const [required, setRequired] = useState(waiver.required)
  const [annualRenewal, setAnnualRenewal] = useState(waiver.annualRenewal)
  const bodyChanged = body !== waiver.body

  return (
    <div className="space-y-4 rounded-xl border border-play-300 bg-white p-4 sm:p-5">
      <p className="text-sm font-semibold text-ink-700">Editing: {waiver.title}</p>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-200"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={12}
        className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm leading-relaxed focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-200"
      />
      <div className="flex flex-wrap gap-5 text-sm text-ink-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300"
          />
          Required to participate
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={annualRenewal}
            onChange={(e) => setAnnualRenewal(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300"
          />
          Must be re-signed yearly
        </label>
      </div>
      {bodyChanged ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The text changed, so saving creates version {waiver.version + 1}. Everyone will
          need to sign the new text; existing signatures keep the old text on record.
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          disabled={busy || title.trim().length < 2 || body.trim().length < 20}
          onClick={() =>
            onSave({ title: title.trim(), body: body.trim(), required, annualRenewal })
          }
        >
          {busy ? "Saving..." : "Save changes"}
        </Button>
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
