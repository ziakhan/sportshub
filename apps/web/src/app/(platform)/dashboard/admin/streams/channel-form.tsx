"use client"

import { useState } from "react"
import { Button } from "@/components/ui"
import { ErrorStrip, Modal, TextField } from "./bits"
import type { Channel } from "./types"

/**
 * Add or edit a camera rig.
 *
 * A channel is set up ONCE per rig and then never changes — that is the whole
 * premise of the three-layer model, and the form says so rather than assuming
 * the operator read the plan. The two URLs and the key come from the streaming
 * vendor; nothing here generates or validates them against the vendor, so the
 * form's job is to stop the typos it can see and to be honest about the rest.
 *
 * On edit the stream key starts EMPTY. A prefilled key is a secret sitting on
 * screen for the length of an edit that was probably only renaming the rig,
 * and an empty field with "leave blank to keep it" costs nothing.
 */

export interface ChannelDraft {
  name: string
  provider: string
  ingestUrl: string
  streamKey: string
  playbackUrl: string
  notes: string
}

type Errors = Partial<Record<keyof ChannelDraft, string>>

/** Schemes a camera can actually push with. Anything else is a typo. */
const INGEST_SCHEMES = ["rtmp:", "rtmps:", "srt:", "rist:", "http:", "https:"]

function validate(draft: ChannelDraft, editing: boolean): Errors {
  const errors: Errors = {}

  if (!draft.name.trim()) {
    errors.name = "Give the rig the name that is on its sticker."
  } else if (draft.name.trim().length > 80) {
    errors.name = "That name is too long for a camera."
  }

  const ingest = draft.ingestUrl.trim()
  if (!ingest) {
    errors.ingestUrl = "The vendor gives you this. It is where the camera pushes."
  } else {
    try {
      const url = new URL(ingest)
      if (!INGEST_SCHEMES.includes(url.protocol)) {
        errors.ingestUrl = "That is not an ingest address. Expect rtmp, rtmps or srt."
      }
    } catch {
      errors.ingestUrl = "That is not a full address. Include the rtmp:// part."
    }
  }

  if (!editing && !draft.streamKey.trim()) {
    errors.streamKey = "The vendor gives you this with the ingest URL."
  }

  const playback = draft.playbackUrl.trim()
  if (!playback) {
    errors.playbackUrl = "The vendor gives you this. It is what viewers play."
  } else {
    try {
      const url = new URL(playback)
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.playbackUrl = "Playback has to be an https address."
      }
    } catch {
      errors.playbackUrl = "That is not a full address. Include the https:// part."
    }
  }

  if (draft.notes.length > 2000) errors.notes = "Keep the note under 2000 characters."

  return errors
}

export function ChannelFormDialog({
  channel,
  busy,
  error,
  onCancel,
  onSave,
}: {
  /** null = adding a new rig. */
  channel: Channel | null
  busy: boolean
  error: string | null
  onCancel: () => void
  onSave: (draft: ChannelDraft) => void
}) {
  const editing = !!channel
  const [draft, setDraft] = useState<ChannelDraft>({
    name: channel?.name ?? "",
    provider: channel?.provider ?? "",
    ingestUrl: channel?.ingestUrl ?? "",
    streamKey: "",
    playbackUrl: channel?.playbackUrl ?? "",
    notes: channel?.notes ?? "",
  })
  const [errors, setErrors] = useState<Errors>({})

  function set<K extends keyof ChannelDraft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function submit() {
    const found = validate(draft, editing)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    onSave(draft)
  }

  const playbackLooksHls =
    !draft.playbackUrl.trim() || draft.playbackUrl.trim().toLowerCase().includes(".m3u8")

  return (
    <Modal
      title={editing ? `Edit ${channel!.name}` : "Add a camera"}
      subtitle="A rig is set up once. Its ingest and playback addresses come from the streaming vendor and stay the same for the life of the camera."
      onClose={onCancel}
      width="max-w-xl"
      footer={
        <>
          <Button variant="subtle" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} tone="play">
            {busy ? "Saving…" : editing ? "Save changes" : "Add camera"}
          </Button>
        </>
      }
    >
      {error && <ErrorStrip>{error}</ErrorStrip>}

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Camera name"
            required
            autoFocus={!editing}
            value={draft.name}
            onChange={(v) => set("name", v)}
            placeholder="Camera A"
            hint="Match the sticker on the tripod. Scorekeepers read this out loud."
            error={errors.name}
          />
          <TextField
            label="Vendor"
            value={draft.provider}
            onChange={(v) => set("provider", v)}
            placeholder="MediaMTX, Cloudflare Stream…"
            hint="Who runs the ingest. Free text, for your own reference."
            error={errors.provider}
          />
        </div>

        <div className="border-ink-100 bg-ink-50/50 rounded-xl border p-3">
          <p className="text-ink-700 text-xs leading-5">
            <strong className="text-ink-900">These three come from the vendor.</strong> The camera
            pushes to the ingest address using the key; viewers play the playback address. They are
            permanent per rig, so you should be copying them out of the vendor console, not making
            them up.
          </p>

          <div className="mt-3 space-y-4">
            <TextField
              label="Ingest URL"
              required
              value={draft.ingestUrl}
              onChange={(v) => set("ingestUrl", v)}
              placeholder="rtmp://ingest.example.com/live"
              error={errors.ingestUrl}
            />
            <TextField
              label="Stream key"
              required={!editing}
              value={draft.streamKey}
              onChange={(v) => set("streamKey", v)}
              placeholder={editing ? "Leave blank to keep the current key" : "camera-a-9f2c…"}
              hint={
                editing
                  ? "Blank keeps the key this rig already has."
                  : "Treat it like a password. Anyone holding it can push a picture onto a game page."
              }
              error={errors.streamKey}
            />
            <TextField
              label="Playback URL"
              required
              value={draft.playbackUrl}
              onChange={(v) => set("playbackUrl", v)}
              placeholder="https://cdn.example.com/camera-a/index.m3u8"
              hint={
                playbackLooksHls
                  ? "The HLS manifest. The signal probe reads this address."
                  : "That does not end in .m3u8. It will still save, but the signal probe expects an HLS manifest."
              }
              error={errors.playbackUrl}
            />
          </div>
        </div>

        <TextField
          label="Notes"
          multiline
          value={draft.notes}
          onChange={(v) => set("notes", v)}
          placeholder="Lives in the equipment closet at Central. Phone is the old iPhone 12."
          hint="Anything the next person carrying this rig needs to know."
          error={errors.notes}
        />
      </div>
    </Modal>
  )
}
