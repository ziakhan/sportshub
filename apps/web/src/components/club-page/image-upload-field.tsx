"use client"

import { useRef, useState } from "react"

interface ImageUploadFieldProps {
  label: string
  value: string | null
  onChange: (dataUrl: string | null) => void
  /** Longest edge the image is downscaled to before storing. */
  maxSize?: number
  /** Preview aspect: "wide" (banner) or "square" (logo). */
  aspect?: "wide" | "square"
  hint?: string
}

/**
 * Upload an image with NO external blob infra: the browser downscales +
 * compresses to WebP and we store the result as a data URL on the branding
 * record. Small (logos ~10–40KB, banners ~120–300KB), works in dev and prod.
 * (If we outgrow this, swap the onChange target for a blob-store URL.)
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  maxSize = 1200,
  aspect = "wide",
  hint,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.")
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Image is too large (max 12MB before compression).")
      return
    }
    setBusy(true)
    try {
      const dataUrl = await compressImage(file, maxSize)
      onChange(dataUrl)
    } catch {
      setError("Couldn't process that image.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label className="text-ink-700 mb-1 block text-sm font-medium">{label}</label>
      <div className="flex items-start gap-4">
        <div
          className={`bg-ink-50 border-ink-200 flex flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border ${
            aspect === "wide" ? "h-20 w-36" : "h-20 w-20"
          }`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={`${label} preview`} className="h-full w-full object-cover" />
          ) : (
            <span className="text-ink-300 text-xs">No image</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="border-ink-200 text-ink-700 hover:bg-ink-50 cursor-pointer rounded-xl border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50"
            >
              {busy ? "Processing…" : value ? "Replace" : "Upload"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-ink-500 hover:text-red-600 cursor-pointer rounded-xl px-3 py-1.5 text-sm font-medium transition"
              >
                Remove
              </button>
            )}
          </div>
          {hint && <p className="text-ink-400 mt-1 text-xs">{hint}</p>}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
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
        </div>
      </div>
    </div>
  )
}

/** Downscale to `maxSize` longest edge and encode as WebP data URL. */
function compressImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("read"))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error("decode"))
      img.onload = () => {
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("ctx"))
        ctx.drawImage(img, 0, 0, width, height)
        // WebP where supported; browsers fall back to png automatically.
        resolve(canvas.toDataURL("image/webp", 0.82))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
