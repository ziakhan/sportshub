"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { SignoffPinCard } from "@/components/scoring/signoff-pin-card"
import { CertificationUploadField } from "@/components/referee/certification-upload-field"

const refereeProfileSchema = z.object({
  certificationLevel: z.enum(["Level 1", "Level 2", "Level 3"]),
  standardFee: z.coerce.number().min(0, "Fee must be a positive number"),
  availableRegions: z.string().min(1, "Enter at least one region"),
})

type RefereeProfileFormData = z.infer<typeof refereeProfileSchema>

export default function RefereeProfilePage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  // Whether a referee profile already exists. When false, this page is the
  // "Become a referee" flow — submitting creates the profile and grants the
  // Referee role. When true, it edits the existing profile.
  const [hasProfile, setHasProfile] = useState(false)
  const [certDocUrl, setCertDocUrl] = useState<string | null>(null)
  const [certVerifiedAt, setCertVerifiedAt] = useState<string | null>(null)
  const router = useRouter()
  const labelClass = "block text-sm font-medium text-ink-700"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2 text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RefereeProfileFormData>({
    resolver: zodResolver(refereeProfileSchema),
  })

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/referee/profile")
        if (res.ok) {
          const data = await res.json()
          setHasProfile(true)
          reset({
            certificationLevel: data.certificationLevel || "",
            standardFee: Number(data.standardFee) || 0,
            availableRegions: (data.availableRegions || []).join(", "),
          })
          setCertDocUrl(data.certificationDocUrl ?? null)
          setCertVerifiedAt(data.certificationVerifiedAt ?? null)
        }
      } catch {
        setError("Failed to load profile")
      } finally {
        setIsLoading(false)
      }
    }
    loadProfile()
  }, [reset])

  const onSubmit = async (data: RefereeProfileFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch("/api/referee/profile", {
        method: hasProfile ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          availableRegions: data.availableRegions
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean),
          certificationDocUrl: certDocUrl,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to update profile")
      }

      const saved = await res.json()
      setCertDocUrl(saved.certificationDocUrl ?? null)
      setCertVerifiedAt(saved.certificationVerifiedAt ?? null)

      setSuccess(true)
      if (!hasProfile) {
        // Just became a referee — reflect new state and refresh server data so
        // the new role shows up in nav/dashboard.
        setHasProfile(true)
        router.refresh()
      }
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
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Link href="/dashboard" className="text-ink-500 hover:text-ink-700 text-sm">
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="border-ink-100 rounded-3xl border bg-white p-8 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
        <h1 className="text-ink-900 mb-2 text-2xl font-semibold">
          {hasProfile ? "Referee Profile" : "Become a Referee"}
        </h1>
        <p className="text-ink-600 mb-6 text-sm">
          {hasProfile
            ? "Update your certification, fee, and availability."
            : "Set your certification, fee, and availability to start officiating games."}
        </p>

        {error && (
          <div className="border-hoop-200 text-hoop-700 mb-4 rounded-lg border bg-red-50 p-3 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-court-50 text-court-700 mb-4 rounded-lg border border-green-200 p-3 text-sm">
            {hasProfile
              ? "Profile updated successfully!"
              : "You're now a referee! Your profile has been created."}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="certificationLevel" className={labelClass}>
                Certification Level <span className="text-red-500">*</span>
              </label>
              {certVerifiedAt ? (
                <span className="bg-court-50 text-court-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                  Verified
                </span>
              ) : certDocUrl ? (
                <span className="bg-ink-50 text-ink-600 rounded-full px-2 py-0.5 text-xs font-semibold">
                  Cert on file
                </span>
              ) : (
                <span className="text-ink-400 text-xs">Self-declared</span>
              )}
            </div>
            <select
              {...register("certificationLevel")}
              id="certificationLevel"
              className={inputClass}
            >
              <option value="">Select level</option>
              <option value="Level 1">Level 1 — Entry</option>
              <option value="Level 2">Level 2 — Intermediate</option>
              <option value="Level 3">Level 3 — Advanced</option>
            </select>
            {errors.certificationLevel && (
              <p className="mt-1 text-sm text-red-600">{errors.certificationLevel.message}</p>
            )}
          </div>

          <div>
            <CertificationUploadField
              label="Upload your certification (PDF or image)"
              value={certDocUrl}
              onChange={setCertDocUrl}
              hint="A photo or PDF of your officiating certification. Leagues can see it's on file and verify it."
            />
          </div>

          <div>
            <label htmlFor="standardFee" className={labelClass}>
              Standard Fee per Game ($) <span className="text-red-500">*</span>
            </label>
            <input
              {...register("standardFee")}
              type="number"
              id="standardFee"
              min="0"
              step="0.01"
              className={inputClass}
              placeholder="50.00"
            />
            {errors.standardFee && (
              <p className="mt-1 text-sm text-red-600">{errors.standardFee.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="availableRegions" className={labelClass}>
              Available Regions <span className="text-red-500">*</span>
            </label>
            <input
              {...register("availableRegions")}
              type="text"
              id="availableRegions"
              className={inputClass}
              placeholder="California, Nevada, Arizona"
            />
            <p className="text-ink-500 mt-1 text-xs">Separate multiple regions with commas.</p>
            {errors.availableRegions && (
              <p className="mt-1 text-sm text-red-600">{errors.availableRegions.message}</p>
            )}
          </div>

          <div className="flex gap-4 pt-2">
            <Link
              href="/dashboard"
              className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border bg-white px-4 py-2 font-semibold shadow-sm transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-play-600 hover:bg-play-700 disabled:bg-ink-400 flex-1 rounded-xl px-4 py-2 font-semibold text-white shadow-sm transition disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? "Saving..."
                : hasProfile
                  ? "Save Changes"
                  : "Become a Referee"}
            </button>
          </div>
        </form>
      </div>

      {hasProfile && (
        <div className="mt-4">
          <SignoffPinCard />
        </div>
      )}
    </div>
  )
}
