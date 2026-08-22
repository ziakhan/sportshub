"use client"

import { Button } from "@/components/ui"
import { CopyField, Modal } from "./bits"
import type { Channel } from "./types"

/**
 * The hand-off: the two things a person types into the camera app.
 *
 * This exists in two places and must read identically in both — right after a
 * camera is created, and later from the channel card's Connection details —
 * because the second one is what an operator opens when they are standing in
 * a gym and the rig will not connect. One component, two mounts.
 *
 * The ingest pair is OPTIONAL on a channel (owner, 2026-08-21): a custom
 * camera can carry nothing but a playback URL. When it does, this says so in
 * a sentence rather than rendering copy buttons over empty strings — a copy
 * button that copies nothing is worse than no button, because the operator
 * pastes the nothing and then goes hunting for why the camera is dark.
 */

export function ConnectionDetails({ channel }: { channel: Channel }) {
  const hasIngest = !!channel.ingestUrl && !!channel.streamKey
  const partial = !hasIngest && (!!channel.ingestUrl || !!channel.streamKey)

  return (
    <div className="space-y-3">
      {hasIngest ? (
        <>
          <p className="border-play-100 bg-play-50 text-ink-700 rounded-xl border px-3 py-2 text-xs leading-5">
            <strong className="text-ink-900">In the XbotGo app:</strong> Live → Platform Streaming →
            RTMP, then paste these two. Any app that pushes RTMP takes the same pair.
          </p>
          <CopyField label="RTMP URL" value={channel.ingestUrl!} />
          <CopyField
            label="Stream key"
            value={channel.streamKey!}
            secret
            hint="Anyone holding this pair can push their own picture onto a game page. Read it out only to the person setting up this rig."
          />
        </>
      ) : (
        <p className="border-ink-200 bg-ink-50 text-ink-700 rounded-xl border px-3 py-2 text-xs leading-5">
          {partial ? (
            <>
              <strong className="text-ink-900">Only half the ingest pair is saved here.</strong> A
              camera needs both the RTMP URL and the key to push. Edit this camera to add the
              missing one, or get both from wherever this stream is hosted.
            </>
          ) : (
            <>
              <strong className="text-ink-900">No ingest details saved for this camera.</strong>{" "}
              That is fine. It plays from the address below. Whoever sets the rig up gets its RTMP
              URL and key from wherever the stream is hosted, and you can add them here with Edit so
              the next person does not have to go looking.
            </>
          )}
        </p>
      )}

      {/* Always present: this is the address that actually makes the camera
          work, and the one the signal probe reads. */}
      <CopyField
        label="Playback URL"
        value={channel.playbackUrl}
        hint={hasIngest ? undefined : "What viewers play. The signal probe reads this address."}
      />

      {channel.notes && <p className="text-ink-600 text-xs leading-5">{channel.notes}</p>}
    </div>
  )
}

/**
 * Shown the moment a camera is created for us at the provider.
 *
 * Deliberately NOT another form: the work is finished, so it opens with the
 * result, the values are `<output>` elements rather than inputs, and there is
 * one button and it dismisses. The only job left belongs to a person holding
 * a phone.
 */
export function ChannelHandoffDialog({
  channel,
  provisioned,
  onClose,
}: {
  channel: Channel
  /** True when we just created it at the provider, false for a later look. */
  provisioned: boolean
  onClose: () => void
}) {
  return (
    <Modal
      title={provisioned ? `${channel.name} is ready` : `${channel.name}: connection details`}
      subtitle={
        provisioned
          ? "Created for you. Copy these into the camera app and the rig is live. Nothing else to fill in here."
          : "The addresses this rig uses. They do not change."
      }
      onClose={onClose}
      width="max-w-lg"
      footer={
        <Button onClick={onClose} tone="play">
          Done
        </Button>
      }
    >
      {provisioned && (
        <div
          role="status"
          className="border-court-100 bg-court-50 mb-4 flex items-start gap-2.5 rounded-xl border px-3 py-2.5"
        >
          <span className="bg-court-600 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
              <path
                d="m5 12.5 4.5 4.5L19 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="text-court-800 text-sm leading-5">
            The camera was created at the provider and saved here. Place it at a court when the rig
            is set up and today&apos;s games there pick it up on their own.
          </p>
        </div>
      )}

      <ConnectionDetails channel={channel} />
    </Modal>
  )
}
