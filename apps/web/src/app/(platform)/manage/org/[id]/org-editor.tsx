"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"

/** Operator identity editor — every field labeled and explained. */
export function OrgEditor({
  orgId,
  initial,
}: {
  orgId: string
  initial: {
    name: string
    tagline: string
    description: string
    primaryColor: string
    logoUrl: string | null
  }
}) {
  const router = useRouter()
  const [name, setName] = useState(initial.name)
  const [tagline, setTagline] = useState(initial.tagline)
  const [description, setDescription] = useState(initial.description)
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor)
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const onLogoFile = (file: File | null) => {
    if (!file) return
    if (file.size > 400_000) {
      setMessage("Logo file is too large — use an image under 400 KB (a square PNG works best).")
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogoUrl(String(reader.result))
    reader.readAsDataURL(file)
  }

  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          tagline: tagline.trim() || null,
          description: description.trim() || null,
          primaryColor,
          logoUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't save")
      setMessage("Saved — every league that inherits will show the new branding immediately.")
      router.refresh()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't save")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-ink-100 shadow-soft space-y-4 rounded-2xl border bg-white p-5">
      <div>
        <label className="text-ink-700 mb-1 block text-sm font-medium">Organization name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border-ink-200 w-full max-w-md rounded-lg border px-3 py-2 text-sm"
        />
        <p className="text-ink-400 mt-1 text-xs">Shown as “Run by {name || "…"}” on every league page.</p>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div>
          <label className="text-ink-700 mb-1 block text-sm font-medium">Logo</label>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Organization logo" className="border-ink-100 h-16 w-16 rounded-xl border bg-white object-contain p-1" />
            ) : (
              <div className="border-ink-200 text-ink-400 flex h-16 w-16 items-center justify-center rounded-xl border border-dashed text-xs">
                none
              </div>
            )}
            <div className="space-y-1">
              <input type="file" accept="image/*" onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)} className="text-xs" />
              {logoUrl && (
                <button onClick={() => setLogoUrl(null)} className="text-hoop-600 block text-xs font-semibold hover:underline">
                  Remove logo
                </button>
              )}
            </div>
          </div>
          <p className="text-ink-400 mt-1 text-xs">Square image, under 400 KB. Appears on league pages and the public profile.</p>
        </div>
        <div>
          <label className="text-ink-700 mb-1 block text-sm font-medium">Brand color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border-0"
              aria-label="Pick brand color"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="border-ink-200 w-28 rounded-lg border px-2 py-1.5 text-sm"
            />
          </div>
          <p className="text-ink-400 mt-1 text-xs">Colors league page heroes and accents.</p>
        </div>
      </div>

      <div>
        <label className="text-ink-700 mb-1 block text-sm font-medium">Tagline</label>
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="A pathway for Canadian basketball to the next level"
          className="border-ink-200 w-full max-w-xl rounded-lg border px-3 py-2 text-sm"
        />
        <p className="text-ink-400 mt-1 text-xs">One line under the league name on public pages.</p>
      </div>

      <div>
        <label className="text-ink-700 mb-1 block text-sm font-medium">About the organization</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="border-ink-200 w-full rounded-lg border px-3 py-2 text-sm"
        />
        <p className="text-ink-400 mt-1 text-xs">Shown on your public operator profile above the league list.</p>
      </div>

      {message && <p className="text-ink-700 bg-court-50 border-court-200 rounded-lg border px-3 py-2 text-sm">{message}</p>}
      <Button disabled={busy || name.trim().length < 2} onClick={save}>
        {busy ? "Saving…" : "Save organization"}
      </Button>
    </div>
  )
}
