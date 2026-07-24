"use client"

import { useRef, useState } from "react"

interface CertificationUploadFieldProps {
  label: string
  value: string | null
  onChange: (dataUrl: string | null) => void
  hint?: string
}

// Mirrors the cap on ClubClaim.proofDocumentUrl (~1.5MB raw -> ~2MB base64).
const MAX_DATA_URL_LENGTH = 2_000_000
const MAX_IMAGE_EDGE = 1600

/**
 * QA-208: upload proof of a referee's self-declared certification — PDF or
 * image, capped ~2MB as a data URL (same cap/shape as
 * ClubClaim.proofDocumentUrl). Images are downscaled/recompressed to WebP
 * like ImageUploadField; PDFs can't be recompressed client-side, so they're
 * read as-is and rejected if they don't fit the cap.
 */
export function CertificationUploadField({
  label,
  value,
  onChange,
  hint,
}: CertificationUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    const isImage = /^image\/(webp|jpeg|jpg|png)$/.test(file.type)
    const isPdf = file.type === "application/pdf"
    if (!isImage && !isPdf) {
      setError("Please choose a PDF or image file (JPG, PNG, WebP).")
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("File is too large (max 12MB before compression).")
      return
    }
    setBusy(true)
    try {
      const dataUrl = isImage ? await compressImage(file, MAX_IMAGE_EDGE) : await readAsDataUrl(file)
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        setError(
          isImage
            ? "Image is still too large after compression. Try a smaller photo."
            : "PDF is too large (max ~1.5MB). Try a lower-resolution scan."
        )
        return
      }
      setFileName(file.name)
      onChange(dataUrl)
    } catch {
      setError("Couldn't process that file.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label className="text-ink-700 mb-1 block text-sm font-medium">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => {
              onChange(null)
              setFileName(null)
            }}
            className="text-ink-500 hover:text-red-600 cursor-pointer rounded-xl px-3 py-1.5 text-sm font-medium transition"
          >
            Remove
          </button>
        )}
        {value && (
          <span className="text-ink-500 text-xs">{fileName ?? "Document on file"}</span>
        )}
      </div>
      {hint && <p className="text-ink-400 mt-1 text-xs">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ""
        }}
      />
    </div>
  )
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("read"))
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
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
        resolve(canvas.toDataURL("image/webp", 0.82))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
