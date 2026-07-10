"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"

/**
 * Moderation bar on a news story — rendered ONLY for viewers the server
 * already authorized (PlatformAdmin, the game's league owner, or a club
 * owner/manager of either team). The public never sees this; the article
 * below it is untouched.
 */

interface AdminBarProps {
  postId: string
  status: string
  title: string
  body: string
  /** Recaps get the Regenerate control; other kinds are edit/takedown only. */
  isRecap: boolean
}

export function AdminBar({ postId, status, title, body, isRecap }: AdminBarProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const [draftBody, setDraftBody] = useState(body)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const takenDown = status === "TAKEN_DOWN"

  async function call(action: string, run: () => Promise<Response>) {
    setBusy(action)
    setError(null)
    try {
      const res = await run()
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Something went wrong")
        return false
      }
      return true
    } catch {
      setError("Something went wrong")
      return false
    } finally {
      setBusy(null)
    }
  }

  const saveEdits = async () => {
    const ok = await call("save", () =>
      fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draftTitle, body: draftBody }),
      })
    )
    if (ok) {
      setEditing(false)
      router.refresh()
    }
  }

  const regenerate = async () => {
    if (!window.confirm("Overwrites any manual edits with a fresh AI recap. Continue?")) return
    const ok = await call("regenerate", () =>
      fetch(`/api/posts/${postId}/regenerate`, { method: "POST" })
    )
    if (ok) {
      setEditing(false)
      router.refresh()
    }
  }

  const setStatus = async (action: "takedown" | "restore") => {
    if (
      action === "takedown" &&
      !window.confirm("Take this story down? It disappears from all public pages until restored.")
    )
      return
    const ok = await call(action, () =>
      fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
    )
    if (ok) router.refresh()
  }

  return (
    <div
      className={`mb-6 rounded-2xl border p-4 ${
        takenDown ? "border-hoop-200 bg-hoop-50" : "border-ink-200 bg-ink-50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-ink-950 text-sm font-semibold">
            {takenDown ? "Taken down" : "Managing this story"}
          </p>
          <p className="text-ink-500 text-xs">
            {takenDown
              ? "Hidden from the public — only story managers can see this page."
              : "Only you and other story managers see these controls."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!takenDown && !editing && (
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                setDraftTitle(title)
                setDraftBody(body)
                setEditing(true)
              }}
              disabled={busy !== null}
            >
              Edit
            </Button>
          )}
          {isRecap && !takenDown && (
            <Button variant="subtle" size="sm" onClick={regenerate} disabled={busy !== null}>
              {busy === "regenerate" ? "Regenerating…" : "Regenerate"}
            </Button>
          )}
          {takenDown ? (
            <Button
              variant="primary"
              tone="court"
              size="sm"
              onClick={() => setStatus("restore")}
              disabled={busy !== null}
            >
              {busy === "restore" ? "Restoring…" : "Restore"}
            </Button>
          ) : (
            <Button
              variant="secondary"
              tone="hoop"
              size="sm"
              onClick={() => setStatus("takedown")}
              disabled={busy !== null}
            >
              {busy === "takedown" ? "Taking down…" : "Take down"}
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-hoop-700 mt-3 text-xs font-semibold">{error}</p>}

      {editing && (
        <div className="border-ink-200 mt-4 space-y-3 border-t pt-4">
          <div>
            <label htmlFor="admin-bar-title" className="text-ink-700 mb-1 block text-xs font-semibold">
              Title
            </label>
            <input
              id="admin-bar-title"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="border-ink-200 focus:border-play-400 focus:ring-play-100 w-full rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="admin-bar-body" className="text-ink-700 mb-1 block text-xs font-semibold">
              Body
            </label>
            <textarea
              id="admin-bar-body"
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={12}
              className="border-ink-200 focus:border-play-400 focus:ring-play-100 w-full rounded-xl border bg-white px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2"
            />
            {isRecap && (
              <p className="text-ink-400 mt-1 text-xs">
                Note: regenerating later will overwrite these edits with fresh AI copy.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              tone="play"
              size="sm"
              onClick={saveEdits}
              disabled={busy !== null || !draftTitle.trim() || !draftBody.trim()}
            >
              {busy === "save" ? "Saving…" : "Save changes"}
            </Button>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={busy !== null}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
