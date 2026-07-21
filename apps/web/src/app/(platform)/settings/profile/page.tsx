"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CountryStateSelector } from "@/components/country-state-selector"
import { Button, Card } from "@/components/ui"

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().min(7, "Enter a valid phone number").max(20),
  country: z.string().length(2).default("CA"),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State/Province is required").max(100),
})

type ProfileFormData = z.infer<typeof profileSchema>

/** Downscale to a small square-ish avatar (longest edge `size`px) → data URL.
 *  Same client-compression approach as components/club-page/image-upload-field. */
function downscaleToDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("read"))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error("decode"))
      img.onload = () => {
        const scale = Math.min(1, size / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("ctx"))
        ctx.drawImage(img, 0, 0, width, height)
        // WebP where supported; browsers fall back to png automatically.
        resolve(canvas.toDataURL("image/webp", 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

/** Circle avatar preview + upload/remove. Saves immediately (own PATCH),
 *  independent of the profile form below it. */
function AvatarUploader({
  value,
  onSaved,
}: {
  value: string | null
  onSaved: (next: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(next: string | null) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to update photo")
      }
      onSaved(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update photo")
    } finally {
      setBusy(false)
    }
  }

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
      const dataUrl = await downscaleToDataUrl(file, 256)
      await save(dataUrl)
    } catch {
      setError("Could not process that image.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="border-ink-200 bg-ink-50 flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Profile photo" className="h-full w-full object-cover" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="text-ink-300 h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-ink-800 text-sm font-medium">Profile photo</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="subtle"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Saving…" : value ? "Replace" : "Upload"}
          </Button>
          {value && !busy && (
            <button
              type="button"
              onClick={() => save(null)}
              className="text-ink-500 rounded-xl px-3 py-1.5 text-sm font-medium transition hover:text-red-600"
            >
              Remove
            </button>
          )}
        </div>
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
  )
}

export default function ProfileEditPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { country: "CA" },
  })

  const labelClass = "block text-sm font-medium text-ink-800"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/user/profile")
        if (res.ok) {
          const data = await res.json()
          setAvatarUrl(data.avatarUrl || null)
          reset({
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            phoneNumber: data.phoneNumber || "",
            country: data.country || "CA",
            city: data.city || "",
            state: data.state || "",
          })
        }
      } catch {
        setError("Failed to load profile")
      } finally {
        setIsLoading(false)
      }
    }
    loadProfile()
  }, [reset])

  const onSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to update profile")
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-ink-500">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl p-6 md:p-8">
      <Card className="reveal p-8">
        <h1 className="font-condensed text-ink-950 mb-1 text-3xl font-bold uppercase leading-none tracking-wide">
          Edit Profile
        </h1>
        <p className="text-ink-500 mb-6 text-sm">Update your personal information.</p>

        <AvatarUploader value={avatarUrl} onSaved={setAvatarUrl} />

        {error && (
          <div className="border-hoop-100 bg-hoop-50 text-hoop-700 mb-4 rounded-xl border p-3 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="border-court-100 bg-court-50 text-court-700 mb-4 rounded-xl border p-3 text-sm">
            Profile updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className={labelClass}>
                First Name <span className="text-red-500">*</span>
              </label>
              <input {...register("firstName")} type="text" id="firstName" className={inputClass} />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className={labelClass}>
                Last Name <span className="text-red-500">*</span>
              </label>
              <input {...register("lastName")} type="text" id="lastName" className={inputClass} />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="phoneNumber" className={labelClass}>
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              {...register("phoneNumber")}
              type="tel"
              id="phoneNumber"
              className={inputClass}
              placeholder="(555) 123-4567"
            />
            <p className="mt-1 text-xs text-ink-400">
              So your club or league can reach you about games, schedules, and payments.
            </p>
            {errors.phoneNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.phoneNumber.message}</p>
            )}
          </div>

          <CountryStateSelector
            countryValue={watch("country") || "CA"}
            stateValue={watch("state") || ""}
            onCountryChange={(country) => setValue("country", country)}
            onStateChange={(state) => setValue("state", state)}
            countryError={errors.country?.message}
            stateError={errors.state?.message}
          />

          <div>
            <label htmlFor="city" className={labelClass}>
              City <span className="text-red-500">*</span>
            </label>
            <input
              {...register("city")}
              type="text"
              id="city"
              className={inputClass}
              placeholder="Toronto"
            />
            {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>}
          </div>

          <div className="flex gap-4 pt-2">
            <Button href="/dashboard" variant="subtle">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>

        <div className="border-ink-100 mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t pt-4">
          <Link
            href="/settings/communications"
            className="text-play-600 hover:text-play-700 text-sm font-semibold transition-colors"
          >
            Email preferences &rarr;
          </Link>
          <Link
            href="/settings/security"
            className="text-play-600 hover:text-play-700 text-sm font-semibold transition-colors"
          >
            Security &amp; sign-in &rarr;
          </Link>
        </div>
      </Card>
    </div>
  )
}
