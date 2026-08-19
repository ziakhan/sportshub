"use client"

/**
 * Storage settings (owner 2026-08-18: "we should have an option to do an S3 or
 * local for now or I can create you an S3 bucket so it should be configurable").
 *
 * Two things this panel is careful about.
 *
 * 1. It never asks for an access key or a secret. Those belong in the server
 *    environment, never in a database an admin form can write to and a backup can
 *    leak. The panel reports only whether credentials are PRESENT.
 * 2. It can prove the setting works before a club finds out it does not. A form
 *    that saves happily and then fails on the first real upload is worse than no
 *    form, so there is a Test button that actually writes and removes a probe.
 */

import { useEffect, useState } from "react"

interface Health {
  ok: boolean
  detail: string
  driver: string
  maxMb: number
  hasEnvCredentials: boolean
}

export function StoragePanel({
  onMessage,
}: {
  onMessage: (m: { type: "success" | "error"; text: string }) => void
}) {
  const [driver, setDriver] = useState<"LOCAL" | "S3">("LOCAL")
  const [localDir, setLocalDir] = useState("/var/lib/sportshub/uploads")
  const [publicUrl, setPublicUrl] = useState("/uploads")
  const [bucket, setBucket] = useState("")
  const [region, setRegion] = useState("")
  const [endpoint, setEndpoint] = useState("")
  const [maxMb, setMaxMb] = useState(8)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        setDriver(d.uploadDriver === "S3" ? "S3" : "LOCAL")
        setLocalDir(d.uploadLocalDir || "/var/lib/sportshub/uploads")
        setPublicUrl(d.uploadPublicUrl || "/uploads")
        setBucket(d.uploadS3Bucket || "")
        setRegion(d.uploadS3Region || "")
        setEndpoint(d.uploadS3Endpoint || "")
        setMaxMb(d.uploadMaxMb || 8)
      })
      .catch(() => {})
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadDriver: driver,
          uploadLocalDir: localDir,
          uploadPublicUrl: publicUrl,
          uploadS3Bucket: bucket || null,
          uploadS3Region: region || null,
          uploadS3Endpoint: endpoint || null,
          uploadMaxMb: Number(maxMb),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || "Could not save")
      }
      onMessage({ type: "success", text: "Storage settings saved. Test it before uploading anything real." })
      await test()
    } catch (e: any) {
      onMessage({ type: "error", text: e?.message || "Could not save storage settings" })
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    try {
      const res = await fetch("/api/admin/settings/storage-check")
      const j = await res.json()
      setHealth(j)
    } catch {
      setHealth({ ok: false, detail: "The check could not run.", driver, maxMb, hasEnvCredentials: false })
    } finally {
      setTesting(false)
    }
  }

  const field =
    "border-ink-200 focus:border-play-500 w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors"

  return (
    <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
      <h3 className="font-display text-ink-950 mb-2 text-lg font-semibold">Image storage</h3>
      <p className="text-ink-500 mb-4 text-sm">
        Where club logos, banners, sponsor logos and photos are kept. Images used to live
        inside the database, which does not hold up once a club uploads a gallery.
      </p>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Storage driver">
        {(
          [
            ["LOCAL", "This server", "Kept on the box and served by Caddy"],
            ["S3", "S3 bucket", "AWS, Cloudflare R2, MinIO or Backblaze"],
          ] as const
        ).map(([k, label, blurb]) => (
          <button
            key={k}
            type="button"
            onClick={() => setDriver(k)}
            aria-pressed={driver === k}
            className={`min-h-[44px] cursor-pointer rounded-xl border px-4 py-2 text-left transition-colors duration-200 ${
              driver === k ? "border-play-500 bg-play-50" : "border-ink-200 hover:border-ink-300"
            }`}
          >
            <span className="text-ink-900 block text-sm font-semibold">{label}</span>
            <span className="text-ink-500 block text-xs">{blurb}</span>
          </button>
        ))}
      </div>

      {driver === "LOCAL" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-ink-700 mb-1 block text-xs font-semibold">Folder on the server</span>
            <input className={field} value={localDir} onChange={(e) => setLocalDir(e.target.value)} />
            <span className="text-ink-400 mt-1 block text-[11px]">
              Keep this outside the app folder. A deploy pulls the repo, so anything inside it
              can be wiped.
            </span>
          </label>
          <label className="block">
            <span className="text-ink-700 mb-1 block text-xs font-semibold">Public path</span>
            <input className={field} value={publicUrl} onChange={(e) => setPublicUrl(e.target.value)} />
            <span className="text-ink-400 mt-1 block text-[11px]">
              Caddy must serve this path from the folder above.
            </span>
          </label>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-ink-700 mb-1 block text-xs font-semibold">Bucket</span>
            <input className={field} value={bucket} onChange={(e) => setBucket(e.target.value)} placeholder="sportshub-uploads" />
          </label>
          <label className="block">
            <span className="text-ink-700 mb-1 block text-xs font-semibold">Region</span>
            <input className={field} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="us-east-1" />
          </label>
          <label className="block">
            <span className="text-ink-700 mb-1 block text-xs font-semibold">Endpoint (only for R2, MinIO, Backblaze)</span>
            <input className={field} value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="Leave empty for AWS" />
          </label>
          <label className="block">
            <span className="text-ink-700 mb-1 block text-xs font-semibold">Public URL base</span>
            <input className={field} value={publicUrl} onChange={(e) => setPublicUrl(e.target.value)} placeholder="https://cdn.example.com" />
          </label>
          <p className="text-ink-500 bg-ink-50 sm:col-span-2 rounded-xl p-3 text-xs leading-relaxed">
            <strong className="text-ink-800">Keys are not set here.</strong> Put{" "}
            <code className="text-ink-800">UPLOAD_S3_ACCESS_KEY_ID</code> and{" "}
            <code className="text-ink-800">UPLOAD_S3_SECRET_ACCESS_KEY</code> in the server
            environment file. Storing them in the database would put them in every backup.
          </p>
        </div>
      )}

      <label className="mt-3 block max-w-[200px]">
        <span className="text-ink-700 mb-1 block text-xs font-semibold">Largest upload (MB)</span>
        <input
          type="number"
          min={1}
          max={64}
          className={field}
          value={maxMb}
          onChange={(e) => setMaxMb(Number(e.target.value))}
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-play-600 min-h-[44px] cursor-pointer rounded-xl px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save storage settings"}
        </button>
        <button
          type="button"
          onClick={test}
          disabled={testing}
          className="border-ink-200 text-ink-700 hover:bg-ink-50 min-h-[44px] cursor-pointer rounded-xl border px-4 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {testing ? "Testing..." : "Test it now"}
        </button>
      </div>

      {health && (
        <div
          className={`mt-3 rounded-xl border p-3 text-sm ${
            health.ok
              ? "border-court-200 bg-court-50 text-court-700"
              : "border-hoop-200 bg-hoop-50 text-hoop-700"
          }`}
        >
          <p className="font-semibold">{health.ok ? "Working" : "Not working yet"}</p>
          <p className="mt-0.5 text-[13px]">{health.detail}</p>
          {health.driver === "S3" && !health.hasEnvCredentials && (
            <p className="mt-1 text-[13px]">No S3 credentials found in the server environment.</p>
          )}
        </div>
      )}
    </div>
  )
}
