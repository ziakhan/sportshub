"use client"

import { useMemo, useState } from "react"
import { BrandListbox, Button } from "@/components/ui"
import { ErrorStrip, Modal, TextField } from "./bits"
import type { Channel, ProviderOption, StreamOpsVenue } from "./types"

/**
 * Add or edit a camera rig.
 *
 * A channel is set up ONCE per rig and then never changes. There are exactly
 * two ways to make one, and the choice is the first thing on the form:
 *
 *   Cloudflare  we create the live input through their API and fill in all
 *               three addresses ourselves. The operator types a name. This is
 *               the default whenever Cloudflare is configured, because the
 *               alternative is a person copying a secret between two browser
 *               tabs by hand.
 *   Custom      the operator pastes what they already have. The ONLY required
 *               field is the playback URL — that is what viewers play and what
 *               the signal probe reads. The RTMP pair is convenience for
 *               whoever sets the rig up, so it is offered and never demanded
 *               (owner ruling, 2026-08-21).
 *
 * On edit the stream key starts EMPTY. A prefilled key is a secret sitting on
 * screen for the length of an edit that was probably only renaming the rig,
 * and an empty field with "leave blank to keep it" costs nothing.
 */

export type ChannelMode = "cloudflare" | "custom"

export interface ChannelDraft {
  mode: ChannelMode
  name: string
  provider: string
  ingestUrl: string
  streamKey: string
  playbackUrl: string
  notes: string
  /** "Usually at" — the building tag. Empty string means untagged. */
  homeVenueId: string
  /**
   * Cloudflare mode only, and ON by default: Cloudflare serves the live
   * picture out of its recording pipeline, so a channel created with this off
   * connects and never shows anything (proven with a real rig, 2026-08-22).
   * A person can still turn it off, and the form says plainly what that costs.
   */
  recording: "off" | "automatic"
}

type Errors = Partial<Record<keyof ChannelDraft, string>>

/** Schemes a camera can actually push with. Anything else is a typo. */
const INGEST_SCHEMES = ["rtmp:", "rtmps:", "srt:", "rist:", "http:", "https:"]

export function validate(draft: ChannelDraft, editing: boolean): Errors {
  const errors: Errors = {}

  if (!draft.name.trim()) {
    errors.name = "Give the rig the name that is on its sticker."
  } else if (draft.name.trim().length > 80) {
    errors.name = "That name is too long for a camera."
  }

  if (draft.notes.length > 2000) errors.notes = "Keep the note under 2000 characters."

  // Cloudflare mode collects a name and a recording choice. Everything else
  // arrives from the provider, so there is nothing here to get wrong.
  if (draft.mode === "cloudflare" && !editing) return errors

  const playback = draft.playbackUrl.trim()
  if (!playback) {
    errors.playbackUrl = "This is the one address a camera cannot work without."
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

  // Optional — but a half-typed one is still a typo worth catching.
  const ingest = draft.ingestUrl.trim()
  if (ingest) {
    try {
      const url = new URL(ingest)
      if (!INGEST_SCHEMES.includes(url.protocol)) {
        errors.ingestUrl = "That is not an ingest address. Expect rtmp, rtmps or srt."
      }
    } catch {
      errors.ingestUrl = "That is not a full address. Include the rtmp:// part."
    }
  }

  return errors
}

/**
 * One of the two ways to add a camera.
 *
 * A radio card rather than a segmented control: each option carries a
 * sentence, and one of them can be unavailable with a paragraph explaining
 * what to do about it — neither fits in a segment. The input is a real radio
 * so arrow keys, labels and screen readers all work; the card is its skin.
 */
function ModeCard({
  checked,
  disabled,
  title,
  blurb,
  note,
  onSelect,
}: {
  checked: boolean
  disabled?: boolean
  title: string
  blurb: string
  /** Shown at full contrast even when disabled — it is the way forward. */
  note?: string | null
  onSelect: () => void
}) {
  return (
    <label className={`block ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
      <input
        type="radio"
        name="channel-mode"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
      />
      <div
        className={`peer-focus-visible:ring-play-300 rounded-xl border p-3 transition peer-focus-visible:ring-2 ${
          checked
            ? "border-play-400 bg-play-50/60"
            : disabled
              ? "border-ink-200 bg-ink-50/40"
              : "border-ink-200 hover:border-ink-300 bg-white"
        }`}
      >
        <div className="flex items-start gap-2.5">
          {/* Not colour alone: the dot fills, so the choice survives a
              greyscale screen and a colour-blind reader. */}
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition ${
              checked ? "border-play-600" : disabled ? "border-ink-300" : "border-ink-300"
            }`}
          >
            {checked && <span className="bg-play-600 h-2 w-2 rounded-full" />}
          </span>
          <div className="min-w-0">
            <div
              className={`text-sm font-semibold ${
                disabled ? "text-ink-500" : checked ? "text-ink-950" : "text-ink-800"
              }`}
            >
              {title}
            </div>
            <p className={`mt-0.5 text-xs leading-5 ${disabled ? "text-ink-500" : "text-ink-600"}`}>
              {blurb}
            </p>
          </div>
        </div>
        {note && (
          <p className="border-ink-200 bg-ink-50 text-ink-700 mt-2.5 rounded-lg border px-2.5 py-2 text-[11px] leading-5">
            {note}
          </p>
        )}
      </div>
    </label>
  )
}

export function ChannelFormDialog({
  channel,
  providers,
  venues,
  busy,
  error,
  onCancel,
  onSave,
}: {
  /** null = adding a new rig. */
  channel: Channel | null
  /** What this server can actually do. Null while still loading. */
  providers: ProviderOption[] | null
  /** Buildings the "usually at" tag can point at. */
  venues: StreamOpsVenue[]
  busy: boolean
  error: string | null
  onCancel: () => void
  onSave: (draft: ChannelDraft) => void
}) {
  const editing = !!channel

  const cloudflare = providers?.find((p) => p.id === "cloudflare") ?? null
  const cloudflareReady = !!cloudflare?.configured

  const [draft, setDraft] = useState<ChannelDraft>({
    // Editing always edits the stored fields directly — the provider made
    // this camera once and that is finished business.
    mode: editing ? "custom" : "cloudflare",
    name: channel?.name ?? "",
    provider: channel?.provider ?? "",
    ingestUrl: channel?.ingestUrl ?? "",
    streamKey: "",
    playbackUrl: channel?.playbackUrl ?? "",
    notes: channel?.notes ?? "",
    homeVenueId: channel?.homeVenueId ?? "",
    // On, because off is the setting where nobody ever sees a picture.
    recording: "automatic",
  })
  const [errors, setErrors] = useState<Errors>({})

  /**
   * The rig's own tagged building is kept in the list even if it has no games
   * this week, so editing a camera never silently drops its tag.
   */
  const venueOptions = useMemo(() => {
    const options = venues.map((v) => ({
      value: v.id,
      label: `${v.name}${v.city ? ` (${v.city})` : ""}`,
    }))
    if (channel?.homeVenue && !options.some((o) => o.value === channel.homeVenue!.id)) {
      options.push({ value: channel.homeVenue.id, label: channel.homeVenue.name })
    }
    options.sort((a, b) => a.label.localeCompare(b.label))
    return [{ value: "", label: "No building in particular" }, ...options]
  }, [venues, channel])

  // Fall back to Custom once we know Cloudflare is unusable, so the form is
  // never sitting on a choice that cannot be submitted. Editing is always
  // Custom: the provider made this camera once, and that is finished.
  const mode: ChannelMode =
    draft.mode === "cloudflare" && (editing || !cloudflareReady) ? "custom" : draft.mode

  function set<K extends keyof ChannelDraft>(key: K, value: ChannelDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function submit() {
    const candidate = { ...draft, mode }
    const found = validate(candidate, editing)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    onSave(candidate)
  }

  const provisioning = mode === "cloudflare" && !editing

  const playbackLooksHls =
    !draft.playbackUrl.trim() || draft.playbackUrl.trim().toLowerCase().includes(".m3u8")

  return (
    <Modal
      title={editing ? `Edit ${channel!.name}` : "Add a camera"}
      subtitle={
        editing
          ? "A rig is set up once. Its addresses stay the same for the life of the camera."
          : "A rig is set up once, and its addresses stay the same for the life of the camera. Either we create it for you, or you paste one you already have."
      }
      onClose={onCancel}
      width="max-w-xl"
      footer={
        <>
          <Button variant="subtle" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} tone="play">
            {busy
              ? provisioning
                ? "Creating it…"
                : "Saving…"
              : editing
                ? "Save changes"
                : provisioning
                  ? "Create the camera"
                  : "Add camera"}
          </Button>
        </>
      }
    >
      {error && <ErrorStrip>{error}</ErrorStrip>}

      <div className="space-y-4">
        {!editing && (
          <fieldset>
            <legend className="text-ink-700 text-xs font-semibold">How are you adding it?</legend>
            <div className="mt-2 space-y-2">
              <ModeCard
                checked={mode === "cloudflare"}
                disabled={!cloudflareReady}
                title="Create it for me on Cloudflare"
                blurb="We make the camera at Cloudflare and hand you the two things to paste into the camera app. You type a name and nothing else."
                note={
                  providers === null
                    ? "Checking whether Cloudflare is set up on this server…"
                    : cloudflareReady
                      ? null
                      : (cloudflare?.missing ??
                        "Cloudflare is not set up on this server yet.")
                }
                onSelect={() => set("mode", "cloudflare")}
              />
              <ModeCard
                checked={mode === "custom"}
                title="I already have the URLs"
                blurb="For a camera hosted anywhere else. Paste its playback address; the RTMP pair is optional."
                onSelect={() => set("mode", "custom")}
              />
            </div>
          </fieldset>
        )}

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

        {/* A TAG, not a binding. Worth its own explained block rather than a
            bare select, because "usually at" beside a building name reads like
            a restriction and it is the opposite of one. */}
        <div className="border-ink-100 bg-ink-50/50 rounded-xl border p-3">
          <label htmlFor="channel-home-venue" className="text-ink-700 text-xs font-semibold">
            Usually at
          </label>
          <div className="mt-1.5">
            <BrandListbox
              id="channel-home-venue"
              ariaLabel="Building this camera usually lives at"
              value={draft.homeVenueId}
              onChange={(value) => set("homeVenueId", value)}
              options={venueOptions}
            />
          </div>
          <p className="text-ink-600 mt-2 text-[11px] leading-5">
            <strong className="text-ink-900">This only helps people find the rig.</strong> A
            scorekeeper&apos;s camera list opens on the cameras tagged to their building, which is
            what makes it usable once there are a hundred of them. It does not restrict anything:
            carry this rig to another gym and it can still be placed there.
          </p>
        </div>

        {provisioning ? (
          <div className="border-ink-100 bg-ink-50/50 rounded-xl border p-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={draft.recording === "automatic"}
                onChange={(e) => set("recording", e.target.checked ? "automatic" : "off")}
                className="text-play-600 focus:ring-play-300 border-ink-300 mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded"
              />
              <span className="min-w-0">
                <span className="text-ink-800 block text-sm font-semibold">
                  Record every game this camera streams
                </span>
                <span className="text-ink-600 mt-0.5 block text-xs leading-5">
                  Keep this on. Cloudflare plays the live picture out of its recording, so
                  recording is what makes the camera watchable at all. Each recording is kept for
                  30 days and Cloudflare bills for that storage while it exists.
                </span>
              </span>
            </label>

            {/* Off is still a person's choice, so it is offered. It is also the
                setting where the camera connects and nobody ever sees anything,
                so it never passes without saying so. */}
            {draft.recording === "off" && (
              <p
                role="alert"
                className="border-gold-100 bg-gold-50 text-ink-800 mt-2.5 rounded-lg border px-2.5 py-2 text-[11px] leading-5"
              >
                <strong className="text-ink-950 block">
                  With recording off, this camera will show no picture.
                </strong>
                Cloudflare accepts the broadcast and never produces a stream to play, so nobody
                can watch it. Only leave this off for a camera that is not meant to be watched.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="border-ink-100 bg-ink-50/50 rounded-xl border p-3">
              <p className="text-ink-700 text-xs leading-5">
                <strong className="text-ink-900">The playback address is the one that matters.</strong>{" "}
                It is what viewers play and what the signal check reads. Copy it from wherever this
                stream is hosted.
              </p>

              <div className="mt-3">
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

            <div className="border-ink-100 rounded-xl border p-3">
              <p className="text-ink-700 text-xs leading-5">
                <strong className="text-ink-900">Connection details, optional.</strong> Only for
                whoever sets the rig up: this is the pair they type into the camera app. Saving them
                here means the next person does not have to go looking. The camera works without
                them.
              </p>

              <div className="mt-3 space-y-4">
                <TextField
                  label="RTMP URL"
                  value={draft.ingestUrl}
                  onChange={(v) => set("ingestUrl", v)}
                  placeholder="rtmp://ingest.example.com/live"
                  error={errors.ingestUrl}
                />
                <TextField
                  label="Stream key"
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
              </div>
            </div>

            <TextField
              label="Vendor"
              value={draft.provider}
              onChange={(v) => set("provider", v)}
              placeholder="MediaMTX, Castr…"
              hint="Who runs the ingest. Free text, for your own reference."
              error={errors.provider}
            />
          </>
        )}

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
