"use client"

import { useRef, useState } from "react"
import { PlayerMug } from "@/components/ui"
import { compressImage } from "@/components/club-page/image-upload-field"
import { PLAYER_PHOTO_MAX_EDGE } from "@/lib/validations/player-photo"

/**
 * The player head shot, uploaded by the account holder.
 *
 * Same no-blob-infra pattern as the club logo: the browser downscales to a
 * 512px square-ish head shot and hands back a WebP data URL, which the player
 * PATCH (or the onboarding POST) stores on Player.photoUrl. Until then every
 * surface shows the sketched PlayerMug, so the preview here is the real
 * placeholder rather than a grey box — you are looking at exactly what a
 * roster will show.
 *
 * COPPA: the picker is only ever rendered on a profile the signed-in account
 * owns (their own, or their child's). We do not accept photos of other
 * people's kids anywhere.
 */

const MAX_FILE_BYTES = 12 * 1024 * 1024

function usePhotoPicker(onChange: (dataUrl: string | null) => void) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.")
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That image is too large (max 12MB before compression).")
      return
    }
    setBusy(true)
    try {
      onChange(await compressImage(file, PLAYER_PHOTO_MAX_EDGE))
    } catch {
      setError("We couldn't process that image.")
    } finally {
      setBusy(false)
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) handleFile(f)
        e.target.value = ""
      }}
    />
  )

  return { input, busy, error, open: () => inputRef.current?.click() }
}

interface PlayerPhotoFieldProps {
  name: string
  jerseyNumber?: string | null
  value: string | null
  onChange: (dataUrl: string | null) => void
}

/** The full control, for the player profile / edit page. */
export function PlayerPhotoField({ name, jerseyNumber, value, onChange }: PlayerPhotoFieldProps) {
  const { input, busy, error, open } = usePhotoPicker(onChange)

  return (
    <div className="flex items-start gap-4">
      <PlayerMug
        name={name || "Player"}
        jerseyNumber={jerseyNumber}
        photoUrl={value}
        sizeClassName="h-20 w-20 rounded-2xl"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={open}
            disabled={busy}
            className="border-ink-200 text-ink-700 hover:bg-ink-50 min-h-[40px] cursor-pointer rounded-xl border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50"
          >
            {busy ? "Processing..." : value ? "Replace photo" : "Upload photo"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-ink-500 min-h-[40px] cursor-pointer rounded-xl px-3 py-1.5 text-sm font-semibold transition hover:text-red-600"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-ink-400 mt-1.5 text-xs">
          A head shot works best. Without one we draw the sketch on the left with the jersey number.
          Only upload a photo of your own player.
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {input}
      </div>
    </div>
  )
}

interface PlayerPhotoChipProps {
  name: string
  jerseyNumber?: string | null
  value: string | null
  onChange: (dataUrl: string | null) => void
}

/**
 * The onboarding version: one chip on the navy hero, beside the handle chip.
 * It has to stay a single line because the player step is a one-viewport
 * layout the owner signed off on (2026-08-13) and this may not grow it.
 */
export function PlayerPhotoChip({ name, jerseyNumber, value, onChange }: PlayerPhotoChipProps) {
  const { input, busy, error, open } = usePhotoPicker(onChange)

  return (
    <span className="inline-flex min-h-[44px] items-center gap-2.5 rounded-full bg-white/10 py-1.5 pl-1.5 pr-4 ring-1 ring-inset ring-white/20">
      <PlayerMug
        name={name || "Your photo"}
        jerseyNumber={jerseyNumber}
        photoUrl={value}
        surface="dark"
        size="md"
      />
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="cursor-pointer rounded text-[13px] font-bold text-white underline underline-offset-2 transition-colors duration-200 hover:text-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-60"
      >
        {busy ? "Adding..." : value ? "change photo" : "add photo"}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="cursor-pointer rounded text-[13px] font-semibold text-white/70 underline underline-offset-2 transition-colors duration-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          remove
        </button>
      )}
      {error && <span className="text-[12px] font-semibold text-amber-200">{error}</span>}
      {input}
    </span>
  )
}
