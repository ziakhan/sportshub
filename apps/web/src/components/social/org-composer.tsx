"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/components/ui/cn"

async function photoToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", 0.82)
}

export interface OrgOption {
  key: string
  label: string
  tenantId?: string
  leagueId?: string
}

/**
 * Org post composer (social-feed-plan P5): clubs/leagues author photo,
 * video-embed, or text posts. Only orgs create free-form content — this
 * button never renders for regular users.
 */
export function OrgComposer({ orgs }: { orgs: OrgOption[] }) {
  const [open, setOpen] = useState(false)
  const [orgKey, setOrgKey] = useState(orgs[0]?.key ?? "")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [photos, setPhotos] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  if (orgs.length === 0) return null

  const submit = async () => {
    if (busy || title.trim().length < 3) return
    setBusy(true)
    setError(null)
    const org = orgs.find((o) => o.key === orgKey) ?? orgs[0]
    try {
      const res = await fetch("/api/posts/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(org.tenantId ? { tenantId: org.tenantId } : { leagueId: org.leagueId }),
          title: title.trim(),
          ...(body.trim() ? { body: body.trim() } : {}),
          ...(photos.length ? { photos } : {}),
          ...(videoUrl.trim() ? { videoUrl: videoUrl.trim() } : {}),
        }),
      })
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || "Couldn't publish the post")
      } else {
        setOpen(false)
        setTitle("")
        setBody("")
        setPhotos([])
        setVideoUrl("")
        router.refresh()
      }
    } catch {
      setError("Couldn't publish the post")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-ink-500 hover:bg-ink-50 border-ink-200 w-full rounded-full border px-4 py-2.5 text-left text-sm"
        >
          Post an update, photos, or a video as {orgs[0].label}…
        </button>
      ) : (
        <div className="space-y-3">
          {orgs.length > 1 && (
            <select
              value={orgKey}
              onChange={(e) => setOrgKey(e.target.value)}
              className="border-ink-200 w-full rounded-lg border px-3 py-2 text-sm"
            >
              {orgs.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            maxLength={160}
            className="border-ink-200 w-full rounded-lg border px-3 py-2 text-sm font-semibold"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Say more (optional)"
            rows={3}
            maxLength={4000}
            className="border-ink-200 w-full rounded-lg border px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            {photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p} alt="" className="h-14 w-14 rounded-lg object-cover" />
            ))}
            {photos.length < 4 && (
              <label className="border-ink-200 text-ink-500 hover:bg-ink-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-lg border border-dashed text-xl">
                +
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []).slice(0, 4 - photos.length)
                    const urls = await Promise.all(files.map(photoToDataUrl))
                    setPhotos((p) => [...p, ...urls])
                    e.target.value = ""
                  }}
                />
              </label>
            )}
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Video link (YouTube/Vimeo, optional)"
              className="border-ink-200 min-w-[200px] flex-1 rounded-lg border px-3 py-2 text-xs"
            />
          </div>
          {error && (
            <p className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-lg border p-2 text-xs font-semibold">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="text-ink-600 hover:bg-ink-50 rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || title.trim().length < 3}
              className={cn(
                "bg-play-600 hover:bg-play-700 rounded-lg px-4 py-2 text-sm font-bold text-white",
                (busy || title.trim().length < 3) && "opacity-50"
              )}
            >
              {busy ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
